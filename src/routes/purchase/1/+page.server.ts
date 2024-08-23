import * as z from 'zod';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import type { PageServerLoad, Actions } from './$types.d.ts';
import { fail, redirect } from '@sveltejs/kit';
import { generateUuid, getFreeHotelRooms, newPurchase } from '$lib/server/spreadsheet.ts';
import secrets from '$lib/server/secrets.ts';

const formSchema = z
	.object({
		uuid: z.string().uuid('Nečekaná chyba, prosím znovu načtěte stránku'),
		name: z.string().min(1, 'Prosím vyplňte vaše jméno').trim(),
		street: z.string().min(1, 'Prosím vyplňte vaši adresu').trim(),
		zip: z
			.string()
			.regex(/^(\s*\d\s*){5}$/, 'Neplatné PSČ, musí být pět číslic')
			.transform((s) => s.replaceAll(/\s/g, '')),
		city: z.string().min(1, 'Prosím vyplňte město').trim(),
		email: z.string().email('Neplatná e-mailová adresa').min(1),
		ticketCount: z
			.number()
			.int('Musíte koupit celočíselný počet lístků!')
			.min(0, 'Počet lístků musí být nezáporný!')
			.default(1),
		hotelRoom: z
			.enum<string, any>(Object.keys(secrets.hotelRooms), {
				invalid_type_error: 'Neznámá parcela pro stan.'
			})
			.optional(),
		note: z.string().optional()
	})
	.refine(
		({ ticketCount, hotelRoom }) => ticketCount > 0 || hotelRoom !== undefined,
		'Není možné odeslat prázdnou vstupenku – musíte si buďto koupit lístek, anebo místo pro stan.'
	);

export const load = (async (event) => {
	const form = await superValidate(zod(formSchema));
	const uuid = await generateUuid();
	const ticketPrice = secrets.ticketPrice;
	const freeRooms = Object.fromEntries(
		(await getFreeHotelRooms()).map((r) => [r, secrets.hotelRooms[r]])
	);

	return {
		uuid,
		form,
		freeRooms,
		ticketPrice
	};
}) satisfies PageServerLoad;

export const actions = {
	default: async ({ request }) => {
		throw 'Předprodej ukončen';
		const form = await superValidate(request, zod(formSchema));

		if (!form.valid) {
			return fail(400, {
				form
			});
		}

		const uuid = form.data.uuid;
		const ticketCount = form.data.ticketCount;
		const { vs } = await newPurchase(
			uuid,
			ticketCount,
			form.data.hotelRoom,
			{
				jmeno: form.data.name,
				adresa: `${form.data.street}\n${form.data.zip} ${form.data.city}`,
				email: form.data.email
			},
			form.data.note
		).catch(() => {
			throw redirect(303, `/?error=uuid-mismatch`);
		});

		throw redirect(303, `/purchase/2?vs=${vs}&uuid=${uuid}`);
	}
} satisfies Actions;
