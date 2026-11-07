<script lang="ts">
	import '@fontsource/instrument-serif/400.css';
	import '@fontsource/instrument-serif/400-italic.css';
	import '@fontsource-variable/dm-sans/opsz.css';
	import '$lib/styles/tokens.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { children } = $props();

	const links = [
		{ href: resolve('/explore'), label: 'Explore', match: '/explore' },
		{ href: resolve('/sources'), label: 'Sources', match: '/sources' }
	];
	const current = (match: string) => page.url.pathname === match || page.url.pathname.startsWith(match + '/');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a class="skip" href="#main">Skip to content</a>
<header class="site">
	<nav aria-label="Site">
		<a class="brand" href={resolve('/')} aria-current={page.url.pathname === '/' ? 'page' : undefined}>Dogtrails</a>
		<ul>
			{#each links as l (l.href)}
				<li><a href={l.href} aria-current={current(l.match) ? 'page' : undefined}>{l.label}</a></li>
			{/each}
		</ul>
	</nav>
</header>

<main id="main" tabindex="-1">
	{@render children()}
</main>

<style>
	:global(body) {
		margin: 0;
		background: var(--dt-bg);
		color: var(--dt-ink-2);
		font-family: var(--dt-font-sans);
		font-size: var(--dt-text-body);
		line-height: 1.6;
	}
	main:focus {
		outline: none;
	}
	.skip {
		position: absolute;
		left: var(--dt-space-4);
		top: -100px;
		z-index: 10;
		display: inline-flex;
		align-items: center;
		min-height: var(--dt-hit);
		padding: 0 var(--dt-space-4);
		border-radius: var(--dt-radius-pill);
		background: var(--dt-accent);
		color: var(--dt-on-accent);
		font-weight: 600;
	}
	.skip:focus {
		top: var(--dt-space-2);
	}
	.site {
		border-bottom: 1px solid var(--dt-line);
	}
	nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--dt-space-4);
		max-width: 1360px;
		margin: 0 auto;
		padding: 0 var(--dt-gutter-mobile);
	}
	ul {
		display: flex;
		gap: var(--dt-space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	nav a {
		display: inline-flex;
		align-items: center;
		min-height: var(--dt-hit);
		padding: 0 var(--dt-space-3);
		color: var(--dt-ink-2);
		text-decoration: none;
		font-size: var(--dt-text-small);
		border-bottom: 2px solid transparent;
		transition:
			color var(--dt-dur-fast) var(--dt-ease),
			border-color var(--dt-dur-fast) var(--dt-ease);
	}
	nav a:hover,
	nav a:focus-visible {
		color: var(--dt-ink);
	}
	nav a:focus-visible {
		outline: 2px solid var(--dt-accent-text);
		outline-offset: -2px;
	}
	nav a[aria-current='page'] {
		color: var(--dt-ink);
		border-bottom-color: var(--dt-accent);
	}
	.brand {
		padding-left: 0;
		font-family: var(--dt-font-serif);
		font-size: 24px;
		color: var(--dt-ink);
	}
</style>
