<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { updateTicket } from '$lib/client/tickets.ts';
	import type { PageData } from './$types.d.ts';

	export let data: PageData;

	$: {
		const { uuid, vs } = data;
		if (uuid && browser) updateTicket({ uuid, vs: String(vs) });
	}

	onMount(() => {
		setTimeout(() => location.reload(), 10_000);
	});
</script>

<h2>Instrukce pro platbu</h2>
<p>
	<img src={data.qr} alt="" />
</p>
<table>
	<tr>
		<td class="strong">Číslo účtu:</td>
		<td>{data.accountNumber}</td>
	</tr>
	<tr>
		<td class="strong">Částka:</td>
		<td>{data.amount?.toFixed(0)},– Kč</td>
	</tr>
	<tr>
		<td class="strong">Variabilní symbol:</td>
		<td>{data.vs}</td>
	</tr>
</table>
<p>
	(Pokud jste již zaplatili, prosím počkejte na této stránce. Ověření platby většinou trvá méně než
	5 minut. V případě problémů s platbou nás kontaktujte na crew.artyparty@gmail.com)
</p>

<style lang="scss">
	.strong {
		font-weight: bold;
		padding-right: 1em;
	}
</style>
