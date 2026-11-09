<!--
	Static excerpt of the radial tree for a breed page: the breed's branch lit, the rest in the shadow.
	Same geometry as TreeView (tree-layout.ts, weak groupings merged), no labels, no interaction:
	the picture is decorative and the page gives the same reading as text with links.
	It is prerendered on every breed page, so what lies in the shadow is merged into a few paths.
-->
<script lang="ts">
	import { STAR_PATH } from '$lib/data/families';
	import type { Family } from '$lib/data/schemas/breeds';
	import { isLit, polar, type TreeLayout } from './tree-layout.ts';

	let { layout, breedId }: { layout: TreeLayout; breedId: string } = $props();

	const pad = 24;
	const r = $derived(layout.radius + pad);
	const focus = $derived(layout.leaves.filter((l) => l.breed.id === breedId).map((l) => l.key));
	const lit = (key: string) => focus.some((f) => isLit(key, f));

	// rendered on each of the breed pages: everything in the shadow is merged into a few paths
	const STAR = [...STAR_PATH.matchAll(/-?[\d.]+,-?[\d.]+/g)].map((m) => m[0].split(',').map(Number));
	const starAt = (x: number, y: number, s: number) =>
		'M' + STAR.map(([px, py]) => `${Math.round((x + px * s) * 10) / 10},${Math.round((y + py * s) * 10) / 10}`).join('L') + 'Z';

	const shadowLinks = $derived(layout.links.filter((l) => !lit(l.key)).map((l) => l.d).join(''));
	const litLinks = $derived(layout.links.filter((l) => lit(l.key)).map((l) => l.d).join(''));
	const cladeArcs = $derived(layout.clades.map((c) => c.d).join(''));
	const shadowStars = $derived.by(() => {
		const byFamily = new Map<Family, string>();
		for (const l of layout.leaves) {
			if (focus.includes(l.key)) continue;
			const [x, y] = polar(l.x, l.y);
			byFamily.set(l.family, (byFamily.get(l.family) ?? '') + starAt(x, y, 0.55));
		}
		return [...byFamily];
	});
	const chosen = $derived(layout.leaves.filter((l) => focus.includes(l.key)));
</script>

<svg class="excerpt" viewBox="{-r} {-r} {2 * r} {2 * r}" aria-hidden="true">
	<path class="clades" d={cladeArcs} />
	<path class="links" d={shadowLinks} />
	<path class="links lit" d={litLinks} />
	{#each shadowStars as [family, d] (family)}
		<path class="star fam-{family}" d={d} />
	{/each}
	{#each chosen as leaf (leaf.key)}
		{@const [x, y] = polar(leaf.x, leaf.y)}
		<g class="leaf on fam-{leaf.family}" transform="translate({x},{y})">
			<circle class="halo" r="14" />
			<circle class="ring" r="10" />
			<path class="star" d={STAR_PATH} transform="scale(0.65)" />
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
	.clades {
		fill: var(--dt-ink-3);
		opacity: 0.4;
	}
	.links {
		fill: none;
		stroke: var(--dt-ink-3);
		stroke-width: 1.4;
		stroke-linecap: round;
		opacity: 0.35;
	}
	.links.lit {
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
