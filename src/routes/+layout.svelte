<script lang="ts">
	import '@fontsource/instrument-serif/400.css';
	import '@fontsource/instrument-serif/400-italic.css';
	import '@fontsource-variable/dm-sans/opsz.css';
	import '$lib/styles/tokens.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(body) {
		margin: 0;
		background: var(--dt-bg);
		color: var(--dt-ink-2);
		font-family: var(--dt-font-sans);
		font-size: var(--dt-text-body);
		line-height: 1.6;
	}
</style>
