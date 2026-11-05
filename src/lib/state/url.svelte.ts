/**
 * Two-way sync between the explorer state and the query string (`?breed=beagle&t=1830`).
 * Pages are prerendered without a query, so the URL is read only in the browser, once mounted.
 * Call during component initialisation.
 */
import { onMount } from 'svelte';
import { replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { ExploreState } from './explore.svelte.ts';

export function syncWithUrl(state: ExploreState) {
	let ready = $state(false);

	onMount(() => {
		state.applyParams(new URLSearchParams(location.search));
		ready = true;
		const onPop = () => state.applyParams(new URLSearchParams(location.search));
		addEventListener('popstate', onPop);
		return () => removeEventListener('popstate', onPop);
	});

	$effect(() => {
		if (!ready) return;
		const query = state.toParams().toString();
		const current = new URLSearchParams(location.search).toString();
		if (query === current) return;
		const url = new URL(location.href);
		url.search = query;
		replaceState(url, page.state);
	});
}
