/**
 * Validates the generated data files. Exits with code 1 on the first failing file.
 *
 * tree.json:
 *   - matches the Zod schema (including a non-empty `source`);
 *   - every leaf is a breed of data/sample-30.json, and every sample breed has a leaf;
 *   - leaf clade and name agree with the sample;
 *   - split leaves are coherent with `splitBreeds` and `breeds[].fragments`;
 *   - dog ids are unique and `dogs` matches `dogIds`.
 *
 * data/manual/breed-names.json:
 *   - matches the Zod schema (size variants share id, QID and FCI number);
 *   - every leaf of tree.json, and every variant listed in tree.json, has an entry;
 *   - every QID is in data/raw/wikidata-breeds.json, every FCI number in data/raw/fci-breeds/;
 *   - warnings (non-fatal): Wikidata FCI code differs from the table, unreviewed entries, doubts.
 *
 * data/manual/origin-places.json: matches its schema; every place has one P625 point in data/raw.
 *
 * src/lib/data/breeds.json:
 *   - matches the Zod schema: every factual field carries a sourceId naming one of the breed's sources;
 *   - every breed has a leaf in tree.json and every leaf belongs to exactly one breed;
 *   - id, QID, FCI number and variants agree with breed-names.json; family agrees with docs/DESIGN.md §2;
 *   - origin coordinates are the P625 point of the place in data/raw/wikidata-places.json.
 *
 * usage: node scripts/validate.ts [sample.json] [tree.json]
 */
import { readFileSync } from 'node:fs';
import { isLeaf, treeFileSchema, type TreeLeaf, type TreeNode } from '../src/lib/data/schemas/tree.ts';
import { breedNamesFileSchema } from '../src/lib/data/schemas/breed-names.ts';
import { breedsFileSchema } from '../src/lib/data/schemas/breeds.ts';
import { originPlacesFileSchema } from '../src/lib/data/schemas/places.ts';
import { parseCsv } from './lib/csv.ts';
import { qidOf, readDesignFamilies, readWikidata } from './lib/sources.ts';

const SAMPLE = process.argv[2] ?? 'data/sample-30.json';
const TREE = process.argv[3] ?? 'src/lib/data/tree.json';
const NAMES = 'data/manual/breed-names.json';
const WIKIDATA = 'data/raw/wikidata-breeds.json';
const FCI_CSV = 'data/raw/fci-breeds/fci-breeds.csv';
const PREFIXES = 'data/manual/parker-leaf-prefixes.json';
const PLACES = 'data/manual/origin-places.json';
const WD_PLACES = 'data/raw/wikidata-places.json';
const BREEDS = 'src/lib/data/breeds.json';

type SampleRow = { abbrev: string; name: string; clade: string };
const sample = new Map(
	(JSON.parse(readFileSync(SAMPLE, 'utf8')) as SampleRow[]).map((s) => [s.abbrev, s])
);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const errors: string[] = [];
const parsed = treeFileSchema.safeParse(JSON.parse(readFileSync(TREE, 'utf8')));
if (!parsed.success) {
	console.error(`${TREE}: schema errors\n${parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`);
	process.exit(1);
}
const tree = parsed.data;

const leaves: TreeLeaf[] = [];
(function walk(n: TreeNode) {
	if (isLeaf(n)) leaves.push(n);
	else n.children.forEach(walk);
})(tree.root);

const seenDogs = new Set<string>();
const leavesByBreed = new Map<string, TreeLeaf[]>();
for (const l of leaves) {
	const s = sample.get(l.abbrev);
	if (!s) errors.push(`leaf ${l.abbrev} "${l.name}" matches no breed of ${SAMPLE}`);
	else {
		if (slug(s.clade) !== l.cladeId) errors.push(`leaf ${l.abbrev}: cladeId ${l.cladeId}, sample says "${s.clade}"`);
		if (s.name !== l.name) errors.push(`leaf ${l.abbrev}: name "${l.name}", sample says "${s.name}"`);
	}
	if (l.dogs !== l.dogIds.length) errors.push(`leaf ${l.abbrev}: dogs=${l.dogs} but ${l.dogIds.length} dogIds`);
	for (const d of l.dogIds) {
		if (seenDogs.has(d)) errors.push(`dog ${d} appears twice`);
		seenDogs.add(d);
	}
	leavesByBreed.set(l.abbrev, [...(leavesByBreed.get(l.abbrev) ?? []), l]);
}

for (const ab of sample.keys()) if (!leavesByBreed.has(ab)) errors.push(`sample breed ${ab} has no leaf in the tree`);

const summaries = new Map(tree.breeds.map((b) => [b.abbrev, b]));
for (const [ab, ls] of leavesByBreed) {
	const isSplit = ls.length > 1;
	if (isSplit !== tree.splitBreeds.includes(ab)) errors.push(`${ab}: ${ls.length} leaves but splitBreeds says ${!isSplit}`);
	if (summaries.get(ab)?.fragments.sample !== ls.length) errors.push(`${ab}: breeds[].fragments.sample != ${ls.length} leaves`);
	const parts = ls.map((l) => l.split);
	if (isSplit) {
		const ok = parts.every((p, i) => p && p.part === i + 1 && p.of === ls.length);
		if (!ok) errors.push(`${ab}: split parts are not 1..${ls.length}`);
	} else if (parts[0]) errors.push(`${ab}: single leaf carries a split marker`);
	const total = ls.reduce((s, l) => s + l.dogs, 0);
	if (summaries.get(ab)?.dogs !== total) errors.push(`${ab}: breeds[].dogs != ${total} dogs in leaves`);
}
for (const ab of summaries.keys()) if (!sample.has(ab)) errors.push(`breeds[] lists ${ab}, not in ${SAMPLE}`);

// ---------------------------------------------------------------- breed-names.json
const warnings: string[] = [];
const namesParsed = breedNamesFileSchema.safeParse(JSON.parse(readFileSync(NAMES, 'utf8')));
if (!namesParsed.success) {
	errors.push(...namesParsed.error.issues.map((i) => `${NAMES}: ${i.path.join('.')}: ${i.message}`));
} else {
	const entries = new Map(namesParsed.data.entries.map((e) => [e.abbrev, e]));
	for (const ab of leavesByBreed.keys()) if (!entries.has(ab)) errors.push(`${NAMES}: no entry for tree leaf ${ab}`);
	for (const b of tree.breeds)
		for (const v of b.variants) if (!entries.has(v)) errors.push(`${NAMES}: no entry for ${v}, variant of ${b.abbrev} in ${TREE}`);

	// Wikidata: QID present in the raw fetch; FCI code (zero-padded string) compared with the table
	type Binding = Record<string, { value: string } | undefined>;
	const bindings = (JSON.parse(readFileSync(WIKIDATA, 'utf8')) as { results: { results: { bindings: Binding[] } } }).results.results.bindings;
	const wdFci = new Map<string, Set<number>>();
	for (const b of bindings) {
		const q = b.item!.value.split('/').pop()!;
		const set = wdFci.get(q) ?? new Set<number>();
		if (b.fci) set.add(Number(b.fci.value));
		wdFci.set(q, set);
	}
	// FCI export: numbers and provisional flag
	const [header, ...rows] = parseCsv(readFileSync(FCI_CSV, 'utf8'));
	const fciRows = new Map(rows.map((r) => [Number(r[header.indexOf('id')]), r]));

	for (const e of entries.values()) {
		const codes = wdFci.get(e.wikidata);
		if (!codes) errors.push(`${e.abbrev}: ${e.wikidata} missing from ${WIKIDATA} (run npm run data:wikidata)`);
		for (const a of e.alternatives)
			if (a.wikidata && !wdFci.has(a.wikidata)) errors.push(`${e.abbrev}: alternative ${a.wikidata} missing from ${WIKIDATA}`);
		const n = e.fci.number;
		if (n !== null && !fciRows.has(n)) errors.push(`${e.abbrev}: FCI ${n} not in ${FCI_CSV}`);
		for (const a of e.alternatives) if (a.fci && !fciRows.has(a.fci)) errors.push(`${e.abbrev}: alternative FCI ${a.fci} not in ${FCI_CSV}`);
		if (codes && n !== null && codes.size && !codes.has(n))
			warnings.push(`${e.abbrev}: table says FCI ${n}, Wikidata ${e.wikidata} says ${[...codes].join(', ')}`);
		if (codes && n !== null && codes.size > 1) warnings.push(`${e.abbrev}: Wikidata ${e.wikidata} carries several FCI codes (${[...codes].join(', ')})`);
	}
	const unreviewed = [...entries.values()].filter((e) => !e.reviewed);
	const withDoubts = [...entries.values()].filter((e) => e.doubts.length);
	if (unreviewed.length) warnings.push(`${NAMES}: ${unreviewed.length}/${entries.size} entries not reviewed`);
	if (withDoubts.length) warnings.push(`${NAMES}: open doubts on ${withDoubts.map((e) => e.abbrev).join(', ')}`);
}
const prefixes = JSON.parse(readFileSync(PREFIXES, 'utf8')) as { aliases: { reviewed: boolean }[] };
const unreviewedPrefixes = prefixes.aliases.filter((a) => !a.reviewed).length;
if (unreviewedPrefixes) warnings.push(`${PREFIXES}: ${unreviewedPrefixes}/${prefixes.aliases.length} aliases not reviewed`);

// ---------------------------------------------------------------- origin-places.json
const points = new Map<string, Set<string>>();
for (const b of readWikidata(WD_PLACES).results.results.bindings) {
	const q = qidOf(b.item!.value);
	const set = points.get(q) ?? new Set<string>();
	if (b.coord) set.add(b.coord.value);
	points.set(q, set);
}
const placesParsed = originPlacesFileSchema.safeParse(JSON.parse(readFileSync(PLACES, 'utf8')));
if (!placesParsed.success) errors.push(...placesParsed.error.issues.map((i) => `${PLACES}: ${i.path.join('.')}: ${i.message}`));
else {
	for (const p of placesParsed.data.entries)
		if (points.get(p.wikidata)?.size !== 1) errors.push(`${PLACES}: ${p.label} (${p.wikidata}) needs exactly one P625 point in ${WD_PLACES}`);
	const unreviewed = placesParsed.data.entries.filter((p) => !p.reviewed).length;
	if (unreviewed) warnings.push(`${PLACES}: ${unreviewed}/${placesParsed.data.entries.length} places not reviewed`);
}

// ---------------------------------------------------------------- breeds.json
const breedsParsed = breedsFileSchema.safeParse(JSON.parse(readFileSync(BREEDS, 'utf8')));
if (!breedsParsed.success) errors.push(...breedsParsed.error.issues.map((i) => `${BREEDS}: ${i.path.join('.')}: ${i.message}`));
else if (namesParsed.success) {
	const nameEntries = new Map(namesParsed.data.entries.map((e) => [e.abbrev, e]));
	const families = readDesignFamilies();
	const owner = new Map<string, string>();
	for (const b of breedsParsed.data.breeds) {
		const where = `${BREEDS}: ${b.id}`;
		for (const pe of b.parker.entries) {
			const ne = nameEntries.get(pe.abbrev);
			if (!ne) {
				errors.push(`${where}: ${pe.abbrev} not in ${NAMES}`);
				continue;
			}
			if (ne.id !== b.id) errors.push(`${where}: ${pe.abbrev} belongs to "${ne.id}" in ${NAMES}`);
			if (ne.wikidata !== b.wikidata) errors.push(`${where}: QID ${b.wikidata}, ${NAMES} says ${ne.wikidata}`);
			if (ne.fci.number !== b.fci.number) errors.push(`${where}: FCI ${b.fci.number}, ${NAMES} says ${ne.fci.number}`);
			if (ne.variant !== pe.variant) errors.push(`${where}: ${pe.abbrev} variant ${pe.variant}, ${NAMES} says ${ne.variant}`);
			if (pe.inTree !== leavesByBreed.has(pe.abbrev)) errors.push(`${where}: ${pe.abbrev} inTree=${pe.inTree} disagrees with ${TREE}`);
			if (pe.inTree) {
				if (owner.has(pe.abbrev)) errors.push(`${where}: leaf ${pe.abbrev} already belongs to ${owner.get(pe.abbrev)}`);
				owner.set(pe.abbrev, b.id);
				if (families.get(pe.abbrev) !== b.family.id) errors.push(`${where}: family ${b.family.id}, docs/DESIGN.md §2 says ${families.get(pe.abbrev)}`);
				if (summaries.get(pe.abbrev)?.cladeId !== b.parker.cladeId) errors.push(`${where}: clade ${b.parker.cladeId} disagrees with ${TREE}`);
			}
		}
		for (const ne of nameEntries.values())
			if (ne.id === b.id && !b.parker.entries.some((pe) => pe.abbrev === ne.abbrev)) errors.push(`${where}: misses Parker entry ${ne.abbrev}`);
		const coordsSource = b.sources.find((s) => s.id === b.origin.coords.sourceId);
		const pq = coordsSource?.url ? qidOf(coordsSource.url) : undefined;
		const [lon, lat] = b.origin.coords.lonLat;
		const pt = pq ? [...(points.get(pq) ?? [])][0] : undefined;
		const m = pt ? /^Point\((-?[\d.]+) (-?[\d.]+)\)$/.exec(pt) : null;
		if (!m || Number(m[1]) !== lon || Number(m[2]) !== lat)
			errors.push(`${where}: origin ${lon}, ${lat} is not the P625 point of ${pq ?? 'its source'} (${pt ?? 'none'})`);
		const used = new Set(JSON.stringify(b).match(/"sourceId":"[^"]+"/g)?.map((m) => m.slice(12, -1)));
		for (const s of b.sources) if (!used.has(s.id)) warnings.push(`${where}: source ${s.id} is never cited`);
	}
	for (const ab of leavesByBreed.keys()) if (!owner.has(ab)) errors.push(`${BREEDS}: tree leaf ${ab} belongs to no breed`);
}

if (warnings.length) console.warn(`warnings (${warnings.length})\n  ${warnings.join('\n  ')}`);
if (errors.length) {
	console.error(`${errors.length} error(s)\n  ${errors.join('\n  ')}`);
	process.exit(1);
}
console.log(`${TREE}: OK (${leaves.length} leaves, ${sample.size} breeds, ${seenDogs.size} dogs, split: ${tree.splitBreeds.join(', ') || 'none'})`);
console.log(`${NAMES}: OK (every tree leaf and variant has an entry; QIDs and FCI numbers found in data/raw)`);
console.log(`${BREEDS}: OK (${breedsParsed.data?.breeds.length} breeds, one per tree leaf, every fact sourced)`);
