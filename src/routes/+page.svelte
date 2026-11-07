<!-- Placeholder until the story (phase 4): title and the two ways in. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { breeds } from '$lib/data';
</script>

<svelte:head>
	<title>Dogtrails · Where dog breeds come from</title>
	<meta name="description" content="An atlas of where dog breeds come from: a genetic tree, a map of origins and a timeline." />
</svelte:head>

<div class="page">
	<p class="eyebrow">An atlas of dog breeds</p>
	<h1>Dogtrails</h1>
	<p class="lede">Where dog breeds come from, read in their DNA. {breeds.length} breeds so far, every fact with its source.</p>
	<p class="links">
		<a class="pill primary" href={resolve('/explore')}>Explore the tree</a>
		<a class="pill" href={resolve('/sources')}>Sources</a>
	</p>
</div>

<style>
	.page {
		max-width: 64ch;
		margin: 0 auto;
		padding: var(--dt-space-9) var(--dt-gutter-mobile);
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
		margin: var(--dt-space-2) 0 var(--dt-space-4);
		font-family: var(--dt-font-serif);
		font-weight: 400;
		font-size: var(--dt-text-display);
		line-height: 0.95;
		color: var(--dt-ink);
	}
	.lede {
		margin: 0;
		font-size: var(--dt-text-lede);
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--dt-space-3);
		margin-top: var(--dt-space-6);
	}
	.pill {
		display: inline-flex;
		align-items: center;
		min-height: var(--dt-hit);
		padding: 0 var(--dt-space-5);
		border: 1px solid var(--dt-line-strong);
		border-radius: var(--dt-radius-pill);
		color: var(--dt-ink);
		text-decoration: none;
		transition: border-color var(--dt-dur-fast) var(--dt-ease);
	}
	.pill:hover,
	.pill:focus-visible {
		border-color: var(--dt-accent-text);
	}
	.primary {
		background: var(--dt-accent);
		border-color: var(--dt-accent);
		color: var(--dt-on-accent);
		font-weight: 600;
	}
</style>
