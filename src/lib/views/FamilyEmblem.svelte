<!-- Constellation of a colour family (docs/DESIGN.md §2): legends, cards, chips. Never drawn on the map. -->
<script lang="ts">
	import type { Family } from '$lib/data/schemas/breeds';
	import { STAR_PATH } from '$lib/data/families';

	let { family }: { family: Family } = $props();

	type Emblem = { lines: { points: string; closed?: boolean }[]; stars: [number, number][]; bright: [number, number]; faint?: [number, number] };

	/** Coordinates of docs/DESIGN.md §2 (viewBox 0 0 120 90); `bright` is the starred point. */
	const emblems: Record<Family, Emblem> = {
		herding: { lines: [{ points: '25,75 25,35 40,18 60,22 66,38' }], stars: [[25, 75], [25, 35], [60, 22], [66, 38]], bright: [40, 18] },
		sighthound: {
			lines: [{ points: '10,60 40,50 75,47 108,52' }, { points: '75,47 86,30' }],
			stars: [[10, 60], [40, 50], [75, 47], [108, 52]],
			bright: [86, 30]
		},
		spitz: { lines: [{ points: '22,75 44,60 70,55 86,40 77,22 60,30' }], stars: [[22, 75], [44, 60], [70, 55], [86, 40], [60, 30]], bright: [77, 22] },
		mastiff: { lines: [{ points: '32,25 86,25 92,68 26,68', closed: true }], stars: [[32, 25], [86, 25], [26, 68]], bright: [92, 68] },
		terrier: { lines: [{ points: '15,62 36,30 57,62 78,30 99,62' }], stars: [[15, 62], [36, 30], [78, 30], [99, 62]], bright: [57, 62] },
		hunting: { lines: [{ points: '14,66 54,48 104,30' }, { points: '54,48 60,74' }], stars: [[14, 66], [54, 48], [60, 74]], bright: [104, 30] },
		companion: { lines: [{ points: '60,22 80,38 72,62 48,62 40,38', closed: true }], stars: [[80, 38], [72, 62], [48, 62], [40, 38]], bright: [60, 22] },
		ancient: { lines: [{ points: '20,68 60,16 100,68', closed: true }], stars: [[20, 68], [100, 68]], bright: [60, 16], faint: [60, 50] }
	};
	const e = $derived(emblems[family]);
</script>

<svg class="emblem fam-{family}" viewBox="0 0 120 90" aria-hidden="true">
	{#each e.lines as l, i (i)}
		{#if l.closed}<polygon points={l.points} />{:else}<polyline points={l.points} />{/if}
	{/each}
	{#each e.stars as [x, y], i (i)}
		<path d={STAR_PATH} transform="translate({x},{y}) scale(0.32)" opacity="0.45" />
	{/each}
	{#if e.faint}
		<path d={STAR_PATH} transform="translate({e.faint[0]},{e.faint[1]}) scale(0.28)" opacity="0.3" />
	{/if}
	<path class="bright" d={STAR_PATH} transform="translate({e.bright[0]},{e.bright[1]}) scale(0.5)" />
</svg>

<style>
	.emblem {
		display: block;
		width: 100%;
		height: auto;
	}
	polyline,
	polygon {
		fill: none;
		stroke: currentColor;
		stroke-width: 1;
		opacity: 0.55;
		vector-effect: non-scaling-stroke;
	}
	path {
		fill: currentColor;
	}
	.bright {
		opacity: 0.65;
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
</style>
