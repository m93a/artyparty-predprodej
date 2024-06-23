import { checkTickets } from '$lib/server/spreadsheet.ts';
import { generateTicketQR } from '$lib/utils.ts';
import type { PageServerLoad } from './$types.d.ts';

export const load = (async (event) => {
	const uuid = event.url.searchParams.get('uuid') ?? '';
	const ticketHashes = await checkTickets(uuid, event.params.hash.split(','));

	const tickets = await Promise.all(
		ticketHashes.map(async ([hash, validity]) => ({
			qr: await generateTicketQR(hash),
			validity,
			hash
		}))
	);

	return {
		uuid,
		tickets
	};
}) satisfies PageServerLoad;
