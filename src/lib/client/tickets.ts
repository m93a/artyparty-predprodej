import type { Readable, Subscriber } from 'svelte/store';
import * as z from 'zod';

const ticketSchema = z.object({
	uuid: z.string(),
	name: z.string().optional(),
	email: z.string().email().optional(),
	vs: z.string().optional(),
	hashes: z.string().array().optional()
});

export type Ticket = z.infer<typeof ticketSchema>;

export const getTickets = (): Ticket[] => {
	try {
		const arr = JSON.parse(localStorage.getItem('tickets') ?? '');
		if (Array.isArray(arr))
			return arr.flatMap((t) => {
				const result = ticketSchema.safeParse(t);
				if (result.success) return [result.data];
				return [];
			});
	} catch (_) {}
	return [];
};

const _subscribers = new Set<Subscriber<Readonly<Ticket[]>>>();
export const tickets: Readable<Readonly<Ticket[]>> = {
	subscribe(s) {
		_subscribers.add(s);
		s(getTickets());
		return () => _subscribers.delete(s);
	}
};

const _setTickets = (ts: Ticket[]) => {
	localStorage.setItem('tickets', JSON.stringify(ts));
	_subscribers.forEach((s) => s(ts));
};

export const updateTicket = (t: Ticket) => {
	const ts = new Map(getTickets().map((t) => [t.uuid, t]));

	const former = ts.get(t.uuid);
	const latter = t;
	const hashes =
		former?.hashes || latter.hashes
			? [...new Set([...(former?.hashes ?? []), ...(t.hashes ?? [])])]
			: undefined;

	const ticket: Ticket = {
		...former,
		...latter,
		hashes
	};
	ts.set(t.uuid, ticket);

	_setTickets([...ts.values()]);
};
