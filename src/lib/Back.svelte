<script lang="ts">
	import _Fa from 'svelte-fa';
	import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
	import { browser } from '$app/environment';
	import { getBackContext } from './BackContext.svelte';
	import { page } from '$app/stores';
	const Fa = _Fa as any;

	let { listeners } = getBackContext();
	const onClick = (e: Event) => {
		if (listeners.size > 0) {
			for (const f of listeners) f();
			e.preventDefault();
		}
	};
	setInterval(() => {
		listeners = listeners; // retrigger reactivity
	}, 500);

	$: show = $page.route.id !== '/';
	$: modified = listeners.size > 0;

	const isOnTicketCheckPage = browser && window.location.pathname.startsWith('/check-ticket');
	const href = isOnTicketCheckPage ? `/check-ticket${window.location.search}` : '/';
</script>

<a
	{href}
	aria-label={modified ? 'Zpět' : 'Zpět na hlavní stránku'}
	aria-hidden={show}
	on:click={onClick}
	style:display={show ? 'unset' : 'none'}
>
	<Fa icon={faArrowLeft} />
</a>
