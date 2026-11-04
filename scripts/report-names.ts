/**
 * Review report for data/manual/breed-names.json -> data/reports/breed-names.md.
 *
 * For each Parker entry, puts side by side: FCI number, group and country from the FCI export,
 * Wikidata FCI code and country of origin (P495), and the FCI group and country typed by hand
 * in the 30-breed table of PLAN.md. Disagreements are flagged, never corrected.
 *
 * usage: node scripts/report-names.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { breedNamesFileSchema } from '../src/lib/data/schemas/breed-names.ts';
import { parseCsv } from './lib/csv.ts';

const NAMES = 'data/manual/breed-names.json';
const WIKIDATA = 'data/raw/wikidata-breeds.json';
const FCI_DIR = 'data/raw/fci-breeds';
const PLAN = 'PLAN.md';
const OUT = 'data/reports/breed-names.md';

/** FCI group names as written in the export, in group order 1-10. */
const FCI_GROUPS = [
	'Sheepdogs and Cattledogs',
	'Pinscher and Schnauzer',
	'Terriers',
	'Dachshunds',
	'Spitz and primitive types',
	'Scent hounds and related breeds',
	'Pointing Dogs',
	'Retrievers',
	'Companion and Toy Dogs',
	'Sighthounds'
];
/** French country names of PLAN.md -> country as written in the FCI export. */
const PLAN_COUNTRY: Record<string, string> = {
	Japon: 'JAPAN',
	Chine: 'CHINA',
	Tibet: 'Tibet (China)',
	Belgique: 'BELGIUM',
	Allemagne: 'GERMANY',
	Islande: 'ICELAND',
	Hongrie: 'HUNGARY',
	France: 'FRANCE',
	Mexique: 'MEXICO',
	'États-Unis': 'UNITED STATES OF AMERICA',
	Irlande: 'IRELAND',
	'Moyen-Orient': 'MIDDLE EAST',
	'Royaume-Uni': 'GREAT BRITAIN',
	Canada: 'CANADA',
	Suisse: 'SWITZERLAND'
};

/** FCI export country -> ISO 3166-1 alpha-2, to compare with Wikidata P495. Regions have none. */
const FCI_ISO: Record<string, string> = {
	JAPAN: 'JP',
	CHINA: 'CN',
	'Tibet (China)': 'CN',
	BELGIUM: 'BE',
	GERMANY: 'DE',
	ICELAND: 'IS',
	HUNGARY: 'HU',
	FRANCE: 'FR',
	MEXICO: 'MX',
	'UNITED STATES OF AMERICA': 'US',
	IRELAND: 'IE',
	'GREAT BRITAIN': 'GB',
	CANADA: 'CA',
	SWITZERLAND: 'CH'
};

const names = breedNamesFileSchema.parse(JSON.parse(readFileSync(NAMES, 'utf8')));
const fciMeta = JSON.parse(readFileSync(`${FCI_DIR}/meta.json`, 'utf8')) as { commit: string; fetchedAt: string };
const [header, ...rows] = parseCsv(readFileSync(`${FCI_DIR}/fci-breeds.csv`, 'utf8'));
const col = (r: string[], c: string) => r[header.indexOf(c)];
const fci = new Map(rows.map((r) => [Number(col(r, 'id')), r]));

type Binding = Record<string, { value: string } | undefined>;
const wd = JSON.parse(readFileSync(WIKIDATA, 'utf8')) as { fetchedAt: string; results: { results: { bindings: Binding[] } } };
const wdItems = new Map<string, { fci: Set<number>; origin: Set<string>; iso: Set<string> }>();
for (const b of wd.results.results.bindings) {
	const q = b.item!.value.split('/').pop()!;
	const it = wdItems.get(q) ?? { fci: new Set(), origin: new Set(), iso: new Set() };
	if (b.origin) it.iso.add(b.originIso?.value ?? `no ISO: ${b.originLabel?.value ?? b.origin.value}`);
	if (b.fci) it.fci.add(Number(b.fci.value));
	if (b.originLabel) it.origin.add(b.originIso ? `${b.originLabel.value} (${b.originIso.value})` : `${b.originLabel.value} (no ISO)`);
	wdItems.set(q, it);
}

// the 30-breed table of PLAN.md: | Race | Abrév. Parker | Clade | Groupe FCI | Pays d'origine (FCI) | Pourquoi |
const plan = new Map<string, { group: string; country: string }>();
for (const line of readFileSync(PLAN, 'utf8').split('\n')) {
	const cells = line.split('|').map((c) => c.trim());
	if (cells.length === 8 && /^[A-Z0-9]+$/.test(cells[2])) plan.set(cells[2], { group: cells[4], country: cells[5] });
}

const lines: string[] = [];
const flags: string[] = [];
lines.push(
	'| Parker | id | QID | FCI n° | FCI group | FCI country | Wikidata FCI | Wikidata P495 | PLAN group | PLAN country | |',
	'| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
);
for (const e of names.entries) {
	const row = e.fci.number === null ? undefined : fci.get(e.fci.number);
	const group = row ? String(FCI_GROUPS.indexOf(col(row, 'group')) + 1 || `? (${col(row, 'group')})`) : '—';
	const country = row ? col(row, 'country').replaceAll('\n', ' ') : '—';
	const w = wdItems.get(e.wikidata);
	const p = plan.get(e.abbrev);
	const issues: string[] = [];
	if (p) {
		const planGroup = /^\d+$/.test(p.group) ? p.group : '—';
		if (planGroup !== group) issues.push(`group: PLAN "${p.group}", FCI ${group}`);
		const mapped = PLAN_COUNTRY[p.country];
		if (e.fci.number !== null) {
			if (!mapped) issues.push(`country: PLAN "${p.country}" not mapped`);
			else if (mapped.toLowerCase() !== country.toLowerCase()) issues.push(`country: PLAN "${p.country}", FCI "${country}"`);
		}
	}
	if (w && e.fci.number !== null && w.fci.size && !w.fci.has(e.fci.number)) issues.push(`Wikidata FCI ${[...w.fci].join(', ')} ≠ ${e.fci.number}`);
	if (w && !w.origin.size) issues.push('no P495 on Wikidata');
	if (w && w.origin.size && row) {
		const iso = FCI_ISO[country];
		const same = iso !== undefined && w.iso.size === 1 && w.iso.has(iso);
		if (!same) issues.push(`origin: FCI "${country}"${iso ? ` (${iso})` : ' (no ISO)'}, Wikidata P495 ${[...w.origin].join(', ')}`);
	}
	if (issues.length) flags.push(`- **${e.abbrev}** (${e.id}): ${issues.join('; ')}`);
	lines.push(
		`| ${e.abbrev} | ${e.id}${e.variant ? ` (${e.variant})` : ''} | ${e.wikidata} | ${e.fci.number ?? 'null'} | ${group} | ${country} | ${w?.fci.size ? [...w.fci].join(', ') : '—'} | ${w ? [...w.origin].join(', ') || '—' : 'missing'} | ${p?.group ?? '—'} | ${p?.country ?? '—'} | ${issues.length ? '⚠' : ''} |`
	);
}

const doubts = names.entries.filter((e) => e.doubts.length).map((e) => `- **${e.abbrev}** (${e.id}):\n${e.doubts.map((d) => `  - ${d}`).join('\n')}`);

const md = `# breed-names.json — review report

Generated by \`scripts/report-names.ts\`. Do not edit by hand: rerun \`npm run data:names-report\`.

Sources: FCI export paiv/fci-breeds commit \`${fciMeta.commit.slice(0, 7)}\` (fetched ${fciMeta.fetchedAt.slice(0, 10)}),
Wikidata (fetched ${wd.fetchedAt.slice(0, 10)}), PLAN.md sample table (filled by hand, unverified).

Entries reviewed by Paul: ${names.entries.filter((e) => e.reviewed).length}/${names.entries.length}.

## Disagreements

${flags.join('\n') || 'None.'}

## Comparison

${lines.join('\n')}

## Open doubts (from breed-names.json)

${doubts.join('\n')}
`;
mkdirSync('data/reports', { recursive: true });
writeFileSync(OUT, md);
console.log(`${OUT}: ${names.entries.length} entries, ${flags.length} with disagreements`);
