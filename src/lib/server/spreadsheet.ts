import { GoogleSpreadsheet } from 'google-spreadsheet';
import { v4 as uuidv4, validate as isValidUuid } from 'uuid';

import { generateSymbol, mapOpt, setMinus } from '$lib/utils.ts';
import type { Transaction } from './bank.ts';

import secrets from '$lib/server/secrets.ts';
import { z } from 'zod';
import { generujNJmen } from '$lib/jmena.ts';

const doc = new GoogleSpreadsheet(secrets.spreadsheetId);
await doc.useServiceAccountAuth(secrets.serviceAccountKey);
await doc.loadInfo();
const purchaseSheet = doc.sheetsByTitle['listky'];
const transactionSheet = doc.sheetsByTitle['neprirazene_transakce'];

export interface UserInfo {
	jmeno: string;
	email: string;
	adresa: string;
}
interface PurchaseEntry extends UserInfo {
	uuid: string;

	vytvoreno: number;
	zaplaceno?: number;
	pouzito?: number;

	cena: number;
	pocet_vstupenek: number;
	variabilni_symbol: number;
	id_transakce?: number;
	vstupenky_hash?: string[];
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
	const rows = await purchaseSheet.getRows();
	return rows.map((r) => ({
		uuid: r['uuid'],

		jmeno: r['jmeno'],
		email: r['email'],
		adresa: r['adresa'],

		vytvoreno: +r['vytvoreno'],
		zaplaceno: toOptNum(r['zaplaceno']),
		pouzito: toOptNum(r['pouzito']),

		cena: +r['cena'],
		pocet_vstupenek: +r['pocet_vstupenek'],
		variabilni_symbol: +r['variabilni_symbol'],
		id_transakce: toOptNum(r['id_transakce']),
		vstupenky_hash: toStrArr(r['vstupenky_hash'])
	}));
};

export const getPurchaseByUuid = async (uuid: string): Promise<PurchaseEntry | undefined> => {
	if (!isValidUuid(uuid)) return undefined;
	const rows = await getPurchaseRows();
	return rows.find((row) => row.uuid === uuid);
};

export const generateUuid = async () => {
	const rows = await purchaseSheet.getRows();
	const used = new Set(rows.map((r) => r['uuid']));

	let uuid: string;
	do {
		uuid = uuidv4();
	} while (used.has(uuid));

	return uuid;
};

const addPurchaseRow = (entry: Readonly<PurchaseEntry>) =>
	purchaseSheet.addRow({
		...entry,
		vstupenky_hash: entry.vstupenky_hash?.join(', ') ?? ''
	});

const updatePurchaseRow = async (
	which: Partial<Readonly<PurchaseEntry>>,
	edit: Partial<Readonly<PurchaseEntry>>
) => {
	const rows = await purchaseSheet.getRows();
	const row = rows.find((r) =>
		Object.entries(which).every(([key, value]) => r[key] === String(value))
	);
	if (row === undefined) throw new Error('Could not find the row');

	for (const [key, value] of Object.entries(edit)) {
		row[key] = Array.isArray(value) ? value.join(', ') : value;
	}

	await row.save();
};

const getTransactionRows = async (): Promise<TransactionEntry[]> => {
	const rows = await transactionSheet.getRows();
	return rows.map((r) => ({
		id_transakce: +r['id_transakce'],
		timestamp: +r['timestamp'],
		castka: r['castka'],
		variabilni_symbol: +r['variabilni_symbol'],
		ucet: r['ucet'],
		jmeno: r['jmeno']
	}));
};

const updateTransactionRows = async (transactions: Readonly<TransactionEntry>[]) => {
	const rows = await transactionSheet.getRows();

	const oldIds = new Set(rows.map((r) => +r['id_transakce']));
	const newIds = new Set(transactions.map((t) => t.id_transakce));

	const deleteIds = setMinus(oldIds, newIds);
	const addIds = setMinus(newIds, oldIds);

	for (const id of deleteIds) await rows.find((r) => +r['id_transakce'] === id)?.delete();
	await transactionSheet.addRows(transactions.filter((t) => addIds.has(t.id_transakce)));
};

/**
 * @returns the generated unique variable symbol
 * @throws on UUID conflict
 */
export const newPurchase = async (
	uuid: string,
	ticketCount: number,
	user: UserInfo
): Promise<{ vs: number; price: number }> => {
	z.number().int().positive().parse(ticketCount);

	const [rows, transactionRows] = await Promise.all([getPurchaseRows(), getTransactionRows()]);

	const usedSymbols = new Set([
		...rows.map((r) => r.variabilni_symbol),
		...transactionRows.map((t) => t.variabilni_symbol)
	]);

	const rowWithSameUuid = rows.find((row) => row.uuid === uuid);
	if (rowWithSameUuid) {
		console.log(uuid, rowWithSameUuid);
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
	const price = secrets.ticketPrice * ticketCount;
	await addPurchaseRow({
		uuid,
		...user,
		pocet_vstupenek: ticketCount,
		cena: price,
		vytvoreno: Date.now(),
		variabilni_symbol: vs
	});

	return { vs, price };
};

export const matchTransactions = async (transactions: Transaction[]) => {
	const purchaseRows = await getPurchaseRows();
	const matchedTransactionIds = new Set(purchaseRows.map((r) => r.id_transakce));
	
	const usedTicketHashes = new Set(purchaseRows.flatMap(p => p.vstupenky_hash ?? []));

	// Find new matches

	let unmatchedTransactions = transactions.filter(
		(t) => !matchedTransactionIds.has(t.transactionId)
	);
	const newMatches: [Transaction, PurchaseEntry][] = unmatchedTransactions.flatMap((t) => {
		if (t.currency !== 'CZK' || isNaN(t.variableSymbol)) return [];
		const matchingPurchase = purchaseRows.find((p) => p.variabilni_symbol === t.variableSymbol);
		if (!matchingPurchase) return [];
		if (t.amount < matchingPurchase.cena) return [];

		return [[t, matchingPurchase]];
	});
	for (const [t, p] of newMatches) {
		const ticketHashes = generujNJmen(p.pocet_vstupenek, j => !usedTicketHashes.has(j));
		await updatePurchaseRow({ uuid: p.uuid }, {
			id_transakce: t.transactionId,
			vstupenky_hash: ticketHashes,
			zaplaceno: Date.now()
		})
	}
	const newMatchIds = new Set(newMatches.map(([, p]) => p.uuid));

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
	updateTransactionRows(unmatchedTransEntries);

	return newMatchIds;
};
