import { createTransport } from 'nodemailer';
import secrets from '$lib/server/secrets.ts';
import { generateTicketQR } from '$lib/utils.ts';
import type { Attachment } from 'nodemailer/lib/mailer/';

export async function sendTicket(name: string, address: string, uuid: string, hashes: string[]) {
	const qrCodes = await Promise.all(hashes.map(generateTicketQR));
	const cids = hashes.map(
		(hash) => `${hash.replace('-', '')}${Math.floor(10_000 * Math.random())}@artyparty.csha.io`
	);

	const instructions = `Vstupenka je přenositelná, z důvodu vaší ochrany je však potřeba vědět, na který email je zaregistrována.
U vstupu na akci se prokážete přiloženým QR kódem, který lze použít pouze jednou.

ArtyParty se koná 24. 8. 2024 od 12:00 na letišti v Hradci Králové.
GPS: 50.2384544N, 15.8404975E
Prosíme, nedopravujte se na místo autem. 3 minuty chůze od areálu je autobusová zastávka Letiště, kam jezdí mhd č.15.
Případně můžete využít bike-sharingové služby Nextbike. Nejbližší stanice pro zaparkování kola je SŠSOG na Pouchově s evidenčním číslem 47644.

Vstupem na akci se zavazujete, že budete dodržovat stanovená pravidla akce. Pořadatel si vyhrazuje právo vykázat z akce účastníky, kteří budou i po prvním napomenutí pravidla porušovat bez nároku na vrácení vstupného.

Pravidla akce:
Každý návštěvník festivalu obdrží po předložení vstupenky identifikační placku, která ho opravňuje ke vstupu do areálu.
Pokud dojde ke ztrátě placky, neprodleně informujte organizátory akce na vstupu.
Na místě je možnost postavit si stan, pouze však v organizátorem vyznačeném plácku.
Obsluha baru může požadovat občanský průkaz při prodeji věkem regulovaného zboží.
Je zakázáno jakkoliv projevovat nenávist k jednotlivcům i skupinám.
V areálu festivalu budou od 12:00 do 16:30 vyhrazeny kuřácké zóny, které se vztahují i na vapes, iqos i další alternativy cigaret.
Při vzniku jakýchkoliv nepříjemných situací a sporů informujte organizátory akce na vstupu, rádi situaci vyhodnotí a následně vyřeší.

V případě jakýchkoliv nejasností, technických problémů, nebo reklamace, použijte kontaktní email crew.artyparty@gmail.com

Těšíme se na vás 24. srpna.
Vaše ArtyParty Crew.`;

	const text =
		'Děkujeme za zakoupení vstupenky!' +
		hashes.map((hash, i) => `\n\nVstupenka č. ${i + 1}: ${hash}`).join('') +
		'\n\n' +
		instructions;

	const html =
		'<h2>Děkujeme za zakoupení vstupenky!</h2>' +
		hashes
			.map(
				(hash, i) => `
          <h3>Vstupenka č. ${i + 1}</h3>
          <p>Kód: <a href="https://artyparty.csha.io/ticket/${hash}?uuid=${uuid}">${hash}</a></p>
          <img alt="${hash}" src="cid:${cids[i]}">
        `
			)
			.join('') +
		'<br/><br/>' +
		instructions.replaceAll('\n', '<br/>');

	const transporter = createTransport({
		...secrets.mail
	});
	await transporter.sendMail({
		from: {
			name: 'Artyparty Bot',
			address: secrets.mail.address
		},
		to: { name, address },
		subject: 'Vstupenka na Artyparty',
		text,
		html,
		attachments: qrCodes.map(
			(qr, i): Attachment => ({
				path: qr,
				cid: cids[i]
			})
		)
	});
}
