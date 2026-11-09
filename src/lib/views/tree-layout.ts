/**
 * Radial dendrogram of tree.json, computed with d3-hierarchy (cluster) and d3-shape.
 * Pure geometry: TreeView renders it. Angles follow the d3 convention (0 at 12 o'clock, clockwise).
 *
 * Reading choices (prototype, to be reviewed by Paul):
 * - groupings whose bootstrap is below LOW_SUPPORT are merged into their parent by default
 *   (a polytomy: "the DNA does not decide here"); `collapseWeak: false` shows every grouping;
 * - links are steps (an arc around the parent, then a radial segment), the classic cladogram reading;
 * - labels stay horizontal, stacked in two columns with a leader line to their star;
 * - a branch takes its family colour when every breed below it belongs to the same family.
 */
import { cluster, hierarchy, type HierarchyPointNode } from 'd3-hierarchy';
import { arc } from 'd3-shape';
import { isLeaf, type TreeFile, type TreeInternal, type TreeNode } from '$lib/data/schemas/tree';
import type { Breed, Family } from '$lib/data/schemas/breeds';

/** Bootstrap below this is "weakly supported" (Parker et al. 2017 mark < 50 % with `*`). */
export const LOW_SUPPORT = 50;

export type LayoutNode = {
	/** Path of child indices from the root, e.g. `r.0.1`: stable for a given tree and mode. */
	key: string;
	x: number;
	y: number;
	support: number | null;
	/** Number of breeds below the node. */
	size: number;
};

export type LayoutLeaf = LayoutNode & {
	breed: Breed;
	abbrev: string;
	family: Family;
	/** `null` for the breeds Parker et al. 2017 place in no clade. */
	cladeId: string | null;
	clade: string | null;
	cladeLowSupport: boolean;
	/** Other breeds of the smallest supported group holding this one (empty if that group is the root). */
	relatives: Breed[];
	/** Label anchor (horizontal text), side of the circle and leader line from the star. */
	label: { x: number; y: number; anchor: 'start' | 'end'; leader: string };
	/** Pointer target around the label, in tree units. */
	hitRect: { x: number; y: number; w: number; h: number };
	index: number;
};

export type LayoutLink = { key: string; d: string; lowSupport: boolean; family: Family | null };

/** Label of a breed outside every Parker clade. */
export const NO_CLADE = 'no clade';

/** Run of consecutive leaves of one clade, drawn as an arc just outside the stars. */
export type CladeArc = { cladeId: string; clade: string; d: string; leaves: number };

export type TreeLayout = {
	viewBox: [number, number, number, number];
	radius: number;
	leaves: LayoutLeaf[];
	internals: LayoutNode[];
	links: LayoutLink[];
	clades: CladeArc[];
	/** Internal nodes of the full tree below LOW_SUPPORT, whatever the mode. */
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

const LABEL_W = 7.4; // estimated px per character of a 14 px DM Sans label
const LINE_GAP = 34; // vertical room for a two-line label

export function layoutTree(
	file: TreeFile,
	breedOf: (abbrev: string) => Breed | undefined,
	{ radius = 200, collapseWeak = true } = {}
): TreeLayout {
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
	const step = (2 * Math.PI) / n;
	const laid = cluster<TreeNode>()
		.size([2 * Math.PI - step, radius])
		.separation(() => 1)(root);
	// half a step off the vertical axis, so no label sits exactly at the top or the bottom
	laid.each((node) => (node.x += step / 2));

	const keys = new Map<HierarchyPointNode<TreeNode>, string>();
	laid.each((node) => {
		const parent = node.parent ? keys.get(node.parent)! : null;
		keys.set(node, parent === null ? 'r' : `${parent}.${node.parent!.children!.indexOf(node)}`);
	});
	const keyOf = (node: HierarchyPointNode<TreeNode>) => keys.get(node)!;
	const supportOf = (d: TreeNode) => (isLeaf(d) ? null : d.support);
	const breedOfNode = (node: HierarchyPointNode<TreeNode>) => {
		const d = node.data;
		if (!isLeaf(d)) throw new Error('unreachable: internal node taken for a leaf');
		const b = breedOf(d.abbrev);
		if (!b) throw new Error(`tree leaf ${d.abbrev} has no breed in breeds.json`);
		return b;
	};

	const leafNodes = laid.leaves();
	const leaves = leafNodes.map((node, index) => {
		const d = node.data;
		if (!isLeaf(d)) throw new Error('unreachable');
		const breed = breedOfNode(node);
		const summary = file.breeds.find((b) => b.abbrev === d.abbrev);
		const parent = node.parent;
		const relatives =
			parent && parent.parent ? parent.leaves().filter((l) => l !== node).map(breedOfNode) : [];
		return {
			key: keyOf(node),
			x: node.x,
			y: node.y,
			support: null,
			size: 1,
			breed,
			abbrev: d.abbrev,
			family: breed.family.id,
			cladeId: d.cladeId,
			clade: summary ? summary.clade : d.cladeId,
			cladeLowSupport: summary?.cladeLowSupport ?? false,
			relatives,
			label: { x: 0, y: 0, anchor: 'start' as 'start' | 'end', leader: '' },
			hitRect: { x: 0, y: 0, w: 0, h: 0 },
			index
		};
	});

	// horizontal labels: two columns, pushed apart vertically, then hugging the circle
	const labelR = radius + 34;
	for (const side of [1, -1] as const) {
		const col = leaves
			.filter((l) => (side === 1 ? l.x < Math.PI : l.x >= Math.PI))
			.map((l) => ({ l, y: polar(l.x, radius)[1] }))
			.sort((a, b) => a.y - b.y);
		for (let i = 1; i < col.length; i++) col[i].y = Math.max(col[i].y, col[i - 1].y + LINE_GAP);
		const bottom = labelR + 10;
		if (col.length) col[col.length - 1].y = Math.min(col[col.length - 1].y, bottom);
		for (let i = col.length - 2; i >= 0; i--) col[i].y = Math.min(col[i].y, col[i + 1].y - LINE_GAP);
		for (const { l, y } of col) {
			const dx = Math.sqrt(Math.max(0, labelR * labelR - y * y));
			const x = side * (dx + 8);
			const [sx, sy] = polar(l.x, radius);
			const [ex, ey] = polar(l.x, radius + 10);
			const w = Math.max(l.breed.names.en.length * LABEL_W, (l.clade ?? NO_CLADE).length * 7.2 + 8) + 12;
			l.label = {
				x,
				y,
				anchor: side === 1 ? 'start' : 'end',
				leader: `M${f(sx)},${f(sy)}L${f(ex)},${f(ey)}L${f(x - side * 4)},${f(y)}`
			};
			l.hitRect = { x: side === 1 ? x - 6 : x - w + 6, y: y - 18, w, h: LINE_GAP };
		}
	}

	const internals = laid
		.descendants()
		.filter((node) => node.children)
		.map((node) => ({
			key: keyOf(node),
			x: node.x,
			y: node.y,
			support: supportOf(node.data),
			size: node.leaves().length
		}));

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
	const links = laid.links().map((l) => {
		const s = supportOf(l.target.data);
		const fams = new Set(l.target.leaves().map((x) => breedOfNode(x).family.id));
		return {
			key: keyOf(l.target),
			d: link(l.source, l.target),
			lowSupport: s !== null && s < LOW_SUPPORT,
			family: fams.size === 1 ? [...fams][0] : null
		};
	});

	// clade arcs: runs of consecutive leaves sharing a clade
	const band = arc<{ a0: number; a1: number }>()
		.innerRadius(radius + 7)
		.outerRadius(radius + 10)
		.startAngle((d) => d.a0)
		.endAngle((d) => d.a1)
		.cornerRadius(1);
	const clades: CladeArc[] = [];
	for (let i = 0; i < leaves.length; ) {
		let j = i;
		while (j + 1 < leaves.length && leaves[j + 1].cladeId === leaves[i].cladeId) j++;
		const { cladeId, clade } = leaves[i];
		if (cladeId === null || clade === null) {
			i = j + 1; // no clade: no arc
			continue;
		}
		clades.push({
			cladeId,
			clade,
			leaves: j - i + 1,
			d: band({ a0: leaves[i].x - step * 0.4, a1: leaves[j].x + step * 0.4 }) ?? ''
		});
		i = j + 1;
	}

	const ys = leaves.map((l) => l.label.y);
	const top = Math.min(-radius - 20, ...ys.map((y) => y - 24));
	const bottom = Math.max(radius + 20, ...ys.map((y) => y + 20));
	const halfW = labelR + 8 + Math.max(...leaves.map((l) => l.hitRect.w));
	return {
		viewBox: [-halfW, top, 2 * halfW, bottom - top],
		radius,
		leaves,
		internals,
		links,
		clades,
		weakInFull,
		internalsInFull
	};
}

const f = (v: number) => Math.round(v * 100) / 100;
