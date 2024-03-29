import * as z from 'zod';
import { superValidate } from 'sveltekit-superforms/server';
import type { PageServerLoad, Actions } from './$types.d.ts';
import { fail, redirect } from '@sveltejs/kit';
import { generateUuid, newPurchase } from '$lib/server/spreadsheet.ts';
import secrets from '$lib/server/secrets.ts';

const formSchema = z.object({
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
		.min(1, 'Musíte koupit alespoň jeden lístek!')
		.int('Musíte koupit celočíselný počet lístků!')
		.default(1)
});

export const load = (async (event) => {
	const form = await superValidate(event, formSchema);
	const uuid = await generateUuid();
	const ticketPrice = secrets.ticketPrice;

	return {
		uuid,
		form,
		ticketPrice
	};
}) satisfies PageServerLoad;

export const actions = {
	default: async (event) => {
		const form = await superValidate(event, formSchema);

		if (!form.valid) {
			return fail(400, {
				form,
			});
		}

		const uuid = form.data.uuid;
		const ticketCount = form.data.ticketCount;
		const { vs } = await newPurchase(uuid, ticketCount, {
			jmeno: form.data.name,
			adresa: `${form.data.street}\n${form.data.zip} ${form.data.city}`,
			email: form.data.email
		}).catch(() => {
			throw redirect(303, `/?error=uuid-mismatch`);
		});

		throw redirect(303, `/purchase/2?vs=${vs}&uuid=${uuid}`);
	}
} satisfies Actions;
