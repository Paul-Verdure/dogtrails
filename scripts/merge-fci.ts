/**
 * Builds src/lib/data/breeds.json: one breed per site id that has a leaf in tree.json.
 *
 *   data/manual/breed-names.json     Parker abbreviation -> id, variant, QID, FCI number (reviewed)
 *   data/manual/origin-places.json   FCI country -> place (kind, ISO, Wikidata item of the point)
 *   src/lib/data/tree.json           Parker clade of the tree breeds
 *   data/raw/fci-breeds/             FCI group, section, country, provisional date
 *   data/raw/wikidata-breeds.json    labels EN/FR/NL, P495 (cross-check only), P18 image
 *   data/raw/wikidata-places.json    P625 point of each origin place
 *   docs/DESIGN.md §2                family of the 30 first breeds (editorial choice, not a datum)
 *   data/manual/families.json        family of every other breed (editorial, drafts reviewed by Paul)
 *   data/manual/display-names.json   English display name when the Wikidata label is not the usual one
 *
 * Origin rule (Paul, 2026-11-04): origin = FCI country; Wikidata P495 only cross-checks; FCI regions
 * stay regions; a breed without FCI number takes its origin from P495. `development` and `fixedAround`
 * stay empty until a source gives them. A breed with neither FCI number nor P495 gets origin = null. Disagreements go to data/reports/breeds.md, never resolved here.
 *
 * usage: node scripts/merge-fci.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { breedNamesFileSchema, type BreedNameEntry } from '../src/lib/data/schemas/breed-names.ts';
import { displayNamesFileSchema } from '../src/lib/data/schemas/display-names.ts';
import { originPlacesFileSchema, type OriginPlace } from '../src/lib/data/schemas/places.ts';
import { treeFileSchema } from '../src/lib/data/schemas/tree.ts';
import { familiesFileSchema, type FamilyEntry } from '../src/lib/data/schemas/families.ts';
import { breedsFileSchema, familySchema, type Breed, type BreedSource } from '../src/lib/data/schemas/breeds.ts';
import {
	FCI_GROUPS,
	PLAN_COUNTRY,
	qidOf,
	readDesignFamilies,
	readDesignUnverified,
	readFci,
	readPlanSample,
	readWikidata
} from './lib/sources.ts';

const NAMES = 'data/manual/breed-names.json';
const PLACES = 'data/manual/origin-places.json';
const TREE = 'src/lib/data/tree.json';
const WD_BREEDS = 'data/raw/wikidata-breeds.json';
const WD_PLACES = 'data/raw/wikidata-places.json';
const DESIGN = 'docs/DESIGN.md';
const DISPLAY = 'data/manual/display-names.json';
const FAMILIES = 'data/manual/families.json';
const OUT = 'src/lib/data/breeds.json';
const REPORT = 'data/reports/breeds.md';
/** Parker supplements were added to data/raw in commit 52b4587. */
const PARKER_RETRIEVED = '2026-11-04';

const errors: string[] = [];
const names = breedNamesFileSchema.parse(JSON.parse(readFileSync(NAMES, 'utf8')));
const display = new Map(displayNamesFileSchema.parse(JSON.parse(readFileSync(DISPLAY, 'utf8'))).entries.map((e) => [e.id, e]));
const places = originPlacesFileSchema.parse(JSON.parse(readFileSync(PLACES, 'utf8')));
const tree = treeFileSchema.parse(JSON.parse(readFileSync(TREE, 'utf8')));
const fci = readFci();
const wdBreeds = readWikidata(WD_BREEDS);
const wdPlaces = readWikidata(WD_PLACES);
const families = readDesignFamilies(DESIGN);
const familyTable = new Map(familiesFileSchema.parse(JSON.parse(readFileSync(FAMILIES, 'utf8'))).entries.map((e) => [e.id, e]));
const plan = readPlanSample();
const day = (iso: string) => iso.slice(0, 10);

// ---------------------------------------------------------------- Wikidata, folded per item
type WdBreed = { en?: string; fr?: string; nl?: string; origins: Map<string, { label: string; iso?: string }>; images: Set<string> };
const wd = new Map<string, WdBreed>();
for (const b of wdBreeds.results.results.bindings) {
	const q = qidOf(b.item!.value);
	const it: WdBreed = wd.get(q) ?? { origins: new Map(), images: new Set() };
	it.en ??= b.labelEn?.value;
	it.fr ??= b.labelFr?.value;
	it.nl ??= b.labelNl?.value;
	if (b.origin) it.origins.set(qidOf(b.origin.value), { label: b.originLabel?.value ?? qidOf(b.origin.value), iso: b.originIso?.value });
	if (b.image) it.images.add(decodeURIComponent(b.image.value.split('/Special:FilePath/').pop()!));
	wd.set(q, it);
}
type WdPlace = { label?: string; points: Set<string>; continents: Set<string> };
const wdp = new Map<string, WdPlace>();
for (const b of wdPlaces.results.results.bindings) {
	const q = qidOf(b.item!.value);
	const it: WdPlace = wdp.get(q) ?? { points: new Set(), continents: new Set() };
	it.label ??= b.labelEn?.value;
	if (b.coord) it.points.add(b.coord.value);
	if (b.continentLabel) it.continents.add(b.continentLabel.value);
	wdp.set(q, it);
}
const placeByFci = new Map(places.entries.filter((p) => p.fciCountry).map((p) => [p.fciCountry!, p]));
const placeByQid = new Map(places.entries.filter((p) => p.kind === 'country').map((p) => [p.wikidata, p]));

// ---------------------------------------------------------------- helpers
const capitalise = (s: string | undefined) => (s ? s[0].toUpperCase() + s.slice(1) : null);
/** `2/20/2019` (export, M/D/Y) -> `2019-02-20`. */
function isoDate(mdy: string): string | null {
	if (!mdy) return null;
	const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(mdy);
	if (!m) throw new Error(`unexpected FCI date "${mdy}"`);
	return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}
function point(p: OriginPlace): [number, number] | null {
	const pts = [...(wdp.get(p.wikidata)?.points ?? [])];
	if (pts.length !== 1) {
		errors.push(`${p.label}: ${pts.length} P625 points for ${p.wikidata} in ${WD_PLACES}`);
		return null;
	}
	const m = /^Point\((-?[\d.]+) (-?[\d.]+)\)$/.exec(pts[0]);
	if (!m) throw new Error(`${p.wikidata}: unexpected P625 "${pts[0]}"`);
	return [Number(m[1]), Number(m[2])];
}
const wdSource = (q: string, what: string): BreedSource => ({
	id: `wikidata-${q.toLowerCase()}`,
	kind: 'wikidata',
	citation: `Wikidata ${q}${what ? ` (${what})` : ''}`,
	url: `https://www.wikidata.org/wiki/${q}`,
	retrieved: day(wdBreeds.fetchedAt)
});

// ---------------------------------------------------------------- one breed per id with a tree leaf
const treeBreeds = new Map(tree.breeds.map((b) => [b.abbrev, b]));
const byId = new Map<string, BreedNameEntry[]>();
for (const e of names.entries) byId.set(e.id, [...(byId.get(e.id) ?? []), e]);
for (const id of display.keys()) if (!byId.has(id)) errors.push(`${DISPLAY}: unknown breed id ${id}`);
for (const id of familyTable.keys()) if (!byId.has(id)) errors.push(`${FAMILIES}: unknown breed id ${id}`);
for (const ab of families.keys()) if (!names.entries.some((e) => e.abbrev === ab)) errors.push(`${DESIGN} §2: unknown abbreviation ${ab}`);
for (const ab of treeBreeds.keys()) if (!names.entries.some((e) => e.abbrev === ab)) errors.push(`tree breed ${ab} has no entry in ${NAMES}`);

type ReportRow = { id: string; abbrevs: string; family: string; fciCountry: string; origin: string; continents: string; p495: string; plan: string; flags: string[] };
const report: ReportRow[] = [];
const breeds: Breed[] = [];

for (const [id, entries] of byId) {
	const inTree = entries.filter((e) => treeBreeds.has(e.abbrev));
	if (!inTree.length) continue; // e.g. size varieties only: nothing to show without a leaf
	const head = entries[0];
	const flags: string[] = [];
	const sources = new Map<string, BreedSource>();
	const use = (s: BreedSource) => (sources.set(s.id, s), s.id);

	// Parker clade: every entry in the tree must agree
	const clades = new Set(inTree.map((e) => treeBreeds.get(e.abbrev)!.cladeId));
	if (clades.size !== 1) errors.push(`${id}: Parker entries in different clades (${[...clades].join(', ')})`);
	const tb = treeBreeds.get(inTree[0].abbrev)!;
	const parkerId = use({ id: 'parker2017', kind: 'parker2017', citation: tree.source.citation, url: tree.source.url, retrieved: PARKER_RETRIEVED });

	// family: editorial, docs/DESIGN.md §2 for the 30 first breeds, data/manual/families.json for the others
	const designFams = new Set(entries.flatMap((e) => (families.has(e.abbrev) ? [families.get(e.abbrev)] : [])));
	const drafted: FamilyEntry | undefined = familyTable.get(id);
	if (designFams.size > 1) errors.push(`${id}: several families in ${DESIGN} §2`);
	if (designFams.size && drafted) errors.push(`${id}: family set both in ${DESIGN} §2 and in ${FAMILIES}`);
	if (!designFams.size && !drafted) errors.push(`${id}: no family in ${DESIGN} §2 nor in ${FAMILIES}`);
	const fam = familySchema.safeParse(designFams.size ? [...designFams][0] : drafted?.family);
	const familyId = use(
		drafted
			? {
					id: 'dogtrails-families',
					kind: 'editorial',
					// one citation for every breed (sources are deduplicated by id on /sources); the per-breed basis stays in the table
					citation: `Dogtrails families, ${FAMILIES}: editorial choice by breed, not a datum; drafted 2026-11-09, under review by Paul`,
					path: FAMILIES,
					retrieved: '2026-11-09'
				}
			: {
					id: 'dogtrails-design-families',
					kind: 'editorial',
					citation: 'Dogtrails visual system, docs/DESIGN.md §2 "Attribution des 30 races": editorial choice by breed, not a datum',
					path: DESIGN,
					retrieved: PARKER_RETRIEVED
				}
	);
	if (drafted && !drafted.reviewed) flags.push(`family "${drafted.family}" is a draft (${FAMILIES})`);

	// Wikidata names and image
	const w = wd.get(head.wikidata);
	if (!w?.en) errors.push(`${id}: no English label for ${head.wikidata}`);
	const wId = use(wdSource(head.wikidata, w?.en ?? ''));
	const shown = display.get(id);
	const enSourceId = shown
		? use({
				id: 'dogtrails-display-names',
				kind: 'editorial',
				citation: `Dogtrails display names, ${DISPLAY}: ${shown.basis}`,
				path: DISPLAY,
				retrieved: '2026-11-09'
			})
		: wId;
	if (shown && !shown.reviewed) flags.push(`display name "${shown.en}" not reviewed (${DISPLAY})`);
	const images = [...(w?.images ?? [])].sort();
	if (images.length > 1) flags.push(`${images.length} P18 images, first one kept: ${images.join(', ')}`);

	// FCI and origin
	let fciField: Breed['fci'];
	let origin: Breed['origin'] | null = null;
	let fciCountry = '—';
	let place: OriginPlace | undefined;
	let placeSourceId: string;
	if (head.fci.number !== null) {
		const row = fci.byNumber.get(head.fci.number);
		if (!row) {
			errors.push(`${id}: FCI ${head.fci.number} not in the export`);
			continue;
		}
		const group = FCI_GROUPS.indexOf(row.group) + 1;
		if (!group) errors.push(`${id}: unknown FCI group "${row.group}"`);
		const fId = use({
			id: `fci-${row.number}`,
			kind: 'fci',
			citation: `FCI nomenclature, standard n° ${row.number} "${row.name}" (unofficial export paiv/fci-breeds, commit ${fci.meta.commit.slice(0, 7)})`,
			url: row.url,
			retrieved: day(fci.meta.fetchedAt)
		});
		fciField = { number: row.number, group, section: row.section || null, provisional: isoDate(row.provisional), sourceId: fId };
		fciCountry = row.country;
		place = placeByFci.get(row.country);
		if (!place) errors.push(`${id}: FCI country "${row.country}" missing from ${PLACES}`);
		placeSourceId = fId;
	} else {
		fciField = { number: null, reason: head.fci.reason };
		const origins = [...(w?.origins.keys() ?? [])];
		placeSourceId = wId;
		if (origins.length > 1) errors.push(`${id}: no FCI number and ${origins.length} Wikidata P495 values`);
		else if (origins.length === 1) {
			place = placeByQid.get(origins[0]);
			if (!place) errors.push(`${id}: P495 ${origins[0]} missing from ${PLACES}`);
			flags.push('no FCI number: origin from Wikidata P495');
		} else flags.push('no FCI number and no Wikidata P495: origin left empty (no source)');
	}
	if (place) {
		const lonLat = point(place);
		const pw = wdp.get(place.wikidata);
		const coordsId = use({
			...wdSource(place.wikidata, `${pw?.label ?? place.label}, P625`),
			retrieved: day(wdPlaces.fetchedAt)
		});
		if (lonLat)
			origin = {
				place:
					place.kind === 'country'
						? { kind: 'country', iso: place.iso!, label: place.label, sourceId: placeSourceId }
						: { kind: 'region', label: place.label, sourceId: placeSourceId },
				coords: { lonLat, sourceId: coordsId }
			};
	}

	// cross-checks, reported only
	const p495 = [...(w?.origins.values() ?? [])].map((o) => (o.iso ? `${o.label} (${o.iso})` : `${o.label} (no ISO)`));
	if (place && head.fci.number !== null) {
		const isos = [...(w?.origins.values() ?? [])].map((o) => o.iso);
		const same = place.iso !== null && isos.length === 1 && isos[0] === place.iso;
		if (!p495.length) flags.push('no P495 on Wikidata');
		else if (!same) flags.push(`P495 ${p495.join(', ')} differs from FCI "${fciCountry}"`);
	}
	const planRows = inTree.map((e) => plan.get(e.abbrev)).filter((p) => p !== undefined);
	for (const p of planRows) {
		const mapped = PLAN_COUNTRY[p.country];
		if (head.fci.number !== null && mapped !== fciCountry) flags.push(`PLAN.md country "${p.country}" differs from FCI "${fciCountry}"`);
	}
	for (const e of entries) if (e.doubts.length) flags.push(`${e.abbrev}: ${e.doubts.length} open doubt(s) in ${NAMES}`);

	if (place && !origin) continue; // P625 error already reported
	if (!fam.success) continue;
	breeds.push({
		id,
		names: {
			en: shown?.en ?? capitalise(w?.en)!,
			fr: capitalise(w?.fr),
			nl: capitalise(w?.nl),
			wikidataEn: shown ? capitalise(w?.en)! : null,
			enSourceId,
			sourceId: wId
		},
		wikidata: head.wikidata,
		fci: fciField,
		parker: {
			entries: entries.map((e) => ({ abbrev: e.abbrev, name: e.parkerName, variant: e.variant, inTree: treeBreeds.has(e.abbrev) })),
			clade: tb.clade,
			cladeId: tb.cladeId,
			cladeLowSupport: inTree.some((e) => treeBreeds.get(e.abbrev)!.cladeLowSupport),
			sourceId: parkerId
		},
		family: { id: fam.data, sourceId: familyId },
		origin,
		development: [],
		fixedAround: null,
		image: images.length ? { commonsFile: images[0], sourceId: wId } : null,
		sources: [...sources.values()]
	});
	report.push({
		id,
		abbrevs: entries.map((e) => (treeBreeds.has(e.abbrev) ? e.abbrev : `(${e.abbrev})`)).join(', '),
		family: fam.data,
		fciCountry,
		origin: !origin ? '—' : origin.place.kind === 'country' ? `${origin.place.label} (${origin.place.iso})` : `${origin.place.label} (region)`,
		continents: [...(place ? (wdp.get(place.wikidata)?.continents ?? []) : [])].sort().join(', ') || '—',
		p495: p495.join(', ') || '—',
		plan: planRows.map((p) => p.country).join(', ') || '—',
		flags
	});
}

if (errors.length) {
	console.error(`${errors.length} error(s)\n  ${errors.join('\n  ')}`);
	process.exit(1);
}

breeds.sort((a, b) => a.id.localeCompare(b.id));
report.sort((a, b) => a.id.localeCompare(b.id));
const file = breedsFileSchema.parse({
	source: {
		description:
			'Breeds of the Parker 2017 sample with their FCI classification, Wikidata names and image, Parker clade, origin point and editorial colour family. Each fact names its source in sources[].',
		inputs: [NAMES, DISPLAY, FAMILIES, PLACES, TREE, 'data/raw/fci-breeds/fci-breeds.csv', WD_BREEDS, WD_PLACES, `${DESIGN} §2`],
		notes: [
			'origin = FCI country (Paul, 2026-11-04); Wikidata P495 is a cross-check only, its disagreements are in data/reports/breeds.md.',
			'Names are Wikidata labels with the first letter upper-cased, except English names overridden by data/manual/display-names.json (editorial, Paul 2026-11-09).',
			'family is an editorial choice (docs/DESIGN.md §2 for the 30 first breeds, data/manual/families.json for the others, drafts until Paul reviews them), not genetic data.',
			'development and fixedAround stay empty until a source gives them.'
		]
	},
	generatedBy: 'scripts/merge-fci.ts',
	generatedAt: new Date().toISOString(),
	breeds
});
writeFileSync(OUT, JSON.stringify(file, null, '\t') + '\n');

// ---------------------------------------------------------------- report
const europe = report.filter((r) => r.continents === 'Europe');
const multi = report.filter((r) => r.continents.includes(','));
const unverified = readDesignUnverified(DESIGN);
const beagle = breeds.find((b) => b.id === 'beagle');
const status = (fact: string) => {
	if (/^Beagle/.test(fact))
		return `FCI n° ${beagle?.fci.number ?? '?'} ${beagle?.fci.number === 161 ? 'confirmed by the FCI export' : 'NOT confirmed'}; the height is not sourced and not in breeds.json`;
	if (/19 des 30/.test(fact))
		return `pipeline count: ${europe.length} of ${report.length} breeds have an origin in Europe only (Wikidata P30)${multi.length ? `, plus ${multi.map((r) => r.id).join(', ')} on several continents` : ''}`;
	return 'not in breeds.json (no source yet)';
};
const md = `# breeds.json — merge report

Generated by \`scripts/merge-fci.ts\`. Do not edit by hand: rerun \`npm run data:merge\`.

${breeds.length} breeds from ${tree.breeds.length} Parker entries with tree leaves. Origin = FCI country (Paul, 2026-11-04);
Wikidata P495 and docs/PLAN.md are cross-checks only. Places of ${PLACES}: ${places.entries.filter((p) => p.reviewed).length}/${places.entries.length} reviewed.

## Flags (reported, not resolved)

${report.filter((r) => r.flags.length).map((r) => `- **${r.id}**: ${r.flags.join('; ')}`).join('\n') || 'None.'}

## Breeds

| id | Parker | family | FCI country | origin | continent (P30) | Wikidata P495 | PLAN.md |
| --- | --- | --- | --- | --- | --- | --- | --- |
${report.map((r) => `| ${r.id} | ${r.abbrevs} | ${r.family} | ${r.fciCountry} | ${r.origin} | ${r.continents} | ${r.p495} | ${r.plan} |`).join('\n')}

Parker entries in parentheses have no leaf in tree.json (none in the full breed set).

## Unverified facts of docs/DESIGN.md §10

None of them is in breeds.json unless stated.

${unverified.map((f) => `- ${f}\n  - ${status(f)}`).join('\n')}
`;
mkdirSync('data/reports', { recursive: true });
writeFileSync(REPORT, md);
console.log(`${OUT}: ${breeds.length} breeds`);
console.log(`${REPORT}: ${report.filter((r) => r.flags.length).length} breeds with flags, Europe-only origins ${europe.length}/${report.length}`);
