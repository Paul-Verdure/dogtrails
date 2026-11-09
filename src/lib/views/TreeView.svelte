<!--
	Radial dendrogram of the Parker 2017 breeds. D3 computes (tree-layout.ts), Svelte renders.
	Reads the explorer store, writes only through its actions. Never talks to the other views.

	The lantern (Paul, 2026-11-09, option B): a sector of consecutive breeds opens wide enough for
	their names and 44 px targets; the rest of the circle is packed, named by clade. The lantern
	follows the active breed (selection, keyboard, or a click on the packed rim) and glides there.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { Tween, prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { tree, breedByAbbrev } from '$lib/data';
	import { families, STAR_PATH } from '$lib/data/families';
	import { getExplore } from '$lib/state/explore.svelte';
	import {
		buildTree,
		isLit,
		labelReach,
		lanternWarp,
		polar,
		projectTree,
		LOW_SUPPORT,
		NO_CLADE,
		type LayoutLeaf,
		type LayoutNode
	} from './tree-layout.ts';

	const explore = getExplore();

	/** Show every grouping of the full tree, including the weakly supported ones. Local to the view. */
	let showAll = $state(false);
	const base = $derived(buildTree(tree, (a) => breedByAbbrev.get(a), { collapseWeak: !showAll }));
	const n = $derived(base.leaves.length);

	/** Rendered width, to keep pointer targets at 44 CSS px whatever the scale. */
	let width = $state(0);
	/** Width of the viewBox: fixed by the radius and the longest name, not by the lantern. */
	const span = $derived(2 * Math.ceil(base.radius + labelReach(base) + 8));
	/** CSS px per tree unit; before the first measure (prerender), the desktop frame. */
	const scale = $derived((width > 0 ? width : 960) / span);
	/** Angle per breed inside the lantern: a 44 px square fits in each target, 80 units past the star. */
	const step = $derived(44 / scale / (base.radius + 80));
	/** Breeds in the lantern: about 150° of the circle, odd so the active breed sits in the middle. */
	const size = $derived(Math.max(9, Math.min(25, 2 * Math.round(1.3 / step) + 1)));

	// roving tabindex: one leaf in the tab order, arrows move along the circle and the lantern follows
	let active = $state(0);
	const leafEls: SVGGElement[] = $state([]);

	const centre = new Tween(0.5, { easing: cubicOut });
	$effect(() => {
		const target = active + 0.5;
		const cur = untrack(() => centre.target);
		const delta = (((target - cur + n / 2) % n) + n) % n - n / 2;
		if (delta === 0) return;
		const duration = prefersReducedMotion.current ? 0 : Math.min(600, 160 + 20 * Math.abs(delta));
		centre.set(cur + delta, { duration });
	});

	const layout = $derived(
		projectTree(base, {
			warp: lanternWarp(n, centre.current, size, step),
			lantern: { centre: centre.current, size }
		})
	);

	/** Leaves of each breed (a breed split across subtrees has several). */
	const leavesByBreed = $derived.by(() => {
		const m = new Map<string, LayoutLeaf[]>();
		for (const l of layout.leaves) m.set(l.breed.id, [...(m.get(l.breed.id) ?? []), l]);
		return m;
	});

	const hitR = $derived(22 / scale);

	/** Keys of the nodes in the light: the hovered branch or breed, else the selected breed. */
	const focus = $derived.by((): string[] => {
		const h = explore.hovered;
		if (h?.kind === 'branch') return [h.id];
		const id = h?.kind === 'breed' ? h.id : explore.selectedBreed;
		return id ? (leavesByBreed.get(id) ?? []).map((l) => l.key) : [];
	});
	const lit = (key: string) => focus.some((f) => isLit(key, f));

	// a new selection brings the lantern to it, unless the active star is already one of its fragments
	$effect(() => {
		const sel = explore.selectedBreed;
		const l = sel ? base.leaves.find((x) => x.breed.id === sel) : undefined;
		if (l && untrack(() => base.leaves[active]?.breed.id) !== sel) active = l.index;
	});

	function onKey(e: KeyboardEvent, leaf: LayoutLeaf) {
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

	/** The leaf under a pointer on the label ring, from its angle. */
	function leafAt(e: MouseEvent): LayoutLeaf | undefined {
		const svg = (e.currentTarget as SVGElement).ownerSVGElement;
		const ctm = svg?.getScreenCTM();
		if (!ctm) return undefined;
		const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
		const b = layout.bounds;
		const a = b[0] + ((((Math.atan2(p.x, -p.y) - b[0]) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
		let i = 0;
		while (i < n - 1 && b[i + 1] <= a) i++;
		return layout.leaves[i];
	}
	function ringMove(e: PointerEvent) {
		const l = leafAt(e);
		const h = explore.hovered;
		if (l && !(h?.kind === 'breed' && h.id === l.breed.id)) explore.hover(breedHover(l));
	}
	function ringClick(e: MouseEvent) {
		const l = leafAt(e);
		if (!l) return;
		if (l.inLantern) explore.select(l.breed.id);
		else active = l.index;
	}

	const nodeHover = (n: LayoutNode) => ({ kind: 'branch', id: n.key }) as const;
	const breedHover = (l: LayoutLeaf) => ({ kind: 'breed', id: l.breed.id }) as const;

	const cladeText = (l: LayoutLeaf) =>
		l.clade === null ? 'no clade in Parker 2017' : `${l.clade} clade${l.cladeLowSupport ? ' (weakly supported)' : ''}`;
	const splitText = (l: LayoutLeaf) =>
		l.split ? `Its dogs form ${l.split.of} separate groups in the tree; this is group ${l.split.part}. ` : '';

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
		const all = id ? leavesByBreed.get(id) : undefined;
		const l = all?.find((x) => x.index === active) ?? all?.[0];
		if (!l) return null;
		const k = l.relatives.length;
		const rel =
			k === 0
				? 'No well-supported group holds it with other breeds of this tree.'
				: k <= 5
					? `Closest in this tree: ${names(l.relatives)}.`
					: `It sits in a group of ${k + 1} breeds whose order the DNA does not decide.`;
		const move = h?.kind === 'breed' && !l.inLantern ? ' Click to bring the lantern here.' : '';
		return {
			title: l.breed.names.en,
			text: `${cladeText(l)} · ${families[l.family].label}. ${splitText(l)}${rel}${move}`
		};
	});

	const leafLabel = (l: LayoutLeaf) =>
		`${l.breed.names.en}: ${cladeText(l)}, ${families[l.family].label.toLowerCase()}${l.split ? `, group ${l.split.part} of ${l.split.of}` : ''}`;

	const cladeLine = (l: LayoutLeaf) =>
		`${l.clade ?? NO_CLADE}${l.cladeLowSupport ? ' *' : ''}${l.split ? ` · ${l.split.part}/${l.split.of}` : ''}`;

	// text summary: consecutive leaves of one clade, in the order of the circle
	const groups = $derived(
		base.leaves.reduce<{ clade: string; leaves: (typeof base.leaves)[number][] }[]>((acc, l) => {
			const last = acc.at(-1);
			const clade = l.clade ?? 'No clade in Parker 2017';
			if (last && last.clade === clade) last.leaves.push(l);
			else acc.push({ clade, leaves: [l] });
			return acc;
		}, [])
	);
	const cladeCount = $derived(new Set(base.leaves.flatMap((l) => (l.cladeId ? [l.cladeId] : []))).size);
	const breedCount = $derived(leavesByBreed.size);
	const usedFamilies = $derived(
		(Object.keys(families) as (keyof typeof families)[]).filter((f) => base.leaves.some((l) => l.family === f))
	);
</script>

<figure class="tree" aria-labelledby="tree-guide">
	<div class="toolbar">
		<p id="tree-guide" class="guide">
			Each star is a breed. <strong>The closer to the rim two branches join, the closer their DNA.</strong>
			Colours are families; the short arcs gather breeds of one clade. The lantern names {size} breeds at a
			time: click the rim, pick a breed or use the arrow keys to move it.
		</p>
		<button type="button" class="toggle" aria-pressed={showAll} onclick={toggleAll}>
			{showAll ? 'Merge weak groupings' : 'Show every grouping'}
		</button>
	</div>

	<p class="status" aria-live="polite">
		{#if status}
			<strong>{status.title}</strong> — {status.text}
		{:else}
			Hover a star, a branch or the rim, or Tab into the tree, to read it here.
		{/if}
	</p>

	<div class="frame">
		<svg
			bind:clientWidth={width}
			viewBox={layout.viewBox.join(' ')}
			role="group"
			aria-label="Genetic tree of {layout.leaves.length} breeds. Arrow keys move the lantern from breed to breed, Enter selects, Escape clears."
			class:has-focus={focus.length > 0}
		>
			<g class="clades" aria-hidden="true">
				{#each layout.clades as c, i (i)}
					<path d={c.d} />
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

			<!-- the label ring: in the packed part, the pointer reads the breed by its angle and a click
			     brings the lantern there (keyboard: arrow keys) -->
			<circle
				class="ring"
				r={(layout.ring.inner + layout.ring.outer) / 2}
				stroke-width={layout.ring.outer - layout.ring.inner}
				role="presentation"
				onpointermove={ringMove}
				onpointerleave={() => explore.unhover()}
				onclick={ringClick}
			/>

			<g class="clade-labels" aria-hidden="true">
				{#each layout.cladeLabels as c (c.key)}
					<text transform="translate({c.x},{c.y}) rotate({c.rotate})" text-anchor={c.anchor} dy="3.5">{c.text}</text>
				{/each}
			</g>

			{#each layout.leaves as leaf (leaf.key)}
				{@const [x, y] = polar(leaf.x, leaf.y)}
				{@const chosen = explore.selectedBreed === leaf.breed.id}
				{@const on = lit(leaf.key)}
				<g
					bind:this={leafEls[leaf.index]}
					class="leaf fam-{leaf.family}"
					class:open={leaf.inLantern}
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
					onclick={() => {
						active = leaf.index;
						explore.select(leaf.breed.id);
					}}
					onkeydown={(e) => onKey(e, leaf)}
				>
					{#if leaf.inLantern}<path class="hit" d={leaf.hit} />{/if}
					<g transform="translate({x},{y})">
						{#if chosen}
							<circle class="halo" r="14" />
							<circle class="sel" r="10" />
						{/if}
						<g class="star">
							{#if leaf.inLantern || on || chosen}<path class="glow" d={STAR_PATH} />{/if}
							<path class="body" d={STAR_PATH} />
						</g>
					</g>
					{#if leaf.inLantern}
						<text
							class="label"
							transform="translate({leaf.label.x},{leaf.label.y}) rotate({leaf.label.rotate})"
							text-anchor={leaf.label.anchor}
						>
							<tspan class="name" x="0" y="-1">{leaf.breed.names.en}</tspan>
							<tspan class="clade" x="0" y="11">{cladeLine(leaf)}</tspan>
						</text>
					{/if}
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
				A radial genetic tree of {breedCount} dog breeds from Parker et al. (2017), one star per breed, or one per
				fragment for the breeds whose dogs fall into several subtrees ({layout.leaves.length} stars), arranged in
				{cladeCount} clades. {layout.weakInFull} of its {layout.internalsInFull} groupings have a DNA
				support below {LOW_SUPPORT} / 100. Around the circle, clockwise from the top:
			</p>
			<ol>
				{#each groups as g, i (i)}
					<li>
						<strong>{g.clade}</strong>:
						{#each g.leaves as l, j (l.key)}{j > 0 ? ', ' : ''}{l.breed.names.en} ({families[l.family].label.toLowerCase()}{l.cladeLowSupport
								? ', low support in the clade'
								: ''}{l.split ? `, group ${l.split.part} of ${l.split.of}` : ''}){/each}
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
	/* packed stars take no pointer: the label ring under them reads the angle */
	.leaf:not(.open) {
		pointer-events: none;
	}
	/* packed part of the circle: smaller stars, as in the dense zones of the map (§3) */
	.star {
		transform: scale(0.42);
		transition: transform var(--dt-dur-fast) var(--dt-ease-spring), opacity var(--dt-dur-base) var(--dt-ease);
	}
	.leaf.open .star {
		transform: scale(0.55);
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
	.sel {
		fill: none;
		stroke: var(--dt-select-ring);
		stroke-width: 1.2;
		stroke-dasharray: 1 3;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}

	/* the label ring: invisible, it only takes the pointer in the packed part */
	.ring {
		fill: none;
		stroke: transparent;
		pointer-events: stroke;
		cursor: pointer;
	}
	.clade-labels text {
		font-family: var(--dt-font-sans);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		fill: var(--dt-ink-3);
		pointer-events: none;
	}

	/* labels stay AA when dimmed: they step down to ink-3 instead of fading */
	.label {
		font-family: var(--dt-font-sans);
	}
	.label .name {
		font-size: 15px;
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
	.leaf:focus-visible path.hit {
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
