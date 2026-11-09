/**
 * Photo credits from the Wikimedia Commons API, for the image of every breed of breeds.json
 * (`image.commonsFile`, the Wikidata P18 kept by scripts/merge-fci.ts), or the file picked by hand in
 * data/manual/photos.json, which may also replace an unusable author text (Paul, 2026-11-09).
 *
 * 1. One imageinfo + extmetadata query (thumbnail 640 px wide). The raw JSON is stored untouched
 *    in data/raw/commons-imageinfo.json with the endpoint, the parameters and the fetch date.
 * 2. src/lib/data/images.json: author (plain text), licence, file page, thumbnail, sizes.
 *    Only CC0, public domain, CC BY and CC BY-SA are kept; a file without an author is rejected
 *    too (no "unknown author" is invented).
 * 3. The thumbnail is downloaded to static/photos/<breed id>.<ext> and served by the site itself
 *    (Paul, 2026-11-09: no request to Wikimedia from the visitor's browser).
 * 4. data/reports/images.md: rejected files, breeds without image, breeds with several P18.
 *
 * usage: node scripts/fetch-credits.ts [--offline]   (--offline: no API call; downloads only missing thumbnails)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { breedsFileSchema } from '../src/lib/data/schemas/breeds.ts';
import { photosFileSchema } from '../src/lib/data/schemas/photos.ts';
import { imagesFileSchema, type BreedImage, type ImageLicenceKind } from '../src/lib/data/schemas/images.ts';
import { qidOf, readWikidata } from './lib/sources.ts';

const BREEDS = 'src/lib/data/breeds.json';
const WIKIDATA = 'data/raw/wikidata-breeds.json';
const RAW = 'data/raw/commons-imageinfo.json';
const OUT = 'src/lib/data/images.json';
const REPORT = 'data/reports/images.md';
const PHOTOS = 'data/manual/photos.json';
const STATIC = 'static';
const PHOTO_DIR = 'photos';
const ENDPOINT = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'dogtrails-pipeline/0.1 (https://dogtrails.net)';
const THUMB_WIDTH = 640;
const FIELDS = ['Artist', 'Attribution', 'AttributionRequired', 'Credit', 'LicenseShortName', 'LicenseUrl', 'License', 'UsageTerms', 'Copyrighted', 'Restrictions'];

const breeds = breedsFileSchema.parse(JSON.parse(readFileSync(BREEDS, 'utf8'))).breeds;
const choices = new Map(photosFileSchema.parse(JSON.parse(readFileSync(PHOTOS, 'utf8'))).entries.map((e) => [e.breedId, e]));
for (const id of choices.keys()) if (!breeds.some((b) => b.id === id)) throw new Error(`${PHOTOS}: unknown breed ${id}`);
const fileOf = (b: (typeof breeds)[number]) => choices.get(b.id)?.file ?? b.image?.commonsFile ?? null;
const files = [...new Set(breeds.flatMap((b) => fileOf(b) ?? []))].sort();

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

const offline = process.argv.includes('--offline');
const raw: Raw = offline ? JSON.parse(readFileSync(RAW, 'utf8')) : await fetchRaw();
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
const downloads: { path: string; url: string }[] = [];
const rejected: string[] = [];
const restrictions: string[] = [];
const noImage: string[] = [];
for (const b of breeds) {
	const file = fileOf(b);
	if (!file) {
		noImage.push(b.id);
		continue;
	}
	const choice = choices.get(b.id);
	const page = pages.get(norm(file));
	const info = page?.imageinfo?.[0];
	if (!page || page.missing || !info) {
		rejected.push(`**${b.id}**: \`${file}\` not found on Commons`);
		continue;
	}
	const m = info.extmetadata ?? {};
	const code = (m.License?.value ?? '').toLowerCase();
	const kind = licenceKind(code);
	const commonsAuthor = plain(m.Attribution?.value) || plain(m.Artist?.value);
	const author = choice?.author ?? commonsAuthor;
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
	// tracking parameters (utm_*) the API appends to thumbnail URLs are dropped
	const remote = new URL(info.thumburl);
	for (const k of [...remote.searchParams.keys()]) if (k.startsWith('utm_')) remote.searchParams.delete(k);
	const ext = (/\.(jpe?g|png|webp|gif)$/i.exec(remote.pathname)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
	const path = `${PHOTO_DIR}/${b.id}.${ext}`;
	downloads.push({ path, url: remote.href });
	images.push({
		breedId: b.id,
		file,
		chosenBy: choice?.file ? PHOTOS : 'wikidata-p18',
		filePage: info.descriptionurl,
		author,
		authorFrom: choice?.author ? PHOTOS : 'commons-extmetadata',
		licence: { kind, name: plain(m.LicenseShortName?.value) || code, url: m.LicenseUrl?.value || null },
		// for an original narrower than THUMB_WIDTH the API returns the original file but an upscaled box
		thumb:
			info.thumbwidth! > info.width
				? { path, sourceUrl: remote.href, width: info.width, height: info.height }
				: { path, sourceUrl: remote.href, width: info.thumbwidth!, height: info.thumbheight! },
		original: { width: info.width, height: info.height },
		retrieved
	});
}

const out = imagesFileSchema.parse({
	source: {
		description: 'One Wikimedia Commons photo per breed (the Wikidata P18 image of breeds.json) with its author, licence and file page, read from the Commons API.',
		api: ENDPOINT,
		inputs: [BREEDS, PHOTOS, RAW],
		notes: [
			'Only CC0, public domain, CC BY and CC BY-SA files are kept; rejected files are listed in data/reports/images.md.',
			`The file is the Wikidata P18 image of breeds.json unless ${PHOTOS} picks another (chosenBy).`,
			`author is the plain text of the extmetadata Attribution field, else Artist, unless ${PHOTOS} gives a credit read from the file page (authorFrom).`,
			`Thumbnails (${THUMB_WIDTH} px requested) are downloaded unmodified to ${STATIC}/${PHOTO_DIR}/ and served by the site; sourceUrl is the Wikimedia URL without utm_* parameters.`
		]
	},
	generatedBy: 'scripts/fetch-credits.ts',
	generatedAt: new Date().toISOString(),
	images
});
writeFileSync(OUT, JSON.stringify(out, null, '\t') + '\n');

// self-hosted thumbnails: fetch the missing ones (all of them unless --offline), drop stale files
mkdirSync(`${STATIC}/${PHOTO_DIR}`, { recursive: true });
for (const d of downloads) {
	const target = `${STATIC}/${d.path}`;
	if (offline && existsSync(target)) continue;
	const res = await fetch(d.url, { headers: { 'User-Agent': USER_AGENT } });
	if (!res.ok) throw new Error(`${d.url}: HTTP ${res.status}`);
	writeFileSync(target, Buffer.from(await res.arrayBuffer()));
	await new Promise((r) => setTimeout(r, 300)); // be gentle with upload.wikimedia.org
}
const kept = new Set(downloads.map((d) => d.path.split('/').pop()));
for (const f of readdirSync(`${STATIC}/${PHOTO_DIR}`)) if (!kept.has(f)) rmSync(`${STATIC}/${PHOTO_DIR}/${f}`);

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

scripts/merge-fci.ts keeps the first one in alphabetical order; ${PHOTOS} may pick another file.

${multi.map((b) => `- **${b.id}** (${b.wikidata}): P18 kept \`${b.image?.commonsFile}\`${choices.get(b.id)?.file ? `, shown \`${choices.get(b.id)!.file}\` (${PHOTOS})` : ''}; also ${[...p18.get(b.wikidata)!].filter((f) => f !== b.image?.commonsFile).map((f) => `\`${f}\``).join(', ')}`).join('\n') || 'None.'}

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
