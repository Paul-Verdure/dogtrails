/**
 * One review report for Paul -> data/reports/review.md, sorted by priority so it can be read in
 * batches: first the few decisions that shape the site, then each manual table, drafts with doubts
 * before drafts without. Reads only generated or manual files; never changes them.
 *
 * usage: node scripts/report-review.ts   (after data:tree, data:merge and data:credits)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { breedNamesFileSchema, type BreedNameEntry } from '../src/lib/data/schemas/breed-names.ts';
import { breedsFileSchema } from '../src/lib/data/schemas/breeds.ts';
import { displayNamesFileSchema } from '../src/lib/data/schemas/display-names.ts';
import { familiesFileSchema } from '../src/lib/data/schemas/families.ts';
import { imagesFileSchema } from '../src/lib/data/schemas/images.ts';
import { originPlacesFileSchema } from '../src/lib/data/schemas/places.ts';
import { isLeaf, treeFileSchema, type TreeLeaf, type TreeNode } from '../src/lib/data/schemas/tree.ts';
import { FCI_GROUPS, qidOf, readFci, readWikidata } from './lib/sources.ts';

const OUT = 'data/reports/review.md';
const read = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const tree = treeFileSchema.parse(read('src/lib/data/tree.json'));
const names = breedNamesFileSchema.parse(read('data/manual/breed-names.json')).entries;
const breeds = breedsFileSchema.parse(read('src/lib/data/breeds.json')).breeds;
const display = displayNamesFileSchema.parse(read('data/manual/display-names.json')).entries;
const families = familiesFileSchema.parse(read('data/manual/families.json')).entries;
const places = originPlacesFileSchema.parse(read('data/manual/origin-places.json')).entries;
const images = imagesFileSchema.parse(read('src/lib/data/images.json')).images;
const fci = readFci();
const wd = readWikidata('data/raw/wikidata-breeds.json');

const byId = new Map(breeds.map((b) => [b.id, b]));
const nameOf = (id: string) => byId.get(id)?.names.en ?? id;
const fciLabel = (n: number | null) => {
	if (n === null) return 'no FCI';
	const r = fci.byNumber.get(n);
	return r ? `FCI ${n} ${r.name}` : `FCI ${n} (not in export)`;
};
const p495 = new Map<string, Set<string>>();
for (const b of wd.results.results.bindings) {
	if (!b.origin) continue;
	const q = qidOf(b.item!.value);
	p495.set(q, (p495.get(q) ?? new Set()).add(`${b.originLabel?.value ?? qidOf(b.origin.value)}${b.originIso ? ` (${b.originIso.value})` : ' (no ISO)'}`));
}
const md = (s: string) => s.replace(/\|/g, '\\|');

// ---------------------------------------------------------------- 1. decisions
const sharedFci = new Map<number, Set<string>>();
for (const e of names) if (e.fci.number !== null) sharedFci.set(e.fci.number, (sharedFci.get(e.fci.number) ?? new Set()).add(e.id));
const shared = [...sharedFci].filter(([, ids]) => ids.size > 1);

const leaves: TreeLeaf[] = [];
(function walk(n: TreeNode) {
	if (isLeaf(n)) leaves.push(n);
	else n.children.forEach(walk);
})(tree.root);
const split = tree.breeds.filter((b) => b.fragments.tree > 1);
const noClade = tree.breeds.filter((b) => b.clade === null);
const noOrigin = breeds.filter((b) => b.origin === null);

// ---------------------------------------------------------------- 2. names
const unreviewedNames = names.filter((e) => !e.reviewed);
const doubtful = names.filter((e) => e.doubts.length || e.alternatives.length).sort((a, b) => Number(a.reviewed) - Number(b.reviewed));
const plain = unreviewedNames.filter((e) => !e.doubts.length && !e.alternatives.length);
const nameBlock = (e: BreedNameEntry) =>
	[
		`- [ ] **${e.abbrev}** "${e.parkerName}" → \`${e.id}\`${e.variant ? ` (${e.variant})` : ''} · ${fciLabel(e.fci.number)} · ${e.wikidata}${e.reviewed ? ' · *reviewed*' : ''}`,
		...e.doubts.map((d) => `  - doubt: ${d}`),
		...e.alternatives.map((a) => `  - alternative: ${[a.fci ? fciLabel(a.fci) : null, a.wikidata].filter(Boolean).join(' · ')}: ${a.note}`),
		...(e.fci.number === null ? [`  - no FCI: ${e.fci.reason}`] : [])
	].join('\n');

// ---------------------------------------------------------------- 3. origins
const placeRows = places.filter((p) => !p.reviewed);
const regions = breeds.filter((b) => b.origin?.place.kind === 'region');
const noFci = breeds.filter((b) => b.fci.number === null);
const disagreements = breeds.flatMap((b) => {
	if (b.fci.number === null || !b.origin) return [];
	const values = [...(p495.get(b.wikidata) ?? [])];
	const iso = b.origin.place.kind === 'country' ? b.origin.place.iso : null;
	if (!values.length) return [`| ${b.id} | ${b.origin.place.label} | — (no P495) |`];
	if (iso && values.length === 1 && values[0].endsWith(`(${iso})`)) return [];
	return [`| ${b.id} | ${b.origin.place.label} | ${values.join(', ')} |`];
});

// ---------------------------------------------------------------- 4. families
const famDoubt = families.filter((f) => !f.reviewed && f.doubts.length);
const famPlain = families.filter((f) => !f.reviewed && !f.doubts.length);
const famShort = (basis: string) => basis.replace(/^Draft \(Claude Code, [\d-]+\)\. /, '');

// ---------------------------------------------------------------- 5. photos and display names
const shown = new Set(images.map((i) => i.breedId));
const noPhoto = breeds.filter((b) => !shown.has(b.id));
const oddAuthor = images.filter((i) => i.authorFrom !== 'data/manual/photos.json' && /assumed|machine-readable|at .* Wikipedia|^I, |\bor\b|http|[{}<>]|^.{60,}$/i.test(i.author));
const unreviewedDisplay = display.filter((d) => !d.reviewed);

const section = (title: string, count: number, body: string) => `## ${title} (${count})\n\n${body || 'Nothing.'}\n`;

const out = `# Review for Paul: the 161 breeds of Parker et al. 2017

Generated by \`scripts/report-review.ts\`. Do not edit by hand: rerun \`npm run data:review\`.
Nothing below is resolved in the data: every item is shown on the site as drafted, and listed here
until Paul sets \`reviewed: true\` in the manual table it comes from (or changes the entry).

Tree: ${tree.breeds.length} Parker breeds, ${leaves.length} leaves, ${tree.root.children.length} children at the root. Site: ${breeds.length} breeds.
Unreviewed: ${unreviewedNames.length} name mappings, ${families.filter((f) => !f.reviewed).length} families, ${placeRows.length} places, ${unreviewedDisplay.length} display names.

Suggested batches: **1** (decisions, ~10 min) → **2a** (doubtful mappings) → **3** (origins) → **4a**
(doubtful families) → **5** (photos) → **2b** and **4b** (bulk tables, tick quickly).

${section('1. Decisions that shape the site', shared.length + 1 + noClade.length + noOrigin.length + split.length, [
	'### 1.1 Several Parker breeds attached to one FCI standard, kept as separate site breeds',
	'',
	'Paul\'s rule merges size varieties under one id (poodle, xoloitzcuintle). These are coat or type varieties, or AKC breeds the FCI files together: the draft keeps one site breed per Parker abbreviation. The alternative is one id with `variant`s, as POM → german-spitz.',
	'',
	...shared.map(([n, ids]) => `- [ ] ${fciLabel(n)}: ${[...ids].map((id) => `\`${id}\` (${names.filter((e) => e.id === id).map((e) => e.abbrev).join(', ')})`).join(', ')}`),
	'',
	'### 1.2 Wild canids left out of the tree and the site',
	'',
	...tree.breedSet.excluded.map((e) => `- [ ] ${e.abbrev}: ${e.reason}`),
	'',
	'### 1.3 Breeds Parker places in no clade',
	'',
	'Shown as "no clade in Parker 2017" (cladeId null); the tree view gives them no clade arc.',
	'',
	...noClade.map((b) => `- [ ] ${b.abbrev} ${b.name} → ${nameOf(names.find((e) => e.abbrev === b.abbrev)!.id)}`),
	'',
	'### 1.4 Breeds without an origin',
	'',
	'No FCI standard and no Wikidata P495: the origin stays empty rather than guessed (the page says "Not yet sourced").',
	'',
	...noOrigin.map((b) => `- [ ] \`${b.id}\` (${b.parker.entries.map((e) => e.abbrev).join(', ')}): ${b.fci.number === null ? b.fci.reason : ''}`),
	'',
	'### 1.5 Breeds split across subtrees',
	'',
	'Their dogs form several separate subtrees: each fragment is its own leaf (`split: {part, of}`), never merged. Sister groups in the full tree are printed by `npm run data:tree`.',
	'',
	'| Parker | breed | dogs | fragments (tree / full) | clade |',
	'| --- | --- | --- | --- | --- |',
	...split.map((b) => `| ${b.abbrev} | ${nameOf(names.find((e) => e.abbrev === b.abbrev)!.id)} | ${b.dogs} | ${b.fragments.tree} / ${b.fragments.full} | ${b.clade ?? '—'}${b.cladeLowSupport ? ' *' : ''} |`)
].join('\n'))}
${section('2a. Name mappings with doubts or alternatives', doubtful.length, doubtful.map(nameBlock).join('\n'))}
${section('3. Origins', regions.length + noFci.length + disagreements.length + placeRows.length, [
	'### 3.1 FCI regions and two-country origins (kept as regions)',
	'',
	...regions.map((b) => `- [ ] \`${b.id}\`: ${b.origin!.place.label}`),
	'',
	'### 3.2 Breeds without an FCI number (origin from Wikidata P495)',
	'',
	...noFci.map((b) => `- [ ] \`${b.id}\`: ${b.origin ? b.origin.place.label : 'no origin'} · ${b.fci.number === null ? b.fci.reason : ''}`),
	'',
	'### 3.3 Wikidata P495 differs from the FCI country (cross-check only, origin stays FCI)',
	'',
	'| breed | FCI origin | Wikidata P495 |',
	'| --- | --- | --- |',
	...disagreements,
	'',
	'### 3.4 New places (data/manual/origin-places.json)',
	'',
	...placeRows.map((p) => `- [ ] ${p.fciCountry ?? '(P495 only)'} → ${p.label} (${p.kind}${p.iso ? `, ${p.iso}` : ''}, point ${p.wikidata})${p.doubts.length ? `\n  - doubt: ${p.doubts.join(' ')}` : ''}`)
].join('\n'))}
${section('4a. Drafted families with doubts (data/manual/families.json)', famDoubt.length, famDoubt.map((f) => `- [ ] \`${f.id}\` → **${f.family}**: ${famShort(f.basis)}\n  - doubt: ${f.doubts.join(' ')}`).join('\n'))}
${section('5. Photos and display names', noPhoto.length + oddAuthor.length + unreviewedDisplay.length, [
	'### 5.1 Breeds without a credited photo (see data/reports/images.md for the reasons)',
	'',
	'A replacement goes in data/manual/photos.json; no author is guessed.',
	'',
	...noPhoto.map((b) => `- [ ] \`${b.id}\``),
	'',
	'### 5.2 Author strings that are probably not a usable credit',
	'',
	...oddAuthor.map((i) => `- [ ] \`${i.breedId}\`: "${md(i.author)}" ([${md(i.file)}](${i.filePage}))`),
	'',
	'### 5.3 Drafted display names (data/manual/display-names.json)',
	'',
	...unreviewedDisplay.map((d) => `- [ ] \`${d.id}\` → "${d.en}": ${d.basis.replace(/^Draft \(Claude Code, [\d-]+\)\. /, '')}`)
].join('\n'))}
${section('2b. Other name mappings (no doubt found, tick in bulk)', plain.length, [
	'| | Parker | site id | FCI | Wikidata |',
	'| --- | --- | --- | --- | --- |',
	...plain.map((e) => `| [ ] | ${e.abbrev} ${md(e.parkerName)} | ${e.id} | ${md(fciLabel(e.fci.number))} | ${e.wikidata} ${md(byId.get(e.id)?.names.wikidataEn ?? byId.get(e.id)?.names.en ?? '')} |`)
].join('\n'))}
${section('4b. Other drafted families (tick in bulk)', famPlain.length, [
	'| | family | breed | basis |',
	'| --- | --- | --- | --- |',
	...[...famPlain].sort((a, b) => a.family.localeCompare(b.family) || a.id.localeCompare(b.id)).map((f) => `| [ ] | ${f.family} | ${f.id} | ${md(famShort(f.basis))} |`)
].join('\n'))}
FCI groups: ${FCI_GROUPS.map((g, i) => `${i + 1} ${g}`).join(' · ')}.
`;

mkdirSync('data/reports', { recursive: true });
writeFileSync(OUT, out);
console.log(`${OUT}: ${doubtful.length} doubtful mappings, ${plain.length} plain, ${famDoubt.length + famPlain.length} families, ${noPhoto.length} breeds without photo`);
