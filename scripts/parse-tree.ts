/**
 * Builds src/lib/data/tree.json: the Parker et al. 2017 tree restricted to a breed set, with ALL
 * dogs of each breed grouped together.
 *
 * Breed set (explicit input): by default every supplement-1 abbreviation that has leaves in the
 * tree, except the wild canids (NOT_BREEDS: grey wolf, golden jackal, the outgroups). With
 * `--sample <file>` (e.g. data/sample-30.json) the tree is restricted to that sample instead.
 *
 * Inputs (produced by extract-parker.ts, plus one manual table):
 *   data/raw/parker2017-s5.nex                 individual-level NEXUS tree (supplement 5)
 *   data/raw/parker2017-s1.csv                 breed table: name, abbreviation, clade (supplement 1)
 *   data/manual/parker-leaf-prefixes.json      leaf prefixes that are not supplement-1 abbreviations
 *   --sample <file>                            optional sample ([{abbrev, name, clade}])
 *
 * Grouping rule: the tree is pruned to the sample's dogs, then every maximal subtree whose dogs
 * all belong to one breed becomes one leaf. A breed whose dogs end up in several such subtrees
 * is NOT merged: it yields one leaf per fragment (`split: {part, of}`) and is listed in
 * `splitBreeds`. Monophyly in the full 1 355-leaf tree is reported too.
 *
 * usage: node scripts/parse-tree.ts [--sample data/sample-30.json] [--out src/lib/data/tree.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv } from './lib/csv.ts';
import {
	treeFileSchema,
	type BreedSummary,
	type TreeInternal,
	type TreeLeaf,
	type TreeNode
} from '../src/lib/data/schemas/tree.ts';

const NEX = 'data/raw/parker2017-s5.nex';
const CSV = 'data/raw/parker2017-s1.csv';
const PREFIXES = 'data/manual/parker-leaf-prefixes.json';
const arg = (name: string) => {
	const i = process.argv.indexOf(name);
	return i < 0 ? null : (process.argv[i + 1] ?? null);
};
const SAMPLE = arg('--sample');
const OUT = arg('--out') ?? 'src/lib/data/tree.json';
/** Supplement-1 rows that are not dog breeds: wild canids sampled as outgroups. Never shown. */
const NOT_BREEDS: Record<string, string> = {
	WOLF: 'Grey Wolf (Canis lupus): wild canid, outgroup of the Parker tree, not a breed',
	GDJK: 'Golden Jackal (Canis aureus): wild canid, outgroup of the Parker tree, not a breed'
};

const warnings: string[] = [];
const errors: string[] = [];
const warn = (m: string) => warnings.push(m);

// ---------------------------------------------------------------- breed table (supplement 1)
type Breed = { abbrev: string; name: string; clade: string | null; lowSupport: boolean; total: number };

const [header, ...body] = parseCsv(readFileSync(CSV, 'utf8'));
const col = (name: string) => {
	const i = header.indexOf(name);
	if (i < 0) throw new Error(`${CSV}: missing column "${name}"`);
	return i;
};
const [cName, cAbbrev, cClade, cTotal] = ['Breed', 'Abrev.', 'Clade', 'Total'].map(col);

const rawRows = body.filter((r) => /^[A-Z0-9]*[A-Z][A-Z0-9]*$/.test(r[cAbbrev] ?? ''));
// Clade labels: the table has typos ("NewWorld" next to "New World"); the canonical spelling is
// the most frequent one among labels that are equal once spaces are removed.
const cladeKey = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const spellings = new Map<string, Map<string, number>>();
for (const r of rawRows) {
	const label = r[cClade].replace('*', '').trim();
	if (!label) continue;
	const m = spellings.get(cladeKey(label)) ?? new Map<string, number>();
	m.set(label, (m.get(label) ?? 0) + 1);
	spellings.set(cladeKey(label), m);
}
const canonicalClade = (label: string) =>
	[...(spellings.get(cladeKey(label)) ?? new Map([[label, 1]]))].sort((a, b) => b[1] - a[1])[0][0];

const table = new Map<string, Breed>();
for (const r of rawRows) {
	const raw = r[cClade].trim();
	const label = raw.replace('*', '').trim();
	const clade = label ? canonicalClade(label) : null;
	if (label && clade !== label) warn(`clade label "${raw}" (${r[cAbbrev]}) normalised to "${clade}"`);
	table.set(r[cAbbrev], {
		abbrev: r[cAbbrev],
		name: r[cName].trim(),
		clade,
		lowSupport: raw.includes('*'),
		total: Number(r[cTotal])
	});
}

// ---------------------------------------------------------------- leaf prefixes (manual)
type Alias = { prefix: string; abbrev: string; leaves: number; basis: string; reviewed: boolean };
const aliases = new Map<string, Alias>(
	(JSON.parse(readFileSync(PREFIXES, 'utf8')) as { aliases: Alias[] }).aliases.map((a) => [a.prefix, a])
);
for (const a of aliases.values()) {
	if (!table.has(a.abbrev)) errors.push(`${PREFIXES}: alias ${a.prefix} -> unknown abbreviation ${a.abbrev}`);
}

// ---------------------------------------------------------------- breed set
for (const ab of Object.keys(NOT_BREEDS)) if (!table.has(ab)) errors.push(`NOT_BREEDS: ${ab} is not in supplement 1`);
type SampleRow = { abbrev: string; name: string; clade: string };
const sample: SampleRow[] | null = SAMPLE ? JSON.parse(readFileSync(SAMPLE, 'utf8')) : null;
for (const s of sample ?? []) {
	const b = table.get(s.abbrev);
	if (!b) errors.push(`${SAMPLE}: ${s.abbrev} is not in supplement 1`);
	else if (b.clade !== canonicalClade(s.clade))
		errors.push(`${SAMPLE}: ${s.abbrev} clade "${s.clade}" differs from supplement 1 "${b.clade}"`);
}

// ---------------------------------------------------------------- newick
type RawNode = { label: string; value: number | null; children: RawNode[]; parent?: RawNode };

function parseNewick(src: string): RawNode {
	let i = 0;
	const node = (): RawNode => {
		const n: RawNode = { label: '', value: null, children: [] };
		if (src[i] === '(') {
			i++;
			for (;;) {
				const c = node();
				c.parent = n;
				n.children.push(c);
				if (src[i] === ',') i++;
				else if (src[i] === ')') {
					i++;
					break;
				} else throw new Error(`newick: unexpected "${src[i]}" at ${i}`);
			}
		}
		const m = /^([^:,();]*)(?::([0-9.eE+-]+))?/.exec(src.slice(i, i + 64))!;
		n.label = m[1];
		n.value = m[2] === undefined ? null : Number(m[2]);
		i += m[0].length;
		return n;
	};
	const root = node();
	if (src[i] !== undefined) throw new Error(`newick: trailing text at ${i}`);
	return root;
}

const nexus = readFileSync(NEX, 'utf8');
const treeMatch = /\[&R\]([\s\S]*?);/.exec(nexus);
if (!treeMatch) throw new Error(`${NEX}: no rooted tree found`);
const full = parseNewick(treeMatch[1].replace(/\s+/g, ''));

// ---------------------------------------------------------------- leaves -> breeds
const leaves: RawNode[] = [];
(function walk(n: RawNode) {
	if (!n.children.length) leaves.push(n);
	n.children.forEach(walk);
})(full);

const abbrevOf = new Map<RawNode, string>();
const usedAliases = new Map<string, number>();
const unknownPrefixes = new Set<string>();
for (const l of leaves) {
	const prefix = l.label.split('_')[0];
	if (table.has(prefix)) abbrevOf.set(l, prefix);
	else if (aliases.has(prefix)) {
		abbrevOf.set(l, aliases.get(prefix)!.abbrev);
		usedAliases.set(prefix, (usedAliases.get(prefix) ?? 0) + 1);
	} else unknownPrefixes.add(prefix);
}
if (unknownPrefixes.size) errors.push(`leaf prefixes with no breed: ${[...unknownPrefixes].join(', ')}`);
for (const [prefix, n] of usedAliases) {
	const a = aliases.get(prefix)!;
	if (a.leaves !== n) errors.push(`${PREFIXES}: ${prefix} declares ${a.leaves} leaves, tree has ${n}`);
}

const dogsByBreed = new Map<string, RawNode[]>();
for (const [l, ab] of abbrevOf) dogsByBreed.set(ab, [...(dogsByBreed.get(ab) ?? []), l]);
const sampleSet = new Set(
	sample ? sample.map((s) => s.abbrev) : [...table.keys()].filter((ab) => dogsByBreed.has(ab) && !(ab in NOT_BREEDS))
);
for (const ab of table.keys()) if (!dogsByBreed.has(ab) && !(ab in NOT_BREEDS)) warn(`${ab}: in supplement 1 but no leaf in the tree, left out`);
for (const ab of sampleSet) if (ab in NOT_BREEDS) errors.push(`${SAMPLE}: ${ab} is not a breed (${NOT_BREEDS[ab]})`);
const setAbbrevs = [...table.keys()].filter((ab) => sampleSet.has(ab));
for (const ab of sampleSet) {
	const n = dogsByBreed.get(ab)?.length ?? 0;
	const b = table.get(ab);
	if (n === 0) errors.push(`${ab}: no dog in the tree`);
	else if (b && b.total !== n) warn(`${ab}: ${n} dogs in the tree, supplement 1 says Total ${b.total}`);
	const viaAlias = [...usedAliases.keys()].filter((p) => aliases.get(p)!.abbrev === ab);
	for (const p of viaAlias)
		if (!aliases.get(p)!.reviewed) warn(`${ab}: includes ${usedAliases.get(p)} "${p}_" dogs via an UNREVIEWED alias`);
}

if (errors.length) {
	console.error('parse-tree failed:\n  ' + errors.join('\n  '));
	process.exit(1);
}

// ---------------------------------------------------------------- full-tree monophyly
/** Breed counts under every node of the full tree. */
const counts = new Map<RawNode, Map<string, number>>();
(function count(n: RawNode): Map<string, number> {
	const m = new Map<string, number>();
	if (!n.children.length) m.set(abbrevOf.get(n)!, 1);
	for (const c of n.children) for (const [k, v] of count(c)) m.set(k, (m.get(k) ?? 0) + v);
	counts.set(n, m);
	return m;
})(full);

function fullTreeStats(ab: string) {
	const total = dogsByBreed.get(ab)!.length;
	// MRCA: descend while one child still holds every dog of the breed.
	let mrca = full;
	for (;;) {
		const next = mrca.children.find((c) => counts.get(c)!.get(ab) === total);
		if (!next) break;
		mrca = next;
	}
	const intruders = [...counts.get(mrca)!.keys()].filter((k) => k !== ab).sort();
	// Fragments: maximal subtrees made only of this breed's dogs, with their sister group.
	const parts: { dogs: number; sister: string }[] = [];
	(function frag(n: RawNode) {
		const m = counts.get(n)!;
		if (!m.has(ab)) return;
		if (m.size === 1) {
			const sister = new Map<string, number>();
			for (const s of n.parent?.children ?? [])
				if (s !== n) for (const [k, v] of counts.get(s)!) sister.set(k, (sister.get(k) ?? 0) + v);
			const desc = [...sister].sort((a, b) => b[1] - a[1]);
			parts.push({
				dogs: m.get(ab)!,
				sister: desc.slice(0, 4).map(([k, v]) => `${k}×${v}`).join(' ') + (desc.length > 4 ? ` +${desc.length - 4} breeds` : '')
			});
		} else n.children.forEach(frag);
	})(mrca);
	return { intruders, fragments: parts.length, parts };
}

/** Other supplement-1 entries sharing the breed's base name ("Xoloitzcuintle - Miniature"). */
const baseName = (name: string) => name.split(' - ')[0].trim().toLowerCase();
const variantsOf = (ab: string) =>
	[...table.values()]
		.filter((b) => b.abbrev !== ab && baseName(b.name) === baseName(table.get(ab)!.name))
		.map((b) => b.abbrev);

// ---------------------------------------------------------------- prune + group
type Work = { leaf?: { abbrev: string; dogIds: string[] }; support: number | null; children: Work[] };

function prune(n: RawNode): Work | null {
	if (!n.children.length) {
		const ab = abbrevOf.get(n)!;
		return sampleSet.has(ab) ? { leaf: { abbrev: ab, dogIds: [n.label] }, support: null, children: [] } : null;
	}
	const kids = n.children.map(prune).filter((k): k is Work => k !== null);
	if (!kids.length) return null;
	if (kids.length === 1) return kids[0]; // collapse unary nodes, keep the lower node's support
	return { support: n.value, children: kids };
}

/** Collapses every maximal single-breed subtree into one leaf. */
function group(w: Work): Work {
	if (w.leaf) return w;
	const kids = w.children.map(group);
	const breeds = new Set(kids.map((k) => k.leaf?.abbrev ?? null));
	if (breeds.size === 1 && !breeds.has(null)) {
		return { leaf: { abbrev: kids[0].leaf!.abbrev, dogIds: kids.flatMap((k) => k.leaf!.dogIds) }, support: null, children: [] };
	}
	return { ...w, children: kids };
}

const prunedRoot = prune(full);
if (!prunedRoot || prunedRoot.leaf) throw new Error('pruned tree is empty or a single leaf');
const grouped = group(prunedRoot);

const fragmentLeaves = new Map<string, Work[]>();
(function collect(w: Work) {
	if (w.leaf) fragmentLeaves.set(w.leaf.abbrev, [...(fragmentLeaves.get(w.leaf.abbrev) ?? []), w]);
	w.children.forEach(collect);
})(grouped);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function emit(w: Work): TreeNode {
	if (w.leaf) {
		const b = table.get(w.leaf.abbrev)!;
		const parts = fragmentLeaves.get(w.leaf.abbrev)!;
		const leaf: TreeLeaf = {
			name: b.name,
			abbrev: b.abbrev,
			cladeId: b.clade ? slug(b.clade) : null,
			dogs: w.leaf.dogIds.length,
			dogIds: w.leaf.dogIds
		};
		if (parts.length > 1) leaf.split = { part: parts.indexOf(w) + 1, of: parts.length };
		return leaf;
	}
	return { support: w.support, children: w.children.map(emit) };
}

// ---------------------------------------------------------------- output
const breeds: BreedSummary[] = setAbbrevs.map((ab) => {
	const b = table.get(ab)!;
	const stats = fullTreeStats(ab);
	if (!b.clade) warn(`${ab} (${b.name}): no clade in supplement 1`);
	return {
		abbrev: b.abbrev,
		name: b.name,
		clade: b.clade,
		cladeId: b.clade ? slug(b.clade) : null,
		cladeLowSupport: b.lowSupport,
		dogs: dogsByBreed.get(ab)!.length,
		fragments: { tree: fragmentLeaves.get(ab)?.length ?? 0, full: stats.fragments },
		fullTreeIntruders: stats.intruders.filter((k) => !(k in NOT_BREEDS)),
		variants: variantsOf(ab)
	};
});

const splitBreeds = breeds.filter((b) => b.fragments.tree > 1).map((b) => b.abbrev);

const file = treeFileSchema.parse({
	source: {
		citation:
			'Parker HG, Dreger DL, Rimbault M, et al. Genomic Analyses Reveal the Influence of Geographic Origin, Migration, and Hybridization on Modern Dog Breed Development. Cell Reports 19(4):697-708, 2017.',
		doi: '10.1016/j.celrep.2017.03.079',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5492993',
		licence: {
			name: 'CC BY 4.0',
			url: 'https://creativecommons.org/licenses/by/4.0/',
			basis: 'Crossref metadata of DOI 10.1016/j.celrep.2017.03.079, licence of the version of record (content-version "vor")',
			checked: '2026-11-09'
		},
		files: [
			'NIHMS866262-supplement-5 (NEXUS tree, one leaf per dog)',
			'NIHMS866262-supplement-1 (breed table: name, abbreviation, clade)'
		],
		notes: [
			sample
				? `Restricted to the breeds of ${SAMPLE}; every dog of each breed is kept.`
				: 'Every breed of supplement 1 with leaves in the tree, wild canids excluded; every dog of each breed is kept.',
			'support = bootstrap of the same node in the full tree; on the pruned tree it does not measure the displayed grouping exactly.',
			`Leaf prefixes from the Vaysse 2011 dataset mapped through ${PREFIXES}.`
		]
	},
	generatedBy: 'scripts/parse-tree.ts',
	breedSet: {
		rule: sample ? 'sample' : 'all-supplement-1-with-leaves',
		sample: SAMPLE,
		excluded: Object.entries(NOT_BREEDS).map(([abbrev, reason]) => ({ abbrev, reason }))
	},
	breeds,
	splitBreeds,
	root: emit(grouped) as TreeInternal
});

writeFileSync(OUT, JSON.stringify(file, null, '\t') + '\n');

// ---------------------------------------------------------------- report
console.log(`full tree: ${leaves.length} leaves, ${table.size} abbreviations in supplement 1`);
console.log(`breed set (${sample ? SAMPLE : 'all'}): ${breeds.length} breeds, ${breeds.reduce((s, b) => s + b.dogs, 0)} dogs -> ${OUT}`);
console.log('\nbreed  dogs  fragments(sample/full)  clade');
for (const b of breeds) {
	const flag = b.fragments.tree > 1 ? '  << SPLIT' : b.fragments.full > 1 ? '  < split in full tree' : '';
	console.log(
		`${b.abbrev.padEnd(6)} ${String(b.dogs).padStart(4)}  ${`${b.fragments.tree}/${b.fragments.full}`.padStart(9)}              ${b.clade ?? '(no clade)'}${b.cladeLowSupport ? ' (*<50%)' : ''}${flag}`
	);
}
const printFull = (ab: string) => {
	const st = fullTreeStats(ab);
	console.log(`  full tree: ${st.fragments} fragment(s); other breeds under the MRCA: ${st.intruders.length > 12 ? `${st.intruders.length} breeds` : st.intruders.join(', ') || 'none'}`);
	st.parts.forEach((p, i) => console.log(`    fragment ${i + 1}: ${p.dogs} dogs, sister group: ${p.sister}`));
};
for (const b of breeds.filter((x) => x.fragments.tree > 1 || x.fragments.full > 1)) {
	const parts = (fragmentLeaves.get(b.abbrev) ?? []).map((w) => w.leaf!.dogIds.join(' '));
	console.log(`\n${b.fragments.tree > 1 ? 'SPLIT in this tree' : 'split in full tree only'}: ${b.abbrev} (${b.name})`);
	parts.forEach((p, i) => console.log(`  tree fragment ${i + 1}/${parts.length}: ${p}`));
	printFull(b.abbrev);
}
for (const b of breeds.filter((x) => x.variants.length)) {
	for (const v of b.variants) {
		const vb = table.get(v)!;
		console.log(`\nVARIANT not merged: ${v} "${vb.name}" (${vb.clade ?? 'no clade'}${vb.lowSupport ? ', *<50%' : ''}) next to breed ${b.abbrev} "${b.name}"`);
		printFull(v);
	}
}
if (warnings.length) console.log('\nwarnings:\n  ' + warnings.join('\n  '));
