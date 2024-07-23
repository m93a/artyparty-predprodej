<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types.js';
	import { updateTicket } from '$lib/client/tickets.ts';
	// import { getBackContext } from '$lib/BackContext.svelte';
	// import { onDestroy } from 'svelte';

	export let data: PageData;

	// const onNextPage = (e: Event) => {
	// 	page = 'hotel';
	// 	e.preventDefault();
	// };
	// const onBack = () => {
	// 	if (page === 'hotel') {
	// 		page = 'ticket';
	// 	} else {
	// 		location.href = '/';
	// 	}
	// };

	// const { listen } = getBackContext();
	// onDestroy(listen(onBack));

	// let page: 'ticket' | 'hotel' = 'ticket';

	const { form, constraints, errors, enhance } = superForm(data.form);

	$: $form.uuid = data.uuid;

	const onSubmit = () => {
		console.log('hey');
		updateTicket({
			uuid: $form.uuid,
			name: $form.name,
			email: $form.email
		});
	};
</script>

<h1>Arty Party no. V 2024 - předprodej vstupenek</h1>
<form method="post" use:enhance on:submit={onSubmit}>
	<div>
		<input type="hidden" name="uuid" value={data.uuid} />
		<label>
			Jméno a příjmení
			<input name="name" bind:value={$form.name} {...$constraints.name} />
			<small>{$errors.name ?? ''}</small>
		</label>
		<label>
			E-mail
			<input name="email" type="email" bind:value={$form.email} {...$constraints.email} />
			<small>{$errors.email ?? ''}</small>
		</label>
		<label>
			Ulice a číslo popisné
			<input name="street" bind:value={$form.street} {...$constraints.street} />
			<small>{$errors.street ?? ''}</small>
		</label>
		<label>
			Město
			<input name="city" bind:value={$form.city} {...$constraints.city} />
			<small>{$errors.city ?? ''}</small>
		</label>
		<label>
			PSČ
			<input name="zip" bind:value={$form.zip} {...$constraints.zip} />
			<small>{$errors.zip ?? ''}</small>
		</label>
		<label>
			Počet lístků
			<input
				name="ticketCount"
				type="number"
				bind:value={$form.ticketCount}
				{...$constraints.ticketCount}
			/>
			<small>{$errors.ticketCount ?? ''}</small>
		</label>
		<hr />
		<!-- <span>
			{$form.ticketCount * data.ticketPrice},– Kč
			<button on:click={onNextPage}>Dále!</button>
		</span> -->
	</div>
	<div>
		<span>
			<strong>Budete si přát místo pro stan?</strong>
		</span>
		<label>
			Místo pro stan
			<select name="hotelRoom" bind:value={$form.hotelRoom} {...$constraints.hotelRoom}>
				<option value="">Žádné</option>
				{#each Object.entries(data.freeRooms) as [room, { price, description }]}
					<option value={room}>{room} ({price} Kč) – {description}</option>
				{/each}
			</select>
		</label>
		{#if $form.hotelRoom !== ''}
			<span>
				<strong>Popis místa:</strong>
				{data.freeRooms[$form.hotelRoom]?.description}
			</span>
		{/if}
		<hr />
		<span>
			{$form.ticketCount * data.ticketPrice + (data.freeRooms[$form.hotelRoom]?.price ?? 0)},– Kč
			<button>Koupit!</button>
		</span>
	</div>
</form>

<p>
	Po připsání platby na náš účet Vám na zadaný email Vám přijde elektronická vstupenka s QR kódem.
	Při vstupu na akci jej zkontrolujeme. Veškerá vyplněná osobní data budeme shromažďovat pouze pro
	účely ověření validity vstupenek a po akci budou smazána.
</p>

<p>
	Odesláním souhlasíte s
	<a
		href="https://docs.google.com/document/d/1596Li0ZR5RlexEbuMNEqPA1z0nn6hZoEqC1L753MjWA/edit?usp=sharing"
		target="_blank">obchodními podmínkami</a
	>.
</p>

<style lang="scss">
	label,
	span {
		display: block;
		padding: 0.1em;

		input {
			display: block;
		}
	}

	select {
		width: 5em;
	}

	span {
		padding-top: 0.5em;
	}
</style>
