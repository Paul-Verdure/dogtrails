/**
 * Radial dendrogram of tree.json, computed with d3-hierarchy (cluster) and d3-shape.
 * Pure geometry: TreeView and TreeExcerpt render it. Angles follow the d3 convention
 * (0 at 12 o'clock, clockwise).
 *
 * Two steps, so that the lantern can glide without re-running the hierarchy:
 * - `buildTree` fixes the structure: which node is where along the circle, as a position `u`
 *   in leaf units (leaf i sits at u = i + 0.5), and at which depth (radius);
 * - `projectTree` turns `u` into an angle through a warp, then draws links, arcs and labels.
 *   The uniform warp gives the plain circle (breed pages); the lantern warp opens a sector of
 *   `size` consecutive leaves, wide enough for named labels and 44 px targets, and packs the
 *   rest of the circle (the explorer, Paul 2026-11-09, option B).
 *
 * Reading choices, validated by Paul:
 * - groupings whose bootstrap is below LOW_SUPPORT are merged into their parent by default
 *   (a polytomy: "the DNA does not decide here"); `collapseWeak: false` shows every grouping;
 * - links are steps (an arc around the parent, then a radial segment), the classic cladogram reading;
 * - a branch takes its family colour when every breed below it belongs to the same family.
 */
import { cluster, hierarchy, type HierarchyPointNode } from 'd3-hierarchy';
import { arc } from 'd3-shape';
import { isLeaf, type TreeFile, type TreeInternal, type TreeNode } from '$lib/data/schemas/tree';
import type { Breed, Family } from '$lib/data/schemas/breeds';

/** Bootstrap below this is "weakly supported" (Parker et al. 2017 mark < 50 % with `*`). */
export const LOW_SUPPORT = 50;

/** Label of a breed outside every Parker clade. */
export const NO_CLADE = 'no clade';

const TAU = 2 * Math.PI;

type BaseNode = {
	/** Path of child indices from the root, e.g. `r.0.1`: stable for a given tree and mode. */
	key: string;
	/** Position along the circle in leaf units: leaf i at i + 0.5, an internal node between its leaves. */
	u: number;
	/** Distance from the centre. */
	y: number;
	support: number | null;
	/** Number of breeds below the node. */
	size: number;
};

type BaseLeaf = BaseNode & {
	breed: Breed;
	abbrev: string;
	family: Family;
	/** `null` for the breeds Parker et al. 2017 place in no clade. */
	cladeId: string | null;
	clade: string | null;
	cladeLowSupport: boolean;
	/** Set when the breed's dogs fall into several subtrees: which fragment this leaf is. */
	split: { part: number; of: number } | null;
	/** Other breeds of the smallest supported group holding this one (empty if that group is the root). */
	relatives: Breed[];
	index: number;
};

/** The structure of the tree for one mode (weak groupings merged or not), independent of any warp. */
export type TreeBase = {
	radius: number;
	leaves: BaseLeaf[];
	internals: BaseNode[];
	links: { key: string; source: BaseNode; target: BaseNode; lowSupport: boolean; family: Family | null }[];
	/** Runs of consecutive leaves sharing a clade (leaf indices, inclusive). */
	runs: { cladeId: string | null; clade: string | null; from: number; to: number }[];
	/** Internal nodes of the full tree below LOW_SUPPORT, whatever the mode. */
	weakInFull: number;
	internalsInFull: number;
};

export type LayoutNode = BaseNode & {
	/** Angle (radians, 0 at the top, clockwise). */
	x: number;
};

export type LayoutLeaf = BaseLeaf & {
	x: number;
	/** Inside the lantern: drawn with its label and a pointer target. */
	inLantern: boolean;
	/** Radial label: anchor point, rotation (degrees) and text anchor. Meaningful when `inLantern`. */
	label: { x: number; y: number; rotate: number; anchor: 'start' | 'end' };
	/** Pointer target, an annular sector around the star and its label; '' outside the lantern. */
	hit: string;
};

export type LayoutLink = { key: string; d: string; lowSupport: boolean; family: Family | null };

/** Run of consecutive leaves of one clade, drawn as an arc just outside the stars. */
export type CladeArc = { cladeId: string; clade: string; d: string; leaves: number };

/** Name of a clade written along the radius in the packed part of the circle. */
export type CladeLabel = { key: string; text: string; x: number; y: number; rotate: number; anchor: 'start' | 'end' };

export type TreeLayout = {
	viewBox: [number, number, number, number];
	radius: number;
	leaves: LayoutLeaf[];
	internals: LayoutNode[];
	links: LayoutLink[];
	clades: CladeArc[];
	cladeLabels: CladeLabel[];
	/** Inner and outer radius of the label ring (pointer ring of the packed part). */
	ring: { inner: number; outer: number };
	/** Angle of the boundary between leaf i - 1 and leaf i, for i in 0..n: a pointer angle → leaf lookup. */
	bounds: number[];
	weakInFull: number;
	internalsInFull: number;
};

const isUnder = (key: string, ancestor: string) => key === ancestor || key.startsWith(ancestor + '.');

/** A branch is lit when it lies between the root and the focus, or below the focus. */
export const isLit = (key: string, focus: string) => isUnder(key, focus) || isUnder(focus, key);

/** Cartesian position of a polar point (angle, radius) around the centre. */
export const polar = (a: number, r: number): [number, number] => [r * Math.sin(a), -r * Math.cos(a)];

const weak = (n: TreeInternal) => n.support !== null && n.support < LOW_SUPPORT;

/** Merges every weakly supported grouping into its parent (the root is kept). */
function collapse(node: TreeInternal): TreeInternal {
	const children = node.children.flatMap((c): TreeNode[] => {
		if (isLeaf(c)) return [c];
		const k = collapse(c);
		return weak(c) ? k.children : [k];
	});
	return { support: node.support, children };
}

export function buildTree(
	file: TreeFile,
	breedOf: (abbrev: string) => Breed | undefined,
	{ radius = 250, collapseWeak = true } = {}
): TreeBase {
	let internalsInFull = 0;
	let weakInFull = 0;
	(function count(n: TreeNode) {
		if (isLeaf(n)) return;
		internalsInFull++;
		if (weak(n)) weakInFull++;
		n.children.forEach(count);
	})(file.root);

	const data = collapseWeak ? collapse(file.root) : file.root;
	const root = hierarchy<TreeNode>(data, (n) => (isLeaf(n) ? null : n.children));
	const n = root.leaves().length;
	// x in leaf units: leaves at 0 .. n - 1, shifted by half a leaf below
	const laid = cluster<TreeNode>()
		.size([n - 1, radius])
		.separation(() => 1)(root);

	const keys = new Map<HierarchyPointNode<TreeNode>, string>();
	laid.each((node) => {
		const parent = node.parent ? keys.get(node.parent)! : null;
		keys.set(node, parent === null ? 'r' : `${parent}.${node.parent!.children!.indexOf(node)}`);
	});
	const breedOfNode = (node: HierarchyPointNode<TreeNode>) => {
		const d = node.data;
		if (!isLeaf(d)) throw new Error('unreachable: internal node taken for a leaf');
		const b = breedOf(d.abbrev);
		if (!b) throw new Error(`tree leaf ${d.abbrev} has no breed in breeds.json`);
		return b;
	};

	const nodes = new Map<HierarchyPointNode<TreeNode>, BaseNode>();
	const leaves: BaseLeaf[] = laid.leaves().map((node, index) => {
		const d = node.data;
		if (!isLeaf(d)) throw new Error('unreachable');
		const breed = breedOfNode(node);
		const summary = file.breeds.find((b) => b.abbrev === d.abbrev);
		const parent = node.parent;
		const leaf: BaseLeaf = {
			key: keys.get(node)!,
			u: node.x + 0.5,
			y: node.y,
			support: null,
			size: 1,
			breed,
			abbrev: d.abbrev,
			family: breed.family.id,
			cladeId: d.cladeId,
			clade: summary ? summary.clade : d.cladeId,
			cladeLowSupport: summary?.cladeLowSupport ?? false,
			split: d.split ?? null,
			relatives: parent && parent.parent ? parent.leaves().filter((l) => l !== node).map(breedOfNode) : [],
			index
		};
		nodes.set(node, leaf);
		return leaf;
	});

	const internals = laid
		.descendants()
		.filter((node) => node.children)
		.map((node) => {
			const b: BaseNode = {
				key: keys.get(node)!,
				u: node.x + 0.5,
				y: node.y,
				support: isLeaf(node.data) ? null : node.data.support,
				size: node.leaves().length
			};
			nodes.set(node, b);
			return b;
		});

	const links = laid.links().map((l) => {
		const t = l.target.data;
		const s = isLeaf(t) ? null : t.support;
		const fams = new Set(l.target.leaves().map((x) => breedOfNode(x).family.id));
		return {
			key: keys.get(l.target)!,
			source: nodes.get(l.source)!,
			target: nodes.get(l.target)!,
			lowSupport: s !== null && s < LOW_SUPPORT,
			family: fams.size === 1 ? [...fams][0] : null
		};
	});

	const runs: TreeBase['runs'] = [];
	for (let i = 0; i < leaves.length; ) {
		let j = i;
		while (j + 1 < leaves.length && leaves[j + 1].cladeId === leaves[i].cladeId) j++;
		runs.push({ cladeId: leaves[i].cladeId, clade: leaves[i].clade, from: i, to: j });
		i = j + 1;
	}

	return { radius, leaves, internals, links, runs, weakInFull, internalsInFull };
}

/** Maps a position `u` (leaf units, 0..n) to an angle; must be increasing, with warp(n) - warp(0) = 2π. */
export type Warp = (u: number) => number;

export const uniformWarp = (n: number): Warp => (u) => (u * TAU) / n;

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * The lantern: the `size` leaves around `centre` (leaf units, any real, taken modulo n) get
 * `step` radians each, the others share what is left. The centre keeps its uniform angle, so the
 * tree breathes around the lantern instead of turning.
 */
export function lanternWarp(n: number, centre: number, size: number, step: number): Warp {
	const c = mod(centre, n);
	const h = size / 2;
	const out = (TAU - size * step) / (n - size);
	// the lantern as up to two intervals of [0, n]
	const lo = c - h;
	const hi = c + h;
	const spans: [number, number][] =
		lo < 0 ? [[0, hi], [lo + n, n]] : hi > n ? [[lo, n], [0, hi - n]] : [[lo, hi]];
	const inside = (u: number) => spans.reduce((s, [a, b]) => s + Math.max(0, Math.min(u, b) - a), 0);
	const F = (u: number) => out * u + (step - out) * inside(u);
	const shift = (c * TAU) / n - F(c);
	return (u) => F(u) + shift;
}

/** Is leaf position `u` inside the lantern of `size` leaves around `centre`? */
const isInLantern = (u: number, n: number, centre: number, size: number) => {
	const d = Math.abs(mod(u - centre + n / 2, n) - n / 2);
	return d < size / 2;
};

const NAME_W = 8; // estimated tree units per character of a 15-unit DM Sans label
const LABEL_GAP = 16; // from the star to the start of its label

/** Room the longest label needs beyond the star radius: the size of the viewBox depends on it. */
export const labelReach = (base: TreeBase) =>
	LABEL_GAP + Math.max(...base.leaves.map((l) => l.breed.names.en.length)) * NAME_W + 12;

export function projectTree(
	base: TreeBase,
	{ warp, lantern }: { warp?: Warp; lantern?: { centre: number; size: number } } = {}
): TreeLayout {
	const { radius, leaves: bl } = base;
	const n = bl.length;
	const w = warp ?? uniformWarp(n);
	const reach = labelReach(base);
	const ring = { inner: radius - 14, outer: radius + reach };

	const bounds = Array.from({ length: n + 1 }, (_, i) => w(i));
	const textAt = (a: number, r: number) => {
		const [x, y] = polar(a, r);
		const deg = (mod(a, TAU) * 180) / Math.PI;
		const left = deg > 180;
		return { x: f(x), y: f(y), rotate: f(left ? deg + 90 : deg - 90), anchor: left ? ('end' as const) : ('start' as const) };
	};
	const sector = arc<{ a0: number; a1: number; r0: number; r1: number }>()
		.innerRadius((d) => d.r0)
		.outerRadius((d) => d.r1)
		.startAngle((d) => d.a0)
		.endAngle((d) => d.a1);

	const leaves: LayoutLeaf[] = bl.map((l) => {
		const x = w(l.u);
		const open = lantern ? isInLantern(l.u, n, lantern.centre, lantern.size) : false;
		const len = Math.max(l.breed.names.en.length * NAME_W, 120) + LABEL_GAP + 10;
		return {
			...l,
			x,
			inLantern: open,
			label: textAt(x, radius + LABEL_GAP),
			hit: open
				? (sector({ a0: bounds[l.index], a1: bounds[l.index + 1], r0: ring.inner, r1: radius + len }) ?? '')
				: ''
		};
	});
	const internals = base.internals.map((b) => ({ ...b, x: w(b.u) }));

	type P = { x: number; y: number };
	const link = (s: P, t: P) => {
		const [x0, y0] = polar(s.x, s.y);
		const [x1, y1] = polar(t.x, s.y);
		const [x2, y2] = polar(t.x, t.y);
		const large = Math.abs(t.x - s.x) > Math.PI ? 1 : 0;
		const sweep = t.x > s.x ? 1 : 0;
		const arcPart = s.y > 0 ? `A${f(s.y)},${f(s.y)} 0 ${large} ${sweep} ${f(x1)},${f(y1)}` : '';
		return `M${f(x0)},${f(y0)}${arcPart}L${f(x2)},${f(y2)}`;
	};
	const angle = (b: BaseNode) => ({ x: w(b.u), y: b.y });
	const links = base.links.map((l) => ({
		key: l.key,
		d: link(angle(l.source), angle(l.target)),
		lowSupport: l.lowSupport,
		family: l.family
	}));

	// clade arcs, and clade names along the radius where the leaves are packed
	const band = arc<{ a0: number; a1: number }>()
		.innerRadius(radius + 7)
		.outerRadius(radius + 10)
		.startAngle((d) => d.a0)
		.endAngle((d) => d.a1)
		.cornerRadius(1);
	const clades: CladeArc[] = [];
	const cladeLabels: CladeLabel[] = [];
	for (const r of base.runs) {
		const a0 = bounds[r.from];
		const a1 = bounds[r.to + 1];
		const pad = Math.min(0.1 * (a1 - a0), 0.004);
		if (r.cladeId !== null && r.clade !== null && r.to > r.from)
			clades.push({ cladeId: r.cladeId, clade: r.clade, leaves: r.to - r.from + 1, d: band({ a0: a0 + pad, a1: a1 - pad }) ?? '' });
		const packed = !leaves.slice(r.from, r.to + 1).some((l) => l.inLantern);
		// a 10-unit capital line needs about 13 units of arc at the label radius, and keeps clear of
		// the two-line labels at the edges of the lantern
		const mid = (a0 + a1) / 2;
		const clear = (l: LayoutLeaf) =>
			!l.inLantern ||
			Math.abs(mod(mid - l.x + Math.PI, TAU) - Math.PI) >= (bounds[l.index + 1] - bounds[l.index]) / 2 + 16 / (radius + LABEL_GAP);
		if (lantern && packed && (a1 - a0) * (radius + LABEL_GAP) >= 13 && leaves.every(clear))
			cladeLabels.push({ key: `${r.from}`, text: r.clade ?? NO_CLADE, ...textAt(mid, radius + LABEL_GAP) });
	}

	const half = Math.ceil(ring.outer + 8);
	return {
		viewBox: [-half, -half, 2 * half, 2 * half],
		radius,
		leaves,
		internals,
		links,
		clades,
		cladeLabels,
		ring,
		bounds,
		weakInFull: base.weakInFull,
		internalsInFull: base.internalsInFull
	};
}

/** The plain circle, weak groupings merged: the geometry of the breed pages. */
export const layoutTree = (
	file: TreeFile,
	breedOf: (abbrev: string) => Breed | undefined,
	options: { radius?: number; collapseWeak?: boolean } = {}
) => projectTree(buildTree(file, breedOf, options));

const f = (v: number) => Math.round(v * 100) / 100;
