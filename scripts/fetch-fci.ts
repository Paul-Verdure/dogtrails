/**
 * Downloads the unofficial FCI nomenclature export (https://github.com/paiv/fci-breeds, MIT)
 * at a pinned commit, verbatim, into data/raw/fci-breeds/, plus meta.json (URL, commit, date).
 *
 * The CSV holds facts only (number, name, group, section, country, links): no standard text
 * is copied. It is a starting point, not the authority: fci.be stays the reference.
 *
 * usage: node scripts/fetch-fci.ts [commit]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseCsv } from './lib/csv.ts';

const REPO = 'https://github.com/paiv/fci-breeds';
/** Last commit of master on 2026-11-04 (committed 2025-12-06). Bump deliberately. */
const COMMIT = process.argv[2] ?? '88aaca5c0726b2a4c6cf6aa06a1ffb359f9262f2';
const FILES = ['fci-breeds.csv', 'fci-breeds-fr.csv'];
const OUT = 'data/raw/fci-breeds';
const HEADER = 'id,name,group,section,provisional,country,url,image,pdf';

mkdirSync(OUT, { recursive: true });
const files: { file: string; url: string; rows: number }[] = [];
for (const file of FILES) {
	const url = `https://raw.githubusercontent.com/paiv/fci-breeds/${COMMIT}/${file}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	const text = await res.text();
	if (!text.startsWith(HEADER)) throw new Error(`${file}: unexpected header, expected "${HEADER}"`);
	writeFileSync(`${OUT}/${file}`, text);
	const rows = parseCsv(text).length - 1;
	files.push({ file, url, rows });
	console.log(`${OUT}/${file}: ${rows} breeds`);
}

const meta = {
	source: 'Unofficial CSV export of the FCI nomenclature (Pavel Ivashkov), MIT licence',
	repository: REPO,
	commit: COMMIT,
	fetchedAt: new Date().toISOString(),
	reference: 'https://fci.be/en/nomenclature/',
	files,
	notes: [
		'Files are stored verbatim. Group and country are names, not numbers; scripts map group names to FCI group numbers 1-10.',
		'No standard text is copied; the pdf column only links to fci.be.'
	]
};
writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, '\t') + '\n');
console.log(`${OUT}/meta.json: commit ${COMMIT}`);
