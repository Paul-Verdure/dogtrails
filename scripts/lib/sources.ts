// Readers for the versioned raw sources, shared by report-names.ts, merge-fci.ts and validate.ts.
import { readFileSync } from 'node:fs';
import { parseCsv } from './csv.ts';

/** FCI group names as written in the paiv/fci-breeds export, in group order 1-10. */
export const FCI_GROUPS = [
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

/** French country names of the docs/PLAN.md sample table -> country as written in the FCI export. */
export const PLAN_COUNTRY: Record<string, string> = {
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

export type FciRow = {
	number: number;
	name: string;
	group: string;
	section: string;
	/** As written in the export (`2/20/2019`), empty when definitive. */
	provisional: string;
	country: string;
	url: string;
};

export function readFci(dir = 'data/raw/fci-breeds') {
	const meta = JSON.parse(readFileSync(`${dir}/meta.json`, 'utf8')) as { commit: string; fetchedAt: string; repository: string };
	const [header, ...rows] = parseCsv(readFileSync(`${dir}/fci-breeds.csv`, 'utf8'));
	const col = (r: string[], c: string) => r[header.indexOf(c)] ?? '';
	const byNumber = new Map<number, FciRow>();
	for (const r of rows) {
		const number = Number(col(r, 'id'));
		byNumber.set(number, {
			number,
			name: col(r, 'name'),
			group: col(r, 'group'),
			section: col(r, 'section'),
			provisional: col(r, 'provisional'),
			// a few countries span two lines in the export ("NORTH MACEDONIA\n...")
			country: col(r, 'country').replace(/\s+/g, ' ').trim(),
			url: col(r, 'url')
		});
	}
	return { meta, byNumber };
}

export type Binding = Record<string, { value: string } | undefined>;
export type WikidataRaw = { fetchedAt: string; query: string; results: { results: { bindings: Binding[] } } };

export const readWikidata = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as WikidataRaw;
export const qidOf = (uri: string) => uri.split('/').pop()!;

/** The 30-breed table of docs/PLAN.md: | Race | Abrév. Parker | Clade | Groupe FCI | Pays d'origine (FCI) | Pourquoi |. */
export function readPlanSample(file = 'docs/PLAN.md') {
	const plan = new Map<string, { group: string; country: string }>();
	for (const line of readFileSync(file, 'utf8').split('\n')) {
		const cells = line.split('|').map((c) => c.trim());
		if (cells.length === 8 && /^[A-Z0-9]+$/.test(cells[2])) plan.set(cells[2], { group: cells[4], country: cells[5] });
	}
	return plan;
}

/** Table "Attribution des 30 races de l'échantillon" of docs/DESIGN.md §2: abbreviation -> family id. */
export function readDesignFamilies(file = 'docs/DESIGN.md') {
	const text = readFileSync(file, 'utf8');
	const start = text.indexOf('### Attribution des 30 races');
	if (start < 0) throw new Error(`${file}: section "Attribution des 30 races" not found`);
	const families = new Map<string, string>();
	for (const line of text.slice(start).split('\n').slice(1)) {
		if (line.startsWith('#')) break;
		const m = /^\|\s*([a-z]+)\s*\|\s*([A-Z0-9, ]+?)\s*\|$/.exec(line);
		if (!m) continue;
		for (const ab of m[2].split(',').map((s) => s.trim())) {
			if (families.has(ab)) throw new Error(`${file}: ${ab} listed in two families`);
			families.set(ab, m[1]);
		}
	}
	return families;
}

/** Bullet list of docs/DESIGN.md §10 "Faits à sourcer avant publication". */
export function readDesignUnverified(file = 'docs/DESIGN.md') {
	const text = readFileSync(file, 'utf8');
	const start = text.indexOf('## 10.');
	if (start < 0) throw new Error(`${file}: section 10 not found`);
	const lines = text.slice(start).split('\n').slice(1);
	const out: string[] = [];
	for (const l of lines) {
		if (l.startsWith('## ')) break;
		if (l.startsWith('- ')) out.push(l.slice(2).trim());
	}
	return out;
}
