<!--
	Radial dendrogram of the Parker 2017 sample. D3 computes (tree-layout.ts), Svelte renders.
	Reads the explorer store, writes only through its actions. Never talks to the other views.
-->
<script lang="ts">
	import { tree, breedByAbbrev } from '$lib/data';
	import { families, STAR_PATH } from '$lib/data/families';
	import { getExplore } from '$lib/state/explore.svelte';
	import { isLit, layoutTree, polar, LOW_SUPPORT, type LayoutLeaf, type LayoutNode } from './tree-layout.ts';

	const explore = getExplore();
	const layout = layoutTree(tree, (a) => breedByAbbrev.get(a));
	const half = layout.size / 2;

	/** Leaves of each breed (a breed split across subtrees has several). */
	const leavesByBreed = new Map<string, LayoutLeaf[]>();
	for (const l of layout.leaves) leavesByBreed.set(l.breed.id, [...(leavesByBreed.get(l.breed.id) ?? []), l]);

	/** Rendered width, to keep pointer targets at 44 CSS px whatever the scale. */
	let width = $state(0);
	const unitsPerPx = $derived(width > 0 ? layout.size / width : 1);
	const hitR = $derived(22 * unitsPerPx);

	/** Keys of the nodes in the light: the hovered branch or breed, else the selected breed. */
	const focus = $derived.by((): string[] => {
		const h = explore.hovered;
		if (h?.kind === 'branch') return [h.id];
		const id = h?.kind === 'breed' ? h.id : explore.selectedBreed;
		return id ? (leavesByBreed.get(id) ?? []).map((l) => l.key) : [];
	});
	const lit = (key: string) => focus.some((f) => isLit(key, f));
	const hoveredBranch = $derived(
		explore.hovered?.kind === 'branch' ? layout.internals.find((n) => n.key === explore.hovered?.id) : undefined
	);

	// roving tabindex: one leaf in the tab order, arrows move along the circle
	let active = $state(0);
	const leafEls: SVGGElement[] = $state([]);
	$effect(() => {
		const sel = explore.selectedBreed;
		const l = sel ? leavesByBreed.get(sel)?.[0] : undefined;
		if (l) active = l.index;
	});

	function onKey(e: KeyboardEvent, leaf: LayoutLeaf) {
		const n = layout.leaves.length;
		const moves: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
		let next: number | null = null;
		if (e.key in moves) next = (leaf.index + moves[e.key] + n) % n;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = n - 1;
		else if (e.key === 'Enter' || e.key === ' ') explore.select(leaf.breed.id);
		else if (e.key === 'Escape') explore.clearSelection();
		else return;
		e.preventDefault();
		if (next !== null) {
			active = next;
			leafEls[next]?.focus();
		}
	}

	const nodeHover = (n: LayoutNode) => ({ kind: 'branch', id: n.key }) as const;
	const breedHover = (l: LayoutLeaf) => ({ kind: 'breed', id: l.breed.id }) as const;

	const leafLabel = (l: LayoutLeaf) =>
		`${l.breed.names.en}: ${l.clade} clade${l.cladeLowSupport ? ' (low support)' : ''}, ${families[l.family].label.toLowerCase()}`;

	// text summary: consecutive leaves of one clade, in the order of the circle
	const groups = layout.leaves.reduce<{ clade: string; leaves: LayoutLeaf[] }[]>((acc, l) => {
		const last = acc.at(-1);
		if (last && last.clade === l.clade) last.leaves.push(l);
		else acc.push({ clade: l.clade, leaves: [l] });
		return acc;
	}, []);
	const cladeCount = new Set(layout.leaves.map((l) => l.cladeId)).size;
	const weak = layout.internals.filter((n) => n.support !== null && n.support < LOW_SUPPORT).length;
	const usedFamilies = (Object.keys(families) as (keyof typeof families)[]).filter((f) =>
		layout.leaves.some((l) => l.family === f)
	);
</script>

<figure class="tree" aria-labelledby="tree-caption">
	<div class="frame">
		<svg
			bind:clientWidth={width}
			viewBox="{-half} {-half} {layout.size} {layout.size}"
			role="group"
			aria-label="Genetic tree of {layout.leaves.length} breeds. Arrow keys move between breeds, Enter selects, Escape clears."
			class:has-focus={focus.length > 0}
		>
			<g class="links">
				{#each layout.links as link (link.key)}
					<path d={link.d} class:low={link.lowSupport} class:lit={lit(link.key)} />
				{/each}
			</g>
			<!-- the lit branch again, on top of its neighbours -->
			<g class="links overlay" aria-hidden="true">
				{#each layout.links.filter((l) => focus.length && lit(l.key)) as link (link.key)}
					<path d={link.d} class:low={link.lowSupport} class="lit" />
				{/each}
			</g>

			<g class="nodes">
				{#each layout.internals as node (node.key)}
					{@const [x, y] = polar(node.x, node.y)}
					<g
						class="node"
						class:lit={lit(node.key)}
						transform="translate({x},{y})"
						role="presentation"
						onpointerenter={() => explore.hover(nodeHover(node))}
						onpointerleave={() => explore.unhover(nodeHover(node))}
					>
						<circle class="hit" r={hitR} />
						<circle class="dot" r={node.support !== null && node.support < LOW_SUPPORT ? 1.2 : 1.8} />
					</g>
				{/each}
			</g>

			{#each layout.leaves as leaf (leaf.key)}
				{@const [x, y] = polar(leaf.x, leaf.y)}
				{@const on = lit(leaf.key)}
				{@const chosen = explore.selectedBreed === leaf.breed.id}
				<g
					bind:this={leafEls[leaf.index]}
					class="leaf fam-{leaf.family}"
					class:lit={on}
					class:chosen
					role="button"
					tabindex={leaf.index === active ? 0 : -1}
					aria-pressed={chosen}
					aria-label={leafLabel(leaf)}
					onpointerenter={() => explore.hover(breedHover(leaf))}
					onpointerleave={() => explore.unhover(breedHover(leaf))}
					onfocus={() => {
						active = leaf.index;
						explore.hover(breedHover(leaf));
					}}
					onblur={() => explore.unhover(breedHover(leaf))}
					onclick={() => explore.select(leaf.breed.id)}
					onkeydown={(e) => onKey(e, leaf)}
				>
					<path class="hit" d={leaf.hitPath} />
					<g transform="translate({x},{y})">
						{#if chosen}
							<circle class="halo" r="14" />
							<circle class="ring" r="10" />
						{/if}
						<g class="star">
							<path class="glow" d={STAR_PATH} />
							<path class="body" d={STAR_PATH} />
						</g>
					</g>
					<g transform="rotate({leaf.rotate}) translate({layout.radius + 14},0)">
						<text
							class="label"
							transform={leaf.flip ? 'rotate(180)' : undefined}
							text-anchor={leaf.flip ? 'end' : 'start'}
							dy="0.35em"
						>
							{leaf.breed.names.en}{leaf.cladeLowSupport ? ' *' : ''}
						</text>
					</g>
				</g>
			{/each}

			{#if hoveredBranch}
				{@const [x, y] = polar(hoveredBranch.x, hoveredBranch.y)}
				<text class="tip" x={x + 8} y={y - 8} aria-hidden="true">
					{hoveredBranch.support === null ? 'no bootstrap value' : `bootstrap ${hoveredBranch.support}`}
				</text>
			{/if}
		</svg>
	</div>

	<figcaption id="tree-caption">
		<ul class="legend" aria-label="Colour families">
			{#each usedFamilies as f (f)}
				<li>
					<svg class="fam-{f}" viewBox="-10 -10 20 20" aria-hidden="true"><path d={STAR_PATH} /></svg>
					{families[f].label}
				</li>
			{/each}
		</ul>
		<p class="note">
			Thin, pale branches: groupings with a bootstrap below {LOW_SUPPORT} in the full tree.
			<span aria-hidden="true">*</span> in the clade with low support (Parker et al. 2017). Colour families are an
			editorial choice, not genetic data.
		</p>

		<details class="summary">
			<summary>Text summary of the tree</summary>
			<p>
				A radial genetic tree of {layout.leaves.length} dog breeds from Parker et al. (2017), one star per breed,
				arranged in {cladeCount} clades. {weak} of its {layout.internals.length} groupings have a bootstrap below
				{LOW_SUPPORT} in the full tree and are drawn as weaker branches. Around the circle, clockwise from the top:
			</p>
			<ol>
				{#each groups as g, i (i)}
					<li>
						<strong>{g.clade}</strong>:
						{#each g.leaves as l, j (l.key)}{j > 0 ? ', ' : ''}{l.breed.names.en} ({families[l.family].label.toLowerCase()}{l.cladeLowSupport
								? ', low support in the clade'
								: ''}){/each}
					</li>
				{/each}
			</ol>
		</details>
	</figcaption>
</figure>

<style>
	.tree {
		margin: 0;
	}
	/* exploration is desktop-first: below 640 px the tree scrolls sideways inside its frame,
	   so labels stay legible and every target stays ≥ 44 px */
	.frame {
		width: 100%;
		max-width: 940px;
		margin-inline: auto;
		overflow-x: auto;
	}
	.frame > svg {
		display: block;
		width: 100%;
		min-width: 640px;
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

	/* branches */
	.links path {
		fill: none;
		stroke: var(--dt-ink-3);
		stroke-width: 1.1;
		transition: opacity var(--dt-dur-base) var(--dt-ease), stroke var(--dt-dur-fast) var(--dt-ease);
	}
	/* low bootstrap: thinner and paler, never dashed (dashes mean "historical" evidence) */
	.links path.low {
		stroke-width: 0.6;
		opacity: 0.6;
	}
	.has-focus .links path:not(.lit) {
		opacity: 0.3;
	}
	.links path.lit {
		stroke: var(--dt-accent-text);
		stroke-width: 2.2;
		opacity: 1;
	}
	.links path.lit.low {
		stroke-width: 1.4;
	}
	.overlay {
		pointer-events: none;
	}

	.node .hit,
	.leaf .hit {
		fill: transparent;
		pointer-events: all;
	}
	.node .dot {
		fill: var(--dt-ink-3);
		transition: opacity var(--dt-dur-base) var(--dt-ease);
	}
	.has-focus .node:not(.lit) .dot {
		opacity: 0.3;
	}
	.node.lit .dot {
		fill: var(--dt-accent-text);
	}

	/* stars: rest, lit, chosen, in the shadow (docs/DESIGN.md §3) */
	.leaf {
		cursor: pointer;
		outline: none;
	}
	.star {
		transform: scale(0.45);
		transition: transform var(--dt-dur-fast) var(--dt-ease-spring), opacity var(--dt-dur-base) var(--dt-ease);
	}
	.leaf.lit .star,
	.leaf.chosen .star {
		transform: scale(0.55);
	}
	.star .body {
		fill: currentColor;
		stroke: var(--dt-star-stroke);
		stroke-width: 0.7;
		vector-effect: non-scaling-stroke;
	}
	.star .glow {
		fill: currentColor;
		opacity: calc(var(--dt-star-glow) * 0.5);
		filter: blur(3px);
	}
	.leaf.lit .star .glow {
		opacity: calc(var(--dt-star-glow) * 0.9);
	}
	.has-focus .leaf:not(.lit):not(.chosen) .star .body {
		fill: var(--dt-star-shadow);
		opacity: var(--dt-star-shadow-opacity);
	}
	.has-focus .leaf:not(.lit):not(.chosen) .star .glow {
		opacity: 0;
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

	/* labels stay AA when dimmed: they step down to ink-3 instead of fading */
	.label {
		font-family: var(--dt-font-sans);
		font-size: 14px;
		fill: var(--dt-ink-2);
		transition: fill var(--dt-dur-base) var(--dt-ease);
	}
	.has-focus .leaf:not(.lit) .label {
		fill: var(--dt-ink-3);
	}
	.leaf.lit .label,
	.leaf.chosen .label {
		fill: var(--dt-ink);
		font-weight: 600;
	}
	.leaf:focus-visible .hit {
		stroke: var(--dt-accent-text);
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
	}

	.tip {
		font-family: var(--dt-font-sans);
		font-size: 13px;
		fill: var(--dt-ink);
		paint-order: stroke;
		stroke: var(--dt-bg);
		stroke-width: 4px;
		stroke-linejoin: round;
		pointer-events: none;
	}

	/* caption */
	figcaption {
		max-width: 64ch;
		margin: var(--dt-space-5) auto 0;
		font-size: var(--dt-text-small);
		color: var(--dt-ink-3);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--dt-space-2) var(--dt-space-4);
		margin: 0 0 var(--dt-space-3);
		padding: 0;
		list-style: none;
		color: var(--dt-ink-2);
	}
	.legend li {
		display: inline-flex;
		align-items: center;
		gap: var(--dt-space-1);
	}
	.legend li svg {
		width: 12px;
		height: 12px;
	}
	.legend li path {
		fill: currentColor;
		stroke: var(--dt-star-stroke);
		stroke-width: 0.7;
		vector-effect: non-scaling-stroke;
	}
	.note {
		margin: 0 0 var(--dt-space-3);
	}
	.summary summary {
		cursor: pointer;
		min-height: var(--dt-hit);
		display: flex;
		align-items: center;
		color: var(--dt-ink-2);
	}
	.summary ol {
		padding-left: var(--dt-space-5);
	}
	.summary strong {
		color: var(--dt-ink-2);
		font-weight: 600;
	}
</style>
