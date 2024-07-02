<script lang="ts" context="module">
	import { createContext } from 'svelte-create-context';
	import type { Unsubscriber } from 'svelte/store';

	export interface BackContext {
		listen(f: () => void): Unsubscriber;
		listeners: ReadonlySet<() => void>;
	}

	const { get, setup } = createContext<BackContext>();
	export { get as getBackContext };
</script>

<script lang="ts">
	const listeners = new Set<() => void>();
	const listen = (f: () => void) => {
		listeners.add(f);
		return () => listeners.delete(f);
	};
	setup({
		listen,
		listeners
	});
</script>

<slot />
