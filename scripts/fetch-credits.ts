/**
 * Photo credits from the Wikimedia Commons API, for the image of every breed of breeds.json
 * (`image.commonsFile`, the Wikidata P18 kept by scripts/merge-fci.ts).
 *
 * 1. One imageinfo + extmetadata query (thumbnail 640 px wide). The raw JSON is stored untouched
 *    in data/raw/commons-imageinfo.json with the endpoint, the parameters and the fetch date.
 * 2. src/lib/data/images.json: author (plain text), licence, file page, thumbnail, sizes.
 *    Only CC0, public domain, CC BY and CC BY-SA are kept; a file without an author is rejected
 *    too (no "unknown author" is invented).
 * 3. data/reports/images.md: rejected files, breeds without image, breeds with several P18.
 *
 * usage: node scripts/fetch-credits.ts [--offline]   (--offline rebuilds from data/raw only)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { breedsFileSchema } from '../src/lib/data/schemas/breeds.ts';
import { imagesFileSchema, type BreedImage, type ImageLicenceKind } from '../src/lib/data/schemas/images.ts';
import { qidOf, readWikidata } from './lib/sources.ts';

const BREEDS = 'src/lib/data/breeds.json';
const WIKIDATA = 'data/raw/wikidata-breeds.json';
const RAW = 'data/raw/commons-imageinfo.json';
const OUT = 'src/lib/data/images.json';
const REPORT = 'data/reports/images.md';
const ENDPOINT = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'dogtrails-pipeline/0.1 (https://dogtrails.net)';
const THUMB_WIDTH = 640;
const FIELDS = ['Artist', 'Attribution', 'AttributionRequired', 'Credit', 'LicenseShortName', 'LicenseUrl', 'License', 'UsageTerms', 'Copyrighted', 'Restrictions'];

const breeds = breedsFileSchema.parse(JSON.parse(readFileSync(BREEDS, 'utf8'))).breeds;
const files = [...new Set(breeds.flatMap((b) => (b.image ? [b.image.commonsFile] : [])))].sort();

type Meta = Record<string, { value: string } | undefined>;
type Page = {
	title: string;
	missing?: boolean;
	imageinfo?: { url: string; descriptionurl: string; width: number; height: number; thumburl?: string; thumbwidth?: number; thumbheight?: number; extmetadata?: Meta }[];
};
type Raw = { source: string; endpoint: string; fetchedAt: string; params: Record<string, string>; responses: { query: { pages: Page[]; normalized?: { from: string; to: string }[] } }[] };

async function fetchRaw(): Promise<Raw> {
	const base = {
		action: 'query',
		format: 'json',
		formatversion: '2',
		prop: 'imageinfo',
		iiprop: 'url|size|extmetadata',
		iiurlwidth: String(THUMB_WIDTH),
		iiextmetadatafilter: FIELDS.join('|')
	};
	const responses: Raw['responses'] = [];
	for (let i = 0; i < files.length; i += 50) {
		const titles = files.slice(i, i + 50).map((f) => `File:${f}`).join('|');
		const res = await fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
			body: new URLSearchParams({ ...base, titles })
		});
		if (!res.ok) throw new Error(`${ENDPOINT}: HTTP ${res.status} ${await res.text()}`);
		responses.push((await res.json()) as Raw['responses'][number]);
	}
	const raw: Raw = { source: 'Wikimedia Commons API (imageinfo, extmetadata)', endpoint: ENDPOINT, fetchedAt: new Date().toISOString(), params: base, responses };
	writeFileSync(RAW, JSON.stringify(raw, null, '\t') + '\n');
	console.log(`${RAW}: ${files.length} files`);
	return raw;
}

const raw: Raw = process.argv.includes('--offline') ? JSON.parse(readFileSync(RAW, 'utf8')) : await fetchRaw();
const retrieved = raw.fetchedAt.slice(0, 10);

// Commons titles use spaces and an upper-case first letter: compare on that normal form.
const norm = (f: string) => f.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const pages = new Map(raw.responses.flatMap((r) => r.query.pages).map((p) => [norm(p.title.replace(/^File:/, '')), p]));

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** extmetadata values are HTML fragments: keep the text only. */
const plain = (html: string | undefined) =>
	(html ?? '')
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<[^>]*>/g, '')
		.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
			e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m)
		)
		.replace(/\s+/g, ' ')
		.trim();

/** extmetadata `License` codes: cc0, pd, pd-old-70…, cc-by-4.0, cc-by-sa-3.0-de… Anything else is refused. */
function licenceKind(code: string): ImageLicenceKind | null {
	if (code === 'cc0') return 'cc0';
	if (code === 'pd' || code.startsWith('pd-')) return 'pd';
	if (/^cc-by-sa-\d/.test(code)) return 'cc-by-sa';
	if (/^cc-by-\d/.test(code)) return 'cc-by';
	return null;
}

const images: BreedImage[] = [];
const rejected: string[] = [];
const restrictions: string[] = [];
const noImage: string[] = [];
for (const b of breeds) {
	if (!b.image) {
		noImage.push(b.id);
		continue;
	}
	const file = b.image.commonsFile;
	const page = pages.get(norm(file));
	const info = page?.imageinfo?.[0];
	if (!page || page.missing || !info) {
		rejected.push(`**${b.id}**: \`${file}\` not found on Commons`);
		continue;
	}
	const m = info.extmetadata ?? {};
	const code = (m.License?.value ?? '').toLowerCase();
	const kind = licenceKind(code);
	const author = plain(m.Attribution?.value) || plain(m.Artist?.value);
	const why = [
		!kind && `licence "${m.LicenseShortName?.value ?? code ?? 'none'}" is not CC0, public domain, CC BY or CC BY-SA`,
		!author && 'no author in the file metadata (Artist and Attribution empty)',
		!info.thumburl && 'no thumbnail'
	].filter(Boolean);
	if (why.length || !kind || !info.thumburl) {
		rejected.push(`**${b.id}**: [${file}](${info.descriptionurl}) (${m.LicenseShortName?.value ?? 'no licence'}): ${why.join('; ')}`);
		continue;
	}
	const r = plain(m.Restrictions?.value);
	if (r) restrictions.push(`**${b.id}**: ${r}`);
	images.push({
		breedId: b.id,
		file,
		filePage: info.descriptionurl,
		author,
		licence: { kind, name: plain(m.LicenseShortName?.value) || code, url: m.LicenseUrl?.value || null },
		// for an original narrower than THUMB_WIDTH the API returns the original file but an upscaled box
		thumb:
			info.thumbwidth! > info.width
				? { url: info.thumburl, width: info.width, height: info.height }
				: { url: info.thumburl, width: info.thumbwidth!, height: info.thumbheight! },
		original: { width: info.width, height: info.height },
		retrieved
	});
}

const out = imagesFileSchema.parse({
	source: {
		description: 'One Wikimedia Commons photo per breed (the Wikidata P18 image of breeds.json) with its author, licence and file page, read from the Commons API.',
		api: ENDPOINT,
		inputs: [BREEDS, RAW],
		notes: [
			'Only CC0, public domain, CC BY and CC BY-SA files are kept; rejected files are listed in data/reports/images.md.',
			'author is the plain text of the extmetadata Attribution field, else Artist.',
			`Thumbnails are ${THUMB_WIDTH} px wide and hotlinked from Wikimedia (thumb.wikimedia.org, or upload.wikimedia.org for originals narrower than that), URL kept as the API gives it.`
		]
	},
	generatedBy: 'scripts/fetch-credits.ts',
	generatedAt: new Date().toISOString(),
	images
});
writeFileSync(OUT, JSON.stringify(out, null, '\t') + '\n');

// several P18 on Wikidata: merge-fci keeps the first in alphabetical order
const p18 = new Map<string, Set<string>>();
for (const row of readWikidata(WIKIDATA).results.results.bindings) {
	if (!row.image) continue;
	const q = qidOf(row.item!.value);
	p18.set(q, (p18.get(q) ?? new Set()).add(decodeURIComponent(row.image.value.split('/Special:FilePath/').pop()!)));
}
const multi = breeds.filter((b) => (p18.get(b.wikidata)?.size ?? 0) > 1);

const md = `# images.json — photo credits report

Generated by \`scripts/fetch-credits.ts\`. Do not edit by hand: rerun \`npm run data:credits\`.

${images.length} of ${breeds.length} breeds have a credited photo. Commons metadata read on ${retrieved}.

## Rejected files (reported, not resolved)

${rejected.map((r) => `- ${r}`).join('\n') || 'None.'}

## Breeds without image in breeds.json

${noImage.map((id) => `- ${id}`).join('\n') || 'None.'}

## Breeds with several Wikidata P18 images

scripts/merge-fci.ts keeps the first one in alphabetical order; the others are not used.

${multi.map((b) => `- **${b.id}** (${b.wikidata}): kept \`${b.image?.commonsFile}\`; also ${[...p18.get(b.wikidata)!].filter((f) => f !== b.image?.commonsFile).map((f) => `\`${f}\``).join(', ')}`).join('\n') || 'None.'}

## Restrictions noted on Commons

${restrictions.map((r) => `- ${r}`).join('\n') || 'None.'}

## Credits

| breed | file | author | licence |
| --- | --- | --- | --- |
${images.map((i) => `| ${i.breedId} | [${i.file}](${i.filePage}) | ${i.author.replace(/\|/g, '\\|')} | ${i.licence.name} |`).join('\n')}
`;
mkdirSync('data/reports', { recursive: true });
writeFileSync(REPORT, md);
console.log(`${OUT}: ${images.length} images, ${rejected.length} rejected, ${noImage.length} breeds without image`);
