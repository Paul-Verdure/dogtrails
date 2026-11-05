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

	/** Show every grouping of the full tree, including the weakly supported ones. Local to the view. */
	let showAll = $state(false);
	const layout = $derived(layoutTree(tree, (a) => breedByAbbrev.get(a), { collapseWeak: !showAll }));

	/** Leaves of each breed (a breed split across subtrees has several). */
	const leavesByBreed = $derived.by(() => {
		const m = new Map<string, LayoutLeaf[]>();
		for (const l of layout.leaves) m.set(l.breed.id, [...(m.get(l.breed.id) ?? []), l]);
		return m;
	});

	/** Rendered width, to keep pointer targets at 44 CSS px whatever the scale. */
	let width = $state(0);
	const hitR = $derived(22 * (width > 0 ? layout.viewBox[2] / width : 1));

	/** Keys of the nodes in the light: the hovered branch or breed, else the selected breed. */
	const focus = $derived.by((): string[] => {
		const h = explore.hovered;
		if (h?.kind === 'branch') return [h.id];
		const id = h?.kind === 'breed' ? h.id : explore.selectedBreed;
		return id ? (leavesByBreed.get(id) ?? []).map((l) => l.key) : [];
	});
	const lit = (key: string) => focus.some((f) => isLit(key, f));

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

	function toggleAll() {
		explore.unhover();
		showAll = !showAll;
	}

	const nodeHover = (n: LayoutNode) => ({ kind: 'branch', id: n.key }) as const;
	const breedHover = (l: LayoutLeaf) => ({ kind: 'breed', id: l.breed.id }) as const;

	const supportText = (s: number | null) =>
		s === null ? 'no support value' : `DNA support ${s} / 100${s < LOW_SUPPORT ? ', weak' : ''}`;
	const names = (bs: { names: { en: string } }[]) => bs.map((b) => b.names.en).join(', ');

	/** What the status line says: the breed or branch under the pointer, else the selected breed. */
	const status = $derived.by(() => {
		const h = explore.hovered;
		if (h?.kind === 'branch') {
			const n = layout.internals.find((x) => x.key === h.id);
			if (!n) return null;
			if (n.key === 'r') return { title: `All ${n.size} breeds`, text: 'The root of the tree.' };
			return { title: `${n.size} breeds meet here`, text: `${supportText(n.support)}.` };
		}
		const id = h?.kind === 'breed' ? h.id : explore.selectedBreed;
		const l = id ? leavesByBreed.get(id)?.[0] : undefined;
		if (!l) return null;
		const k = l.relatives.length;
		const rel =
			k === 0
				? 'No well-supported group holds it with other breeds of this sample.'
				: k <= 5
					? `Closest in this tree: ${names(l.relatives)}.`
					: `It sits in a group of ${k + 1} breeds whose order the DNA does not decide.`;
		return {
			title: l.breed.names.en,
			text: `${l.clade} clade${l.cladeLowSupport ? ' (weakly supported)' : ''} · ${families[l.family].label}. ${rel}`
		};
	});

	const leafLabel = (l: LayoutLeaf) =>
		`${l.breed.names.en}: ${l.clade} clade${l.cladeLowSupport ? ' (low support)' : ''}, ${families[l.family].label.toLowerCase()}`;

	// text summary: consecutive leaves of one clade, in the order of the circle
	const groups = $derived(
		layout.leaves.reduce<{ clade: string; leaves: LayoutLeaf[] }[]>((acc, l) => {
			const last = acc.at(-1);
			if (last && last.clade === l.clade) last.leaves.push(l);
			else acc.push({ clade: l.clade, leaves: [l] });
			return acc;
		}, [])
	);
	const cladeCount = $derived(new Set(layout.leaves.map((l) => l.cladeId)).size);
	const usedFamilies = $derived(
		(Object.keys(families) as (keyof typeof families)[]).filter((f) => layout.leaves.some((l) => l.family === f))
	);
</script>

<figure class="tree" aria-labelledby="tree-guide">
	<div class="toolbar">
		<p id="tree-guide" class="guide">
			Each star is a breed. <strong>The closer to the rim two branches join, the closer their DNA.</strong>
			Colours are families; the short arcs gather breeds of one clade.
		</p>
		<button type="button" class="toggle" aria-pressed={showAll} onclick={toggleAll}>
			{showAll ? 'Merge weak groupings' : 'Show every grouping'}
		</button>
	</div>

	<p class="status" aria-live="polite">
		{#if status}
			<strong>{status.title}</strong> — {status.text}
		{:else}
			Hover a star or a branch, or Tab into the tree, to read it here.
		{/if}
	</p>

	<div class="frame">
		<svg
			bind:clientWidth={width}
			viewBox={layout.viewBox.join(' ')}
			role="group"
			aria-label="Genetic tree of {layout.leaves.length} breeds. Arrow keys move between breeds, Enter selects, Escape clears."
			class:has-focus={focus.length > 0}
		>
			<g class="clades" aria-hidden="true">
				{#each layout.clades as c, i (i)}
					{#if c.leaves > 1}<path d={c.d} />{/if}
				{/each}
			</g>

			<g class="links">
				{#each layout.links as link (link.key)}
					<path
						d={link.d}
						class={link.family ? `fam-${link.family}` : 'mixed'}
						class:low={link.lowSupport}
						class:lit={lit(link.key)}
					/>
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
						<circle class="hit" r={Math.min(hitR, 22)} />
						<circle class="dot" r={node.support !== null && node.support < LOW_SUPPORT ? 1.4 : 2.4} />
					</g>
				{/each}
			</g>

			{#each layout.leaves as leaf (leaf.key)}
				{@const [x, y] = polar(leaf.x, leaf.y)}
				{@const chosen = explore.selectedBreed === leaf.breed.id}
				<g
					bind:this={leafEls[leaf.index]}
					class="leaf fam-{leaf.family}"
					class:lit={lit(leaf.key)}
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
					<rect class="hit" x={leaf.hitRect.x} y={leaf.hitRect.y} width={leaf.hitRect.w} height={leaf.hitRect.h} rx="6" />
					<circle class="hit" cx={x} cy={y} r={hitR} />
					<path class="leader" d={leaf.label.leader} />
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
					<text class="label" x={leaf.label.x} y={leaf.label.y} text-anchor={leaf.label.anchor}>
						<tspan class="name">{leaf.breed.names.en}</tspan>
						<tspan class="clade" x={leaf.label.x} dy="14">{leaf.clade}{leaf.cladeLowSupport ? ' *' : ''}</tspan>
					</text>
				</g>
			{/each}
		</svg>
	</div>

	<figcaption>
		<ul class="legend" aria-label="Colour families">
			{#each usedFamilies as f (f)}
				<li>
					<svg class="fam-{f}" viewBox="-10 -10 20 20" aria-hidden="true"><path d={STAR_PATH} /></svg>
					{families[f].label}
				</li>
			{/each}
		</ul>
		<p class="note">
			{#if showAll}
				Every grouping of the tree is drawn. Thin, pale branches have a DNA support below {LOW_SUPPORT} / 100: the data
				barely decides them.
			{:else}
				{layout.weakInFull} of the {layout.internalsInFull} groupings have a DNA support below {LOW_SUPPORT} / 100. They
				are merged: where several branches leave one point, the DNA does not decide their order.
			{/if}
			<span aria-hidden="true">*</span> in the clade with low support (Parker et al. 2017). Families are an editorial
			choice, not genetic data.
		</p>

		<details class="summary">
			<summary>Text summary of the tree</summary>
			<p>
				A radial genetic tree of {layout.leaves.length} dog breeds from Parker et al. (2017), one star per breed,
				arranged in {cladeCount} clades. {layout.weakInFull} of its {layout.internalsInFull} groupings have a DNA
				support below {LOW_SUPPORT} / 100. Around the circle, clockwise from the top:
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
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--dt-space-3) var(--dt-space-5);
	}
	.guide {
		max-width: 60ch;
		margin: 0;
		color: var(--dt-ink-2);
	}
	.guide strong {
		color: var(--dt-ink);
		font-weight: 500;
	}
	.toggle {
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
	.toggle:hover,
	.toggle:focus-visible,
	.toggle[aria-pressed='true'] {
		border-color: var(--dt-accent-text);
	}
	.status {
		min-height: 3.2em;
		margin: var(--dt-space-4) 0 0;
		padding: var(--dt-space-2) var(--dt-space-4);
		border-left: 2px solid var(--dt-accent);
		font-size: var(--dt-text-small);
		color: var(--dt-ink-2);
	}
	.status strong {
		font-family: var(--dt-font-serif);
		font-size: 18px;
		font-weight: 400;
		color: var(--dt-ink);
	}

	/* exploration is desktop-first: below 640 px the tree scrolls sideways inside its frame,
	   so labels stay legible and every target stays ≥ 44 px */
	.frame {
		width: 100%;
		max-width: 1000px;
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

	/* clade arcs */
	.clades path {
		fill: var(--dt-ink-2);
		transition: opacity var(--dt-dur-base) var(--dt-ease);
	}
	.has-focus .clades path {
		opacity: 0.3;
	}

	/* branches: family colour while one family, ink where families mix */
	.links path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		transition: opacity var(--dt-dur-base) var(--dt-ease);
	}
	.links path.mixed {
		color: var(--dt-ink-3);
	}
	/* low support (shown only with every grouping): thinner and paler, never dashed
	   (dashes mean "historical" evidence) */
	.links path.low {
		stroke-width: 0.7;
		opacity: 0.6;
	}
	.has-focus .links path:not(.lit) {
		opacity: 0.25;
	}
	.overlay path.lit {
		stroke: var(--dt-accent-text);
		stroke-width: 2.6;
		opacity: 1;
	}
	.overlay path.lit.low {
		stroke-width: 1.4;
	}
	.overlay {
		pointer-events: none;
	}

	.hit {
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
		transform: scale(0.55);
		transition: transform var(--dt-dur-fast) var(--dt-ease-spring), opacity var(--dt-dur-base) var(--dt-ease);
	}
	.leaf.lit .star,
	.leaf.chosen .star {
		transform: scale(0.65);
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

	.leader {
		fill: none;
		stroke: var(--dt-line-strong);
		stroke-width: 0.8;
		transition: opacity var(--dt-dur-base) var(--dt-ease);
	}
	.has-focus .leaf:not(.lit) .leader {
		opacity: 0.4;
	}
	.leaf.lit .leader {
		stroke: var(--dt-accent-text);
	}

	/* labels stay AA when dimmed: they step down to ink-3 instead of fading */
	.label {
		font-family: var(--dt-font-sans);
	}
	.label .name {
		font-size: 14px;
		fill: var(--dt-ink);
		transition: fill var(--dt-dur-base) var(--dt-ease);
	}
	.label .clade {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		fill: var(--dt-ink-3);
	}
	.has-focus .leaf:not(.lit) .label .name {
		fill: var(--dt-ink-3);
	}
	.leaf.lit .label .name,
	.leaf.chosen .label .name {
		font-weight: 600;
	}
	.leaf:focus-visible rect.hit {
		stroke: var(--dt-accent-text);
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
	}

	/* caption */
	figcaption {
		max-width: 64ch;
		margin: var(--dt-space-4) auto 0;
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
