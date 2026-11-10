<!-- Shown by build/404.html (the adapter-static fallback, served by the host for any unknown path). -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const missing = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{missing ? 'Page not found' : 'Error'} · Dogtrails</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
	<p class="eyebrow">{page.status}</p>
	<h1>{missing ? 'No trail leads here' : 'Something went wrong'}</h1>
	<p class="lede">
		{missing ? 'This page does not exist, or no longer does.' : (page.error?.message ?? 'The page could not be shown.')}
	</p>
	<p class="links">
		<a class="pill primary" href={resolve('/explore')}>Explore the tree</a>
		<a class="pill" href={resolve('/')}>Home</a>
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
		font-size: var(--dt-text-h1);
		line-height: 1;
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
