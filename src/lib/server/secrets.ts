import * as z from 'zod';

const secretsSchema = z.object({
	spreadsheetId: z.string(),
	serviceAccountKey: z.object({
		type: z.string(),
		project_id: z.string(),
		private_key_id: z.string(),
		private_key: z.string(),
		client_email: z.string().email(),
		client_id: z.string(),
		auth_uri: z.string().url(),
		token_uri: z.string().url(),
		auth_provider_x509_cert_url: z.string().url(),
		client_x509_cert_url: z.string().url()
	}),
	bankToken: z.string(),
	iban: z.string(),
	accountNumber: z.string(),
	ticketPrice: z.number().gt(0),
	hotelRooms: z.record(
		z.object({
			price: z.number(),
			description: z.string()
		})
	),
	mail: z.object({
		address: z.string().email(),
		host: z.string(),
		auth: z.object({
			user: z.string(),
			pass: z.string()
		})
	}),
	cronJobToken: z.string().uuid(),
	ticketCheckToken: z.string().uuid()
});

if (!process.env.secrets) throw Error('Please set the `secrets` env var.');
export default secretsSchema.parse(JSON.parse(process.env.secrets));
