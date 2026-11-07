<!--
	Static excerpt of the radial tree for a breed page: the breed's branch lit, the rest in the shadow.
	Same geometry as TreeView (tree-layout.ts, weak groupings merged), no labels, no interaction:
	the picture is decorative and the page gives the same reading as text with links.
-->
<script lang="ts">
	import { STAR_PATH } from '$lib/data/families';
	import { isLit, polar, type TreeLayout } from './tree-layout.ts';

	let { layout, breedId }: { layout: TreeLayout; breedId: string } = $props();

	const pad = 24;
	const r = $derived(layout.radius + pad);
	const focus = $derived(layout.leaves.filter((l) => l.breed.id === breedId).map((l) => l.key));
	const lit = (key: string) => focus.some((f) => isLit(key, f));
</script>

<svg class="excerpt" viewBox="{-r} {-r} {2 * r} {2 * r}" aria-hidden="true">
	<g class="clades">
		{#each layout.clades as c, i (i)}
			{#if c.leaves > 1}<path d={c.d} />{/if}
		{/each}
	</g>
	<g class="links">
		{#each layout.links as link (link.key)}
			<path d={link.d} class:lit={lit(link.key)} />
		{/each}
	</g>
	{#each layout.leaves as leaf (leaf.key)}
		{@const [x, y] = polar(leaf.x, leaf.y)}
		{@const on = focus.includes(leaf.key)}
		<g class="leaf fam-{leaf.family}" class:on transform="translate({x},{y})">
			{#if on}
				<circle class="halo" r="14" />
				<circle class="ring" r="10" />
			{/if}
			<path class="star" d={STAR_PATH} transform="scale({on ? 0.65 : 0.55})" />
		</g>
	{/each}
</svg>

<style>
	.excerpt {
		display: block;
		width: 100%;
		height: auto;
	}
	.fam-herding { color: var(--dt-fam-herding); }
	.fam-sighthound { color: var(--dt-fam-sighthound); }
	.fam-spitz { color: var(--dt-fam-spitz); }
	.fam-mastiff { color: var(--dt-fam-mastiff); }
	.fam-terrier { color: var(--dt-fam-terrier); }
	.fam-hunting { color: var(--dt-fam-hunting); }
	.fam-companion { color: var(--dt-fam-companion); }
	.fam-ancient { color: var(--dt-fam-ancient); }
	.clades path {
		fill: var(--dt-ink-3);
		opacity: 0.4;
	}
	.links path {
		fill: none;
		stroke: var(--dt-ink-3);
		stroke-width: 1.4;
		stroke-linecap: round;
		opacity: 0.35;
	}
	.links path.lit {
		stroke: var(--dt-accent-text);
		stroke-width: 2.6;
		opacity: 1;
	}
	.star {
		fill: var(--dt-star-shadow);
		opacity: var(--dt-star-shadow-opacity);
	}
	.on .star {
		fill: currentColor;
		opacity: 1;
		stroke: var(--dt-star-stroke);
		stroke-width: 0.7;
		vector-effect: non-scaling-stroke;
	}
	.halo {
		fill: var(--dt-accent);
		opacity: calc(0.2 + 0.25 * var(--dt-star-glow));
		filter: blur(calc(var(--dt-star-glow) * 4px));
	}
	.ring {
		fill: none;
		stroke: var(--dt-select-ring);
		stroke-width: 1.2;
		stroke-dasharray: 1 3;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}
</style>
