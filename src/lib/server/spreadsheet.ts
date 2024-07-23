import { GoogleSpreadsheet } from 'google-spreadsheet';
import { validate as isValidUuid } from '@std/uuid/v4';
import { assert } from '@std/assert';

import { generateSymbol, mapOpt, setMinus } from '$lib/utils.ts';
import type { Transaction } from './bank.ts';

import secrets from '$lib/server/secrets.ts';
import { z } from 'zod';
import { generujNJmen } from '$lib/jmena.ts';
import { sendTicket } from './mail.ts';
import { JWT } from 'google-auth-library';

const getSheets = async () => {
	const serviceAccountAuth = new JWT({
		email: secrets.serviceAccountKey.client_email,
		key: secrets.serviceAccountKey.private_key,
		scopes: ['https://www.googleapis.com/auth/spreadsheets']
	});
	const doc = new GoogleSpreadsheet(secrets.spreadsheetId, serviceAccountAuth);
	await doc.loadInfo();
	const purchaseSheet = doc.sheetsByTitle['listky'];
	const usedTicketSheet = doc.sheetsByTitle['pouzite_listky'];
	const transactionSheet = doc.sheetsByTitle['neprirazene_transakce'];
	return { purchaseSheet, usedTicketSheet, transactionSheet };
};

export interface UserInfo {
	jmeno: string;
	email: string;
	adresa: string;
}
interface PurchaseEntry extends UserInfo {
	uuid: string;

	vytvoreno: number;
	zaplaceno?: number;

	cena: number;
	pocet_vstupenek: number;
	hotel_room: string | undefined;
	variabilni_symbol: number;
	id_transakce?: number;
	vstupenky_hash?: string[];

	poznamka: string | undefined;
}
interface TransactionEntry {
	id_transakce: number;
	timestamp: number;
	castka: string;
	variabilni_symbol: number;
	ucet: string;
	jmeno: string;
}

const emptyToUndefined = (x: string | undefined): string | undefined => (x === '' ? undefined : x);
const toOptNum = (x: string | undefined) => mapOpt(emptyToUndefined(x), (x) => +x);
const toStrArr = (x: string | undefined) =>
	x
		?.split(',')
		.map((s) => s.trim())
		.filter((s) => s !== '');

const getPurchaseRows = async (): Promise<PurchaseEntry[]> => {
	const { purchaseSheet } = await getSheets();
	const rows = await purchaseSheet.getRows();
	return rows.map((r) => ({
		uuid: r.get('uuid'),

		jmeno: r.get('jmeno'),
		email: r.get('email'),
		adresa: r.get('adresa'),

		vytvoreno: +r.get('vytvoreno'),
		zaplaceno: toOptNum(r.get('zaplaceno')),

		cena: +r.get('cena'),
		pocet_vstupenek: +r.get('pocet_vstupenek'),
		hotel_room: emptyToUndefined(r.get('hotel_room')),
		variabilni_symbol: +r.get('variabilni_symbol'),
		id_transakce: toOptNum(r.get('id_transakce')),
		vstupenky_hash: toStrArr(r.get('vstupenky_hash')),

		poznamka: emptyToUndefined(r.get('poznamka'))
	}));
};

export const getPurchaseByUuid = async (uuid: string): Promise<PurchaseEntry | undefined> => {
	if (!isValidUuid(uuid)) return undefined;
	const rows = await getPurchaseRows();
	return rows.find((row) => row.uuid === uuid);
};

export const generateUuid = async () => {
	const { purchaseSheet } = await getSheets();
	const rows = await purchaseSheet.getRows();
	const used = new Set(rows.map((r) => r.get('uuid')));

	let uuid: string;
	do {
		uuid = crypto.randomUUID();
	} while (used.has(uuid));

	return uuid;
};

export const getFreeHotelRooms = async () => {
	// const { purchaseSheet } = await getSheets();
	// const rows = await purchaseSheet.getRows();
	// const used = new Set(
	// 	rows
	// 		.map((r) => emptyToUndefined(r.get('hotel_room')))
	// 		.filter((r): r is string => r !== undefined)
	// );
	// const free = Object.keys(secrets.hotelRooms).filter((r) => !used.has(r));
	// return free;
	return Object.keys(secrets.hotelRooms);
};

const getUsedTickets = async (): Promise<Set<string>> => {
	const { usedTicketSheet } = await getSheets();
	const rows = await usedTicketSheet.getRows();
	return new Set(rows.map((r) => r.get('hash')));
};

interface UseTicketResult {
	validity: 'invalid' | 'valid' | 'used';
	name: string;
	mail: string;
	used: number;
}
export const useTicket = async (hash: string): Promise<UseTicketResult> => {
	const row = (await getPurchaseRows()).find(({ vstupenky_hash }) =>
		vstupenky_hash?.includes(hash)
	);

	if (!row)
		return {
			validity: 'invalid',
			name: '',
			mail: '',
			used: -1
		};
	const { jmeno: name, email: mail } = row;

	const { usedTicketSheet } = await getSheets();
	const usedRow = (await usedTicketSheet.getRows())
		.map((r) => ({
			hash: r.get('hash'),
			used: +r.get('pouzito')
		}))
		.find((r) => r.hash === hash);

	if (!usedRow) await usedTicketSheet.addRow({ hash, pouzito: Date.now() });

	const validity = usedRow ? 'used' : 'valid';

	return {
		validity,
		name,
		mail,
		used: usedRow?.used ?? -1
	};
};
export const undoUseTicket = async (hash: string) => {
	const { usedTicketSheet } = await getSheets();
	const rows = await usedTicketSheet.getRows();
	const row = rows.find((r) => r.get('hash') === hash);
	row?.delete();
};

export const checkTickets = async (
	uuid: string,
	hashes: string[]
): Promise<[hash: string, validity: 'invalid' | 'valid' | 'used'][]> => {
	const rows = await getPurchaseRows();
	const usedTickets = await getUsedTickets();
	const paidTickets = new Set(
		rows
			.filter((r) => r.uuid === uuid)
			.filter((r) => r.zaplaceno)
			.flatMap((r) => r.vstupenky_hash ?? [])
	);

	return hashes.map((h) => [
		h,
		!paidTickets.has(h) ? 'invalid' : usedTickets.has(h) ? 'used' : 'valid'
	]);
};

const addPurchaseRow = async (entry: Readonly<PurchaseEntry>) => {
	const { purchaseSheet } = await getSheets();
	await purchaseSheet.addRow({
		...entry,
		hotel_room: entry.hotel_room ?? '',
		vstupenky_hash: entry.vstupenky_hash?.join(', ') ?? '',
		poznamka: entry.poznamka ?? ''
	});
};

const updatePurchaseRow = async (
	which: Partial<Readonly<PurchaseEntry>>,
	edit: Partial<Readonly<PurchaseEntry>>
) => {
	const { purchaseSheet } = await getSheets();
	const rows = await purchaseSheet.getRows();
	const row = rows.find((r) =>
		Object.entries(which).every(([key, value]) => r.get(key) === String(value))
	);
	if (row === undefined) throw new Error('Could not find the row');

	for (const [key, value] of Object.entries(edit)) {
		row.set(key, Array.isArray(value) ? value.join(', ') : value);
	}

	await row.save();
};

const getTransactionRows = async (): Promise<TransactionEntry[]> => {
	const { transactionSheet } = await getSheets();
	const rows = await transactionSheet.getRows();
	return rows.map((r) => ({
		id_transakce: +r.get('id_transakce'),
		timestamp: +r.get('timestamp'),
		castka: r.get('castka'),
		variabilni_symbol: +r.get('variabilni_symbol'),
		ucet: r.get('ucet'),
		jmeno: r.get('jmeno')
	}));
};

const updateTransactionRows = async (transactions: Readonly<TransactionEntry>[]) => {
	const { transactionSheet } = await getSheets();
	const rows = await transactionSheet.getRows();

	const oldIds = new Set(rows.map((r) => +r.get('id_transakce')));
	const newIds = new Set(transactions.map((t) => t.id_transakce));

	const deleteIds = setMinus(oldIds, newIds);
	const addIds = setMinus(newIds, oldIds);

	for (const id of deleteIds) await rows.find((r) => +r.get('id_transakce') === id)?.delete();
	await transactionSheet.addRows(transactions.filter((t) => addIds.has(t.id_transakce)));
};

/**
 * @returns the generated unique variable symbol
 * @throws on UUID conflict
 */
export const newPurchase = async (
	uuid: string,
	ticketCount: number,
	hotelRoom: string | undefined,
	user: UserInfo,
	note: string | undefined
): Promise<{ vs: number; price: number }> => {
	z.number().int().positive().parse(ticketCount);

	const [rows, transactionRows] = await Promise.all([getPurchaseRows(), getTransactionRows()]);

	if (hotelRoom) {
		const freeRooms = await getFreeHotelRooms();
		assert(freeRooms.includes(hotelRoom), `Hotel room ${hotelRoom} is already sold out.`);
	}

	const usedSymbols = new Set([
		...rows.map((r) => r.variabilni_symbol),
		...transactionRows.map((t) => t.variabilni_symbol)
	]);

	const rowWithSameUuid = rows.find((row) => row.uuid === uuid);
	if (rowWithSameUuid) {
		if (
			user.jmeno === rowWithSameUuid.jmeno &&
			user.adresa === rowWithSameUuid.adresa &&
			user.email === rowWithSameUuid.email
		)
			return {
				vs: rowWithSameUuid.variabilni_symbol,
				price: rowWithSameUuid.cena
			};
		else throw Error(`UUID conflict: ${uuid}`);
	}

	const vs = generateSymbol([user.jmeno, user.email, user.adresa], (s) => !usedSymbols.has(s));

	const price =
		secrets.ticketPrice * ticketCount + (hotelRoom ? secrets.hotelRooms[hotelRoom].price : 0);

	await addPurchaseRow({
		uuid,
		...user,
		pocet_vstupenek: ticketCount,
		hotel_room: hotelRoom,
		cena: price,
		vytvoreno: Date.now(),
		variabilni_symbol: vs,
		poznamka: note
	});

	return { vs, price };
};

export const matchTransactions = async (transactions: Transaction[]) => {
	const purchaseRows = await getPurchaseRows();
	const matchedTransactionIds = new Set(purchaseRows.map((r) => r.id_transakce));
	const usedTicketHashes = new Set(purchaseRows.flatMap((p) => p.vstupenky_hash ?? []));
	const mailPromises: Promise<void>[] = [];

	// Find new matches

	let unmatchedTransactions = transactions.filter(
		(t) => !matchedTransactionIds.has(t.transactionId)
	);
	console.log(
		`1/5 Found ${unmatchedTransactions.length} unmatched transactions from a total of ${transactions.length}.`
	);

	const newMatches: [Transaction, PurchaseEntry][] = unmatchedTransactions.flatMap((t) => {
		if (t.currency !== 'CZK' || isNaN(t.variableSymbol)) return [];
		const matchingPurchase = purchaseRows.find((p) => p.variabilni_symbol === t.variableSymbol);
		if (!matchingPurchase) return [];
		if (t.amount < matchingPurchase.cena) return [];

		return [[t, matchingPurchase]];
	});
	const newMatchIds = new Set(newMatches.map(([, p]) => p.uuid));
	console.log(`2/5 Found ${newMatches.length} new matches: ` + [...newMatchIds].join(', '));

	for (const [t, p] of newMatches) {
		const ticketHashes = generujNJmen(p.pocet_vstupenek, (j) => !usedTicketHashes.has(j));
		ticketHashes.forEach((h) => usedTicketHashes.add(h));

		// send ticket via mail
		mailPromises.push(sendTicket(p.jmeno, p.email, p.uuid, ticketHashes));
		console.log('Sending a mail');

		await updatePurchaseRow(
			{ uuid: p.uuid },
			{
				id_transakce: t.transactionId,
				vstupenky_hash: ticketHashes,
				zaplaceno: Date.now()
			}
		);
	}
	console.log(`3/5 Updated the table of purchases.`);

	// Write down the currently unmatched transactions

	unmatchedTransactions = unmatchedTransactions.filter((t) => !newMatches.find(([t2]) => t === t2));
	const unmatchedTransEntries: TransactionEntry[] = unmatchedTransactions.map((t) => ({
		id_transakce: t.transactionId,
		timestamp: Date.now(),
		castka: `${t.currency} ${t.amount.toFixed(2)}`,
		variabilni_symbol: t.variableSymbol,
		ucet: t.counterAccount.account,
		jmeno: t.counterAccount.name
	}));
	await updateTransactionRows(unmatchedTransEntries);
	console.log(`4/5 Updated the table of transactions.`);

	// wait for mails
	if (mailPromises.length > 0) await Promise.all(mailPromises);
	console.log(`5/5 Sent ${mailPromises.length} e-mails.`);

	return newMatchIds;
};
