/**
 * /sources, generated at build time (prerendered, server-only; with csr = false only the HTML ships)
 * from the `source` blocks of the generated and raw data files, the manual tables, the <metadata>
 * of the engraved maps and the `sources[]` of every breed. Each file read is checked with Zod:
 * the build fails if a field the page relies on is missing.
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { treeFileSchema } from '$lib/data/schemas/tree';
import { breedsFileSchema, type BreedSource } from '$lib/data/schemas/breeds';
import { breedNamesFileSchema } from '$lib/data/schemas/breed-names';
import { displayNamesFileSchema } from '$lib/data/schemas/display-names';
import { originPlacesFileSchema } from '$lib/data/schemas/places';
import { imagesFileSchema } from '$lib/data/schemas/images';
import treeJson from '$lib/data/tree.json';
import breedsJson from '$lib/data/breeds.json';
import imagesJson from '$lib/data/images.json';
import fciMetaJson from '../../../data/raw/fci-breeds/meta.json';
import wikidataBreedsJson from '../../../data/raw/wikidata-breeds.json';
import wikidataPlacesJson from '../../../data/raw/wikidata-places.json';
import breedNamesJson from '../../../data/manual/breed-names.json';
import displayNamesJson from '../../../data/manual/display-names.json';
import originPlacesJson from '../../../data/manual/origin-places.json';
import leafPrefixesJson from '../../../data/manual/parker-leaf-prefixes.json';
import type { PageServerLoad } from './$types';

const fciMetaSchema = z.object({
	source: z.string().min(1),
	repository: z.url(),
	commit: z.string().regex(/^[0-9a-f]{40}$/),
	fetchedAt: z.iso.datetime(),
	reference: z.url(),
	files: z.array(z.object({ file: z.string(), url: z.url(), rows: z.int() })).min(1),
	notes: z.array(z.string())
});
const wikidataRawSchema = z.object({
	source: z.string().min(1),
	endpoint: z.url(),
	fetchedAt: z.iso.datetime(),
	licence: z.string().min(1),
	qids: z.array(z.string()).min(1)
});
const leafPrefixesSchema = z.object({
	_about: z.string().min(1),
	aliases: z.array(z.object({ prefix: z.string(), reviewed: z.boolean() })).min(1)
});
const fontPackageSchema = z.object({ name: z.string(), version: z.string(), license: z.string().min(1) });

const day = (iso: string) => iso.slice(0, 10);

export const load: PageServerLoad = () => {
	const tree = treeFileSchema.parse(treeJson);
	const breedsFile = breedsFileSchema.parse(breedsJson);
	const fci = fciMetaSchema.parse(fciMetaJson);
	const wdBreeds = wikidataRawSchema.parse(wikidataBreedsJson);
	const wdPlaces = wikidataRawSchema.parse(wikidataPlacesJson);
	const names = breedNamesFileSchema.parse(breedNamesJson);
	const displayNames = displayNamesFileSchema.parse(displayNamesJson);
	const places = originPlacesFileSchema.parse(originPlacesJson);
	const prefixes = leafPrefixesSchema.parse(leafPrefixesJson);
	const imagesFile = imagesFileSchema.parse(imagesJson);
	const nameOf = new Map(breedsFile.breeds.map((b) => [b.id, b.names.en]));

	const allSources = breedsFile.breeds.flatMap((b) => b.sources);
	const byKind = (kind: BreedSource['kind']) => allSources.filter((s) => s.kind === kind);
	const retrievedOf = (kind: BreedSource['kind']) => [...new Set(byKind(kind).map((s) => s.retrieved))].sort();

	// engraved base maps: their source is written in each SVG's <metadata> by scripts/make-maps.ts
	const svgs = import.meta.glob<string>('/static/maps/*.svg', { query: '?raw', import: 'default', eager: true });
	const maps = Object.entries(svgs)
		.map(([path, svg]) => {
			const meta = /<metadata>([^<]+)<\/metadata>/.exec(svg)?.[1]?.trim();
			if (!meta) throw new Error(`${path} has no <metadata> source block`);
			return { file: path.replace(/^\/static/, ''), meta };
		})
		.sort((a, b) => a.file.localeCompare(b.file));
	if (!maps.length) throw new Error('no engraved map in static/maps');

	const fonts = ['@fontsource/instrument-serif', '@fontsource-variable/dm-sans'].map((name) =>
		fontPackageSchema.parse(JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8')))
	);

	const editorial = [...new Map(byKind('editorial').map((s) => [s.id, s])).values()];

	return {
		datasets: [
			{
				id: 'parker2017',
				title: 'Parker et al. 2017, genetic tree',
				gives: 'The genetic tree and the clade of each breed (tree.json, breeds.json).',
				citation: tree.source.citation,
				url: tree.source.url,
				version: `DOI ${tree.source.doi}`,
				licence: tree.source.licence.name,
				accessed: retrievedOf('parker2017'),
				files: tree.source.files,
				notes: tree.source.notes
			},
			{
				id: 'fci',
				title: 'FCI nomenclature',
				gives: 'FCI standard number, group, section and country of origin (breeds.json).',
				citation: fci.source,
				url: fci.repository,
				version: `commit ${fci.commit.slice(0, 7)}`,
				licence: /,\s*([^,]*licen[cs]e)\s*$/i.exec(fci.source)?.[1] ?? null,
				accessed: [day(fci.fetchedAt)],
				files: fci.files.map((f) => `${f.file} (${f.rows} rows)`),
				notes: [`Reference: ${fci.reference}`, ...fci.notes]
			},
			{
				id: 'wikidata',
				title: 'Wikidata',
				gives: 'English, French and Dutch names, map points of countries, Commons image names (breeds.json).',
				citation: `${wdBreeds.source}: ${wdBreeds.qids.length} breed items and ${wdPlaces.qids.length} place items`,
				url: wdBreeds.endpoint,
				version: null,
				licence: wdBreeds.licence === wdPlaces.licence ? wdBreeds.licence : `${wdBreeds.licence}; ${wdPlaces.licence}`,
				accessed: [...new Set([day(wdBreeds.fetchedAt), day(wdPlaces.fetchedAt)])].sort(),
				files: ['data/raw/wikidata-breeds.json', 'data/raw/wikidata-places.json'],
				notes: []
			},
			{
				id: 'commons',
				title: 'Wikimedia Commons, photos',
				gives: `One photo per breed, ${imagesFile.images.length} of ${breedsFile.breeds.length} breeds (images.json). Each photo keeps its own licence and author.`,
				citation: 'Wikimedia Commons API: imageinfo and extmetadata of each file',
				url: imagesFile.source.api,
				version: null,
				licence: 'Per file: CC0, public domain, CC BY or CC BY-SA only',
				accessed: [...new Set(imagesFile.images.map((i) => i.retrieved))].sort(),
				files: ['data/raw/commons-imageinfo.json'],
				notes: imagesFile.source.notes
			},
			{
				id: 'natural-earth',
				title: 'Natural Earth, engraved base maps',
				gives: 'Land shapes of the engraved maps (static/maps).',
				citation: maps[0].meta,
				url: 'https://www.naturalearthdata.com/about/terms-of-use/',
				version: /world-atlas@[\w.-]+/.exec(maps[0].meta)?.[0] ?? null,
				licence: /public domain/i.test(maps[0].meta) ? 'Public domain' : null,
				accessed: [],
				files: maps.map((m) => m.file),
				notes: maps.slice(1).filter((m) => m.meta !== maps[0].meta).map((m) => `${m.file}: ${m.meta}`)
			}
		],
		generated: [
			{
				file: 'src/lib/data/tree.json',
				generatedBy: tree.generatedBy,
				generatedAt: null,
				description: `Parker 2017 tree restricted to ${tree.breeds.length} breeds, every dog kept.`,
				inputs: tree.source.files,
				notes: tree.splitBreeds.length ? [`Breeds split across subtrees: ${tree.splitBreeds.join(', ')}`] : []
			},
			{
				file: 'src/lib/data/images.json',
				generatedBy: imagesFile.generatedBy,
				generatedAt: day(imagesFile.generatedAt),
				description: imagesFile.source.description,
				inputs: imagesFile.source.inputs,
				notes: []
			},
			{
				file: 'src/lib/data/breeds.json',
				generatedBy: breedsFile.generatedBy,
				generatedAt: day(breedsFile.generatedAt),
				description: breedsFile.source.description,
				inputs: breedsFile.source.inputs,
				notes: breedsFile.source.notes
			}
		],
		manual: [
			{
				file: 'data/manual/breed-names.json',
				about: names._about,
				entries: names.entries.length,
				reviewed: names.entries.filter((e) => e.reviewed).length,
				sources: names.sources
			},
			{
				file: 'data/manual/display-names.json',
				about: displayNames._about,
				entries: displayNames.entries.length,
				reviewed: displayNames.entries.filter((e) => e.reviewed).length,
				sources: []
			},
			{
				file: 'data/manual/origin-places.json',
				about: places._about,
				entries: places.entries.length,
				reviewed: places.entries.filter((e) => e.reviewed).length,
				sources: []
			},
			{
				file: 'data/manual/parker-leaf-prefixes.json',
				about: prefixes._about,
				entries: prefixes.aliases.length,
				reviewed: prefixes.aliases.filter((e) => e.reviewed).length,
				sources: []
			}
		],
		editorial,
		fonts,
		photos: imagesFile.images
			.map((i) => ({ ...i, name: nameOf.get(i.breedId) ?? i.breedId }))
			.sort((a, b) => a.name.localeCompare(b.name)),
		withoutPhoto: breedsFile.breeds
			.filter((b) => !imagesFile.images.some((i) => i.breedId === b.id))
			.map((b) => ({ id: b.id, name: b.names.en }))
			.sort((a, b) => a.name.localeCompare(b.name)),
		breeds: breedsFile.breeds
			.map((b) => ({ id: b.id, name: b.names.en, sources: b.sources }))
			.sort((a, b) => a.name.localeCompare(b.name))
	};
};
