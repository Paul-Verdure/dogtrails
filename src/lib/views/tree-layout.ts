/**
 * Radial dendrogram of tree.json, computed with d3-hierarchy (cluster) and d3-shape.
 * Pure geometry: TreeView renders it. Angles follow the d3 convention (0 at 12 o'clock, clockwise).
 * Links are drawn as steps (an arc around the parent, then a radial segment), the classic cladogram
 * reading: d3-shape's linkRadial curves made the deep, unbalanced Parker tree hard to follow.
 */
import { cluster, hierarchy, type HierarchyPointNode } from 'd3-hierarchy';
import { arc } from 'd3-shape';
import { isLeaf, type TreeFile, type TreeNode } from '$lib/data/schemas/tree';
import type { Breed, Family } from '$lib/data/schemas/breeds';

/** Bootstrap below this is shown as a weaker branch (Parker et al. 2017 mark < 50 % with `*`). */
export const LOW_SUPPORT = 50;

export type LayoutNode = {
	/** Path of child indices from the root, e.g. `r.0.1`: stable for a given tree.json. */
	key: string;
	x: number;
	y: number;
	support: number | null;
};

export type LayoutLeaf = LayoutNode & {
	breed: Breed;
	abbrev: string;
	family: Family;
	cladeId: string;
	clade: string;
	cladeLowSupport: boolean;
	/** Label rotation in degrees, and whether the label is flipped to stay upright. */
	rotate: number;
	flip: boolean;
	/** Annular wedge covering the star and its label: the pointer target. */
	hitPath: string;
	index: number;
};

export type LayoutLink = { key: string; d: string; lowSupport: boolean };

export type TreeLayout = {
	size: number;
	radius: number;
	leaves: LayoutLeaf[];
	internals: LayoutNode[];
	links: LayoutLink[];
};

const isUnder = (key: string, ancestor: string) => key === ancestor || key.startsWith(ancestor + '.');

/** A branch is lit when it lies between the root and the focus, or below the focus. */
export const isLit = (key: string, focus: string) => isUnder(key, focus) || isUnder(focus, key);

export function layoutTree(
	file: TreeFile,
	breedOf: (abbrev: string) => Breed | undefined,
	{ radius = 220, labelSpace = 250 } = {}
): TreeLayout {
	const root = hierarchy<TreeNode>(file.root, (n) => (isLeaf(n) ? null : n.children));
	const keys = new Map<HierarchyPointNode<TreeNode>, string>();
	const n = root.leaves().length;
	const laid = cluster<TreeNode>()
		.size([(2 * Math.PI * (n - 1)) / n, radius])
		.separation(() => 1)(root);

	laid.each((node) => {
		const parent = node.parent ? keys.get(node.parent)! : null;
		keys.set(node, parent === null ? 'r' : `${parent}.${node.parent!.children!.indexOf(node)}`);
	});
	const keyOf = (node: HierarchyPointNode<TreeNode>) => keys.get(node)!;
	const supportOf = (d: TreeNode) => (isLeaf(d) ? null : d.support);

	const step = (2 * Math.PI) / n;
	const wedge = arc<{ a: number }>()
		.innerRadius(radius - 24)
		.outerRadius(radius + labelSpace)
		.startAngle((d) => d.a - step / 2)
		.endAngle((d) => d.a + step / 2);

	const leaves = laid.leaves().map((node, index): LayoutLeaf => {
		const d = node.data;
		if (!isLeaf(d)) throw new Error('unreachable: leaf without abbrev');
		const breed = breedOf(d.abbrev);
		if (!breed) throw new Error(`tree leaf ${d.abbrev} has no breed in breeds.json`);
		const summary = file.breeds.find((b) => b.abbrev === d.abbrev);
		const deg = (node.x * 180) / Math.PI;
		const flip = node.x > Math.PI;
		return {
			key: keyOf(node),
			x: node.x,
			y: node.y,
			support: null,
			breed,
			abbrev: d.abbrev,
			family: breed.family.id,
			cladeId: d.cladeId,
			clade: summary?.clade ?? d.cladeId,
			cladeLowSupport: summary?.cladeLowSupport ?? false,
			rotate: deg - 90,
			flip,
			hitPath: wedge({ a: node.x }) ?? '',
			index
		};
	});

	const internals = laid
		.descendants()
		.filter((node) => node.children)
		.map((node) => ({ key: keyOf(node), x: node.x, y: node.y, support: supportOf(node.data) }));

	type P = { x: number; y: number };
	const f = (v: number) => Math.round(v * 100) / 100;
	const link = (s: P, t: P) => {
		const [x0, y0] = polar(s.x, s.y);
		const [x1, y1] = polar(t.x, s.y);
		const [x2, y2] = polar(t.x, t.y);
		const sweep = t.x > s.x ? 1 : 0;
		const arcPart = s.y > 0 ? `A${f(s.y)},${f(s.y)} 0 ${Math.abs(t.x - s.x) > Math.PI ? 1 : 0} ${sweep} ${f(x1)},${f(y1)}` : '';
		return `M${f(x0)},${f(y0)}${arcPart}L${f(x2)},${f(y2)}`;
	};
	const links = laid.links().map((l) => {
		const s = supportOf(l.target.data);
		return {
			key: keyOf(l.target),
			d: link(l.source, l.target),
			lowSupport: s !== null && s < LOW_SUPPORT
		};
	});

	return { size: 2 * (radius + labelSpace), radius, leaves, internals, links };
}

/** Cartesian position of a polar point (angle, radius) around the centre. */
export const polar = (a: number, r: number): [number, number] => [r * Math.sin(a), -r * Math.cos(a)];
