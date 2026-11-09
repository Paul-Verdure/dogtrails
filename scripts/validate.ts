/**
 * Validates the generated data files. Exits with code 1 on the first failing file.
 *
 * tree.json:
 *   - matches the Zod schema (including a non-empty `source`);
 *   - the breed set is the one `breedSet` declares: every supplement-1 breed with leaves (wild canids
 *     excluded), or the breeds of the sample file; every breed of the set has a leaf;
 *   - leaf clade and name agree with breeds[] (and with the sample in sample mode);
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
 *   - id, QID, FCI number and variants agree with breed-names.json; family agrees with docs/DESIGN.md §2
 *     for the 30 first breeds and with data/manual/families.json for the others;
 *   - origin coordinates are the P625 point of the place in data/raw/wikidata-places.json.

 * data/manual/families.json: matches its schema, one entry per breed outside docs/DESIGN.md §2.
 *
 * src/lib/data/images.json:
 *   - matches the Zod schema: free licence, author, file page and Wikimedia thumbnail for every image;
 *   - every image belongs to a known breed and is that breed's `image.commonsFile`;
 *   - every file is in data/raw/commons-imageinfo.json.
 *
 * usage: node scripts/validate.ts [tree.json]
 */
import { existsSync, readFileSync } from 'node:fs';
import { isLeaf, treeFileSchema, type TreeLeaf, type TreeNode } from '../src/lib/data/schemas/tree.ts';
import { breedNamesFileSchema } from '../src/lib/data/schemas/breed-names.ts';
import { breedsFileSchema } from '../src/lib/data/schemas/breeds.ts';
import { displayNamesFileSchema } from '../src/lib/data/schemas/display-names.ts';
import { originPlacesFileSchema } from '../src/lib/data/schemas/places.ts';
import { photosFileSchema } from '../src/lib/data/schemas/photos.ts';
import { familiesFileSchema } from '../src/lib/data/schemas/families.ts';
import { imagesFileSchema } from '../src/lib/data/schemas/images.ts';
import { parseCsv } from './lib/csv.ts';
import { qidOf, readDesignFamilies, readWikidata } from './lib/sources.ts';

const TREE = process.argv[2] ?? 'src/lib/data/tree.json';
const S1 = 'data/raw/parker2017-s1.csv';
const FAMILIES = 'data/manual/families.json';
const NAMES = 'data/manual/breed-names.json';
const WIKIDATA = 'data/raw/wikidata-breeds.json';
const FCI_CSV = 'data/raw/fci-breeds/fci-breeds.csv';
const PREFIXES = 'data/manual/parker-leaf-prefixes.json';
const PLACES = 'data/manual/origin-places.json';
const WD_PLACES = 'data/raw/wikidata-places.json';
const BREEDS = 'src/lib/data/breeds.json';
const IMAGES = 'src/lib/data/images.json';
const COMMONS = 'data/raw/commons-imageinfo.json';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const errors: string[] = [];
const parsed = treeFileSchema.safeParse(JSON.parse(readFileSync(TREE, 'utf8')));
if (!parsed.success) {
	console.error(`${TREE}: schema errors\n${parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`);
	process.exit(1);
}
const tree = parsed.data;

// ---------------------------------------------------------------- breed set
type SampleRow = { abbrev: string; name: string; clade: string };
const SAMPLE = tree.breedSet.sample;
const sample = SAMPLE
	? new Map((JSON.parse(readFileSync(SAMPLE, 'utf8')) as SampleRow[]).map((s) => [s.abbrev, s]))
	: null;
if ((tree.breedSet.rule === 'sample') !== (SAMPLE !== null)) errors.push(`${TREE}: breedSet.rule and breedSet.sample disagree`);
const excluded = new Set(tree.breedSet.excluded.map((e) => e.abbrev));
const [s1Header, ...s1Rows] = parseCsv(readFileSync(S1, 'utf8'));
const s1 = new Map(
	s1Rows
		.filter((r) => /^[A-Z0-9]*[A-Z][A-Z0-9]*$/.test(r[s1Header.indexOf('Abrev.')] ?? ''))
		.map((r) => [r[s1Header.indexOf('Abrev.')], r[s1Header.indexOf('Breed')].trim()])
);
for (const ab of excluded) if (!s1.has(ab)) errors.push(`${TREE}: excluded ${ab} is not in ${S1}`);

const leaves: TreeLeaf[] = [];
(function walk(n: TreeNode) {
	if (isLeaf(n)) leaves.push(n);
	else n.children.forEach(walk);
})(tree.root);

const seenDogs = new Set<string>();
const leavesByBreed = new Map<string, TreeLeaf[]>();
const summaries = new Map(tree.breeds.map((b) => [b.abbrev, b]));
for (const l of leaves) {
	const b = summaries.get(l.abbrev);
	if (!b) errors.push(`leaf ${l.abbrev} "${l.name}" is not in breeds[]`);
	else if (b.cladeId !== l.cladeId || b.name !== l.name) errors.push(`leaf ${l.abbrev}: name or clade differs from breeds[]`);
	if (s1.get(l.abbrev) !== l.name) errors.push(`leaf ${l.abbrev}: name "${l.name}", ${S1} says "${s1.get(l.abbrev)}"`);
	if (excluded.has(l.abbrev)) errors.push(`leaf ${l.abbrev}: excluded from the breed set (${TREE} breedSet)`);
	const s = sample?.get(l.abbrev);
	if (sample && !s) errors.push(`leaf ${l.abbrev} "${l.name}" matches no breed of ${SAMPLE}`);
	else if (s) {
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

const expected = sample ? [...sample.keys()] : [...s1.keys()].filter((ab) => !excluded.has(ab));
for (const ab of expected) if (!leavesByBreed.has(ab)) errors.push(`breed ${ab} of the breed set has no leaf in the tree`);

for (const [ab, ls] of leavesByBreed) {
	const isSplit = ls.length > 1;
	if (isSplit !== tree.splitBreeds.includes(ab)) errors.push(`${ab}: ${ls.length} leaves but splitBreeds says ${!isSplit}`);
	if (summaries.get(ab)?.fragments.tree !== ls.length) errors.push(`${ab}: breeds[].fragments.tree != ${ls.length} leaves`);
	const parts = ls.map((l) => l.split);
	if (isSplit) {
		const ok = parts.every((p, i) => p && p.part === i + 1 && p.of === ls.length);
		if (!ok) errors.push(`${ab}: split parts are not 1..${ls.length}`);
	} else if (parts[0]) errors.push(`${ab}: single leaf carries a split marker`);
	const total = ls.reduce((s, l) => s + l.dogs, 0);
	if (summaries.get(ab)?.dogs !== total) errors.push(`${ab}: breeds[].dogs != ${total} dogs in leaves`);
}
for (const ab of summaries.keys()) if (!leavesByBreed.has(ab)) errors.push(`breeds[] lists ${ab}, which has no leaf`);

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

// ---------------------------------------------------------------- display-names.json
{
	const DISPLAY = 'data/manual/display-names.json';
	const parsed = displayNamesFileSchema.safeParse(JSON.parse(readFileSync(DISPLAY, 'utf8')));
	if (!parsed.success) errors.push(...parsed.error.issues.map((i) => `${DISPLAY}: ${i.path.join('.')}: ${i.message}`));
	else {
		const unreviewed = parsed.data.entries.filter((e) => !e.reviewed).length;
		if (unreviewed) warnings.push(`${DISPLAY}: ${unreviewed}/${parsed.data.entries.length} display names not reviewed`);
	}
}

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
	const famParsed = familiesFileSchema.safeParse(JSON.parse(readFileSync(FAMILIES, 'utf8')));
	if (!famParsed.success) errors.push(...famParsed.error.issues.map((i) => `${FAMILIES}: ${i.path.join('.')}: ${i.message}`));
	const drafted = new Map((famParsed.data?.entries ?? []).map((e) => [e.id, e]));
	const ids = new Set(breedsParsed.data.breeds.map((b) => b.id));
	for (const id of drafted.keys()) if (!ids.has(id)) errors.push(`${FAMILIES}: unknown breed ${id}`);
	const unreviewedFamilies = [...drafted.values()].filter((e) => !e.reviewed).length;
	if (unreviewedFamilies) warnings.push(`${FAMILIES}: ${unreviewedFamilies}/${drafted.size} families not reviewed`);
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
				if (summaries.get(pe.abbrev)?.cladeId !== b.parker.cladeId) errors.push(`${where}: clade ${b.parker.cladeId} disagrees with ${TREE}`);
			}
		}
		const design = [...new Set(b.parker.entries.flatMap((pe) => (families.has(pe.abbrev) ? [families.get(pe.abbrev)] : [])))];
		const expectedFamily = design.length ? design : drafted.has(b.id) ? [drafted.get(b.id)!.family] : [];
		if (design.length && drafted.has(b.id)) errors.push(`${where}: family set in docs/DESIGN.md §2 and in ${FAMILIES}`);
		if (expectedFamily.length !== 1 || expectedFamily[0] !== b.family.id)
			errors.push(`${where}: family ${b.family.id}, expected ${expectedFamily.join(' or ') || 'none'} (docs/DESIGN.md §2, ${FAMILIES})`);
		for (const ne of nameEntries.values())
			if (ne.id === b.id && !b.parker.entries.some((pe) => pe.abbrev === ne.abbrev)) errors.push(`${where}: misses Parker entry ${ne.abbrev}`);
		if (b.origin) {
			const coordsSource = b.sources.find((s) => s.id === b.origin!.coords.sourceId);
			const pq = coordsSource?.url ? qidOf(coordsSource.url) : undefined;
			const [lon, lat] = b.origin.coords.lonLat;
			const pt = pq ? [...(points.get(pq) ?? [])][0] : undefined;
			const m = pt ? /^Point\((-?[\d.]+) (-?[\d.]+)\)$/.exec(pt) : null;
			if (!m || Number(m[1]) !== lon || Number(m[2]) !== lat)
				errors.push(`${where}: origin ${lon}, ${lat} is not the P625 point of ${pq ?? 'its source'} (${pt ?? 'none'})`);
		} else if (b.fci.number !== null) errors.push(`${where}: has an FCI number but no origin`);
		else warnings.push(`${where}: no origin (no FCI number, no Wikidata P495)`);
		const used = new Set(JSON.stringify(b).match(/"(?:sourceId|[a-z]+SourceId)":"[^"]+"/g)?.map((m) => m.split('":"')[1].slice(0, -1)));
		for (const s of b.sources) if (!used.has(s.id)) warnings.push(`${where}: source ${s.id} is never cited`);
	}
	for (const ab of leavesByBreed.keys()) if (!owner.has(ab)) errors.push(`${BREEDS}: tree leaf ${ab} belongs to no breed`);
}

// ---------------------------------------------------------------- images.json
const PHOTOS = 'data/manual/photos.json';
const photosParsed = photosFileSchema.safeParse(JSON.parse(readFileSync(PHOTOS, 'utf8')));
if (!photosParsed.success) errors.push(...photosParsed.error.issues.map((i) => `${PHOTOS}: ${i.path.join('.')}: ${i.message}`));
const photoChoices = new Map((photosParsed.data?.entries ?? []).map((e) => [e.breedId, e]));
{
	const unreviewed = (photosParsed.data?.entries ?? []).filter((e) => !e.reviewed).length;
	if (unreviewed) warnings.push(`${PHOTOS}: ${unreviewed}/${photoChoices.size} photo choices not reviewed`);
}
const imagesParsed = imagesFileSchema.safeParse(JSON.parse(readFileSync(IMAGES, 'utf8')));
if (!imagesParsed.success) errors.push(...imagesParsed.error.issues.map((i) => `${IMAGES}: ${i.path.join('.')}: ${i.message}`));
else if (breedsParsed.success) {
	const byId = new Map(breedsParsed.data.breeds.map((b) => [b.id, b]));
	const commons = JSON.parse(readFileSync(COMMONS, 'utf8')) as { responses: { query: { pages: { title: string }[] } }[] };
	const fetched = new Set(commons.responses.flatMap((r) => r.query.pages.map((p) => p.title.replace(/^File:/, ''))));
	for (const im of imagesParsed.data.images) {
		const b = byId.get(im.breedId);
		if (!b) errors.push(`${IMAGES}: unknown breed ${im.breedId}`);
		else {
			const picked = photoChoices.get(im.breedId);
			const expected = picked?.file ?? b.image?.commonsFile;
			if (expected !== im.file) errors.push(`${IMAGES}: ${im.breedId} shows "${im.file}", expected "${expected ?? 'no image'}" (${picked?.file ? PHOTOS : BREEDS})`);
			if (im.chosenBy !== (picked?.file ? PHOTOS : 'wikidata-p18')) errors.push(`${IMAGES}: ${im.breedId}: chosenBy does not match ${PHOTOS}`);
			if (im.authorFrom !== (picked?.author ? PHOTOS : 'commons-extmetadata') || (picked?.author && picked.author !== im.author))
				errors.push(`${IMAGES}: ${im.breedId}: author does not match ${PHOTOS}`);
		}
		if (!existsSync(`static/${im.thumb.path}`)) errors.push(`${IMAGES}: ${im.breedId}: static/${im.thumb.path} is missing (run npm run data:credits)`);
		if (!fetched.has(im.file.replace(/_/g, ' '))) errors.push(`${IMAGES}: ${im.file} not in ${COMMONS} (run npm run data:credits)`);
	}
	const missing = breedsParsed.data.breeds.length - imagesParsed.data.images.length;
	if (missing) warnings.push(`${IMAGES}: ${missing} breed(s) without a credited photo, see data/reports/images.md`);
}

if (warnings.length) console.warn(`warnings (${warnings.length})\n  ${warnings.join('\n  ')}`);
if (errors.length) {
	console.error(`${errors.length} error(s)\n  ${errors.join('\n  ')}`);
	process.exit(1);
}
console.log(`${TREE}: OK (${leaves.length} leaves, ${tree.breeds.length} breeds, ${seenDogs.size} dogs, split: ${tree.splitBreeds.join(', ') || 'none'})`);
console.log(`${NAMES}: OK (every tree leaf and variant has an entry; QIDs and FCI numbers found in data/raw)`);
console.log(`${BREEDS}: OK (${breedsParsed.data?.breeds.length} breeds, one per tree leaf, every fact sourced)`);
console.log(`${IMAGES}: OK (${imagesParsed.data?.images.length} credited photos, free licences only)`);
