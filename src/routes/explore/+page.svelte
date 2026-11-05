<script lang="ts">
	import { breeds } from '$lib/data';
	import { ExploreState, setExplore } from '$lib/state/explore.svelte';
	import { syncWithUrl } from '$lib/state/url.svelte';
	import TreeView from '$lib/views/TreeView.svelte';
	import SelectionCard from '$lib/views/SelectionCard.svelte';

	const explore = setExplore(new ExploreState(breeds.map((b) => b.id)));
	syncWithUrl(explore);
</script>

<svelte:head>
	<title>Explore the tree · Dogtrails</title>
	<meta name="description" content="A radial genetic tree of 30 dog breeds (Parker et al. 2017), coloured by family." />
</svelte:head>

<main>
	<header>
		<p class="eyebrow">Explorer</p>
		<h1>The family tree</h1>
		<p class="lede">Thirty breeds placed by their DNA, after Parker et al. (2017). Light a branch to see who stands with whom.</p>
	</header>
	<div class="layout">
		<TreeView />
		<aside><SelectionCard /></aside>
	</div>
</main>

<style>
	main {
		max-width: 1360px;
		margin: 0 auto;
		padding: var(--dt-space-6) var(--dt-gutter-mobile) var(--dt-space-8);
	}
	header {
		max-width: 64ch;
		margin-bottom: var(--dt-space-5);
	}
	.eyebrow {
		margin: 0;
		font-size: var(--dt-text-label);
		font-weight: 600;
		letter-spacing: var(--dt-tracking-label);
		text-transform: uppercase;
		color: var(--dt-accent-text);
	}
	h1 {
		margin: var(--dt-space-2) 0;
		font-family: var(--dt-font-serif);
		font-weight: 400;
		font-size: var(--dt-text-h1);
		line-height: 1;
		color: var(--dt-ink);
	}
	.lede {
		margin: 0;
		font-size: var(--dt-text-lede);
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--dt-space-6);
	}
	@media (min-width: 1024px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 340px;
			align-items: start;
		}
		aside {
			position: sticky;
			top: var(--dt-space-5);
		}
	}
</style>
