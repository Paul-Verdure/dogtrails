/**
 * One-off extraction of the Parker et al. 2017 supplements into diffable text files.
 *
 *   data/raw/NIHMS866262-supplement-5.pdf  -> data/raw/parker2017-s5.nex   (NEXUS tree, verbatim)
 *   data/raw/NIHMS866262-supplement-1.xlsx -> data/raw/parker2017-s1.csv   (breed table, every cell verbatim)
 *
 * Supplement 5 is a PDF whose pages are the NEXUS file printed as plain text: we inflate the
 * page streams and concatenate the text-showing operators (one PDF text line = one output line).
 * Nothing is interpreted here; parse-tree.ts does the interpretation.
 *
 * usage: node scripts/extract-parker.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { strFromU8, unzipSync } from 'fflate';
import { toCsv } from './lib/csv.ts';

const RAW = 'data/raw';
const S5_PDF = `${RAW}/NIHMS866262-supplement-5.pdf`;
const S1_XLSX = `${RAW}/NIHMS866262-supplement-1.xlsx`;
const S5_NEX = `${RAW}/parker2017-s5.nex`;
const S1_CSV = `${RAW}/parker2017-s1.csv`;

// ---------- supplement 5: PDF -> NEXUS text
function extractPdfText(pdf: Buffer): string {
	const lines: string[] = [];
	const bin = pdf.toString('latin1');
	const streamRe = /stream\r?\n/g;
	let m: RegExpExecArray | null;
	while ((m = streamRe.exec(bin))) {
		const start = m.index + m[0].length;
		const end = bin.indexOf('endstream', start);
		let content: string;
		try {
			content = inflateSync(pdf.subarray(start, end)).toString('latin1');
		} catch {
			continue; // not a Flate stream (or binary we don't need)
		}
		if (!content.includes('Tj')) continue; // fonts, colour profiles...
		for (const t of content.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
			lines.push(t[1].replace(/\\(.)/g, '$1'));
		}
	}
	return lines.join('\n') + '\n';
}

const nexus = extractPdfText(readFileSync(S5_PDF));
if (!nexus.startsWith('#NEXUS') || !/\bend;\s*$/.test(nexus)) {
	throw new Error(`${S5_PDF}: extracted text is not a complete NEXUS file`);
}
const opens = nexus.split('(').length - 1;
const closes = nexus.split(')').length - 1;
if (opens !== closes) throw new Error(`${S5_PDF}: unbalanced parentheses (${opens} vs ${closes})`);
writeFileSync(S5_NEX, nexus);
console.log(`${S5_NEX}: ${nexus.length} chars, ${opens} internal nodes`);

// ---------- supplement 1: XLSX -> CSV
const decodeXml = (s: string) =>
	s
		.replace(/<[^>]+>/g, '')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&apos;', "'")
		.replaceAll('&amp;', '&');

const zip = unzipSync(new Uint8Array(readFileSync(S1_XLSX)));
const file = (p: string) => {
	const f = zip[p];
	if (!f) throw new Error(`${S1_XLSX}: missing ${p}`);
	return strFromU8(f);
};
const shared = [...file('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
	decodeXml(m[1])
);
const colIndex = (ref: string) =>
	[...ref].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

const rows: string[][] = [];
for (const r of file('xl/worksheets/sheet1.xml').matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
	const row: string[] = [];
	for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
		const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? '')?.[1] ?? '';
		const isShared = /t="s"/.test(c[2]);
		row[colIndex(c[1])] = isShared && v !== '' ? (shared[Number(v)] ?? '') : decodeXml(v);
	}
	rows.push(Array.from(row, (x) => x ?? ''));
}
const width = Math.max(...rows.map((r) => r.length));
const csv = toCsv(rows.map((r) => [...r, ...Array(width - r.length).fill('')]));
writeFileSync(S1_CSV, csv);
console.log(`${S1_CSV}: ${rows.length} rows x ${width} columns`);
