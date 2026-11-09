<!-- Minimal card of the selected breed: name, origin, family and clade, sources. Reads the store only. -->
<script lang="ts">
	import { breedById } from '$lib/data';
	import { families, STAR_PATH } from '$lib/data/families';
	import { getExplore } from '$lib/state/explore.svelte';
	import { resolve } from '$app/paths';

	const explore = getExplore();
	const breed = $derived(explore.selectedBreed ? breedById.get(explore.selectedBreed) : undefined);
	/** Parker 2017 names of the entries drawn in the tree, when they differ from the site name. */
	const parkerNames = $derived(
		breed?.parker.entries.filter((e) => e.inTree && e.name !== breed.names.en).map((e) => e.name) ?? []
	);
</script>

<section class="card" aria-live="polite" aria-labelledby="card-title">
	{#if breed}
		<p class="eyebrow">
			<svg class="fam-{breed.family.id}" viewBox="-10 -10 20 20" aria-hidden="true"><path d={STAR_PATH} /></svg>
			{families[breed.family.id].label}
		</p>
		<h2 id="card-title">{breed.names.en}</h2>
		{#if parkerNames.length}
			<p class="aside">In Parker et al. 2017 as {parkerNames.join(', ')}</p>
		{/if}
		<dl>
			<dt>Origin</dt>
			<dd class="place">{breed.origin?.place.label ?? 'Not yet sourced'}</dd>
			<dt>Clade</dt>
			<dd>{breed.parker.clade ?? 'None in Parker 2017'}{breed.parker.cladeLowSupport ? ' (low support)' : ''}</dd>
		</dl>
		<p class="more"><a href={resolve('/breed/[id]', { id: breed.id })}>Open the {breed.names.en} page</a></p>
		<h3>Sources</h3>
		<ul class="sources">
			{#each breed.sources as s (s.id)}
				<li>
					{#if s.url}<a href={s.url} rel="external noopener">{s.citation}</a>{:else}{s.citation}{/if}
				</li>
			{/each}
		</ul>
		<button type="button" onclick={() => explore.clearSelection()}>Back to the whole tree</button>
	{:else}
		<h2 id="card-title">Choose a star</h2>
		<p class="aside">Hover a branch to light it, select a breed to read its card. Keyboard: Tab to the tree, then the arrow keys.</p>
	{/if}
</section>

<style>
	.card {
		background: var(--dt-surface-raised);
		border: 1px solid var(--dt-line);
		border-radius: var(--dt-radius-md);
		padding: var(--dt-space-5);
		color: var(--dt-ink-2);
	}
	.eyebrow {
		display: flex;
		align-items: center;
		gap: var(--dt-space-2);
		margin: 0;
		font-size: var(--dt-text-label);
		font-weight: 600;
		letter-spacing: var(--dt-tracking-label);
		text-transform: uppercase;
		color: var(--dt-ink-3);
	}
	.eyebrow svg {
		width: 14px;
		height: 14px;
	}
	.eyebrow path {
		fill: currentColor;
		stroke: var(--dt-star-stroke);
		stroke-width: 0.7;
		vector-effect: non-scaling-stroke;
	}
	.fam-herding { color: var(--dt-fam-herding); }
	.fam-sighthound { color: var(--dt-fam-sighthound); }
	.fam-spitz { color: var(--dt-fam-spitz); }
	.fam-mastiff { color: var(--dt-fam-mastiff); }
	.fam-terrier { color: var(--dt-fam-terrier); }
	.fam-hunting { color: var(--dt-fam-hunting); }
	.fam-companion { color: var(--dt-fam-companion); }
	.fam-ancient { color: var(--dt-fam-ancient); }
	h2 {
		margin: var(--dt-space-2) 0 var(--dt-space-1);
		font-family: var(--dt-font-serif);
		font-weight: 400;
		font-size: var(--dt-text-h3);
		line-height: 1.15;
		color: var(--dt-ink);
	}
	h3 {
		margin: var(--dt-space-5) 0 var(--dt-space-2);
		font-size: var(--dt-text-label);
		font-weight: 600;
		letter-spacing: var(--dt-tracking-label);
		text-transform: uppercase;
		color: var(--dt-ink-3);
	}
	.aside {
		margin: 0;
		font-size: var(--dt-text-small);
		color: var(--dt-ink-3);
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--dt-space-1) var(--dt-space-4);
		margin: var(--dt-space-4) 0 0;
	}
	dt {
		color: var(--dt-ink-3);
		font-size: var(--dt-text-small);
	}
	dd {
		margin: 0;
	}
	.place {
		font-family: var(--dt-font-serif);
		font-style: italic;
		font-size: 18px;
		color: var(--dt-place);
	}
	.sources {
		margin: 0;
		padding-left: var(--dt-space-4);
		font-size: var(--dt-text-small);
	}
	.sources li + li {
		margin-top: var(--dt-space-1);
	}
	a {
		color: var(--dt-accent-text);
	}
	.more {
		margin: var(--dt-space-3) 0 0;
	}
	.more a {
		display: inline-flex;
		align-items: center;
		min-height: var(--dt-hit);
		font-weight: 500;
	}
	button {
		margin-top: var(--dt-space-5);
		min-height: var(--dt-hit);
		padding: 0 var(--dt-space-5);
		border: 1px solid var(--dt-line-strong);
		border-radius: var(--dt-radius-pill);
		background: transparent;
		color: var(--dt-ink);
		font: inherit;
		font-size: var(--dt-text-small);
		cursor: pointer;
		transition: border-color var(--dt-dur-fast) var(--dt-ease);
	}
	button:hover,
	button:focus-visible {
		border-color: var(--dt-accent-text);
	}
</style>
