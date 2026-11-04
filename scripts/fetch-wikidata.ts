/**
 * Fetches Wikidata facts for every QID of data/manual/breed-names.json (entries and alternatives):
 * English/French/Dutch labels, country of origin (P495, with ISO 3166-1 alpha-2 P297),
 * FCI standard number (P528 catalogue code qualified by P972 = Q38603 FCI) and image (P18).
 *
 * Then fetches, for every place of data/manual/origin-places.json: English label, ISO 3166-1
 * alpha-2 (P297), coordinates (P625) and continent (P30).
 *
 * The raw SPARQL JSON is stored untouched in data/raw/wikidata-breeds.json and
 * data/raw/wikidata-places.json, together with the endpoint, the query and the fetch date.
 * Interpretation happens in validate/report/merge.
 *
 * usage: node scripts/fetch-wikidata.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { breedNamesFileSchema } from '../src/lib/data/schemas/breed-names.ts';
import { originPlacesFileSchema } from '../src/lib/data/schemas/places.ts';

const NAMES = 'data/manual/breed-names.json';
const OUT = 'data/raw/wikidata-breeds.json';
const PLACES = 'data/manual/origin-places.json';
const PLACES_OUT = 'data/raw/wikidata-places.json';
const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'dogtrails-pipeline/0.1 (https://dogtrails.net)';
const FCI = 'Q38603';

const names = breedNamesFileSchema.parse(JSON.parse(readFileSync(NAMES, 'utf8')));
const qids = [
	...new Set(names.entries.flatMap((e) => [e.wikidata, ...e.alternatives.flatMap((a) => (a.wikidata ? [a.wikidata] : []))]))
].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

const query = `SELECT ?item ?labelEn ?labelFr ?labelNl ?origin ?originLabel ?originIso ?fci ?image WHERE {
  VALUES ?item { ${qids.map((q) => `wd:${q}`).join(' ')} }
  OPTIONAL { ?item rdfs:label ?labelEn FILTER(LANG(?labelEn) = "en") }
  OPTIONAL { ?item rdfs:label ?labelFr FILTER(LANG(?labelFr) = "fr") }
  OPTIONAL { ?item rdfs:label ?labelNl FILTER(LANG(?labelNl) = "nl") }
  OPTIONAL {
    ?item wdt:P495 ?origin .
    OPTIONAL { ?origin rdfs:label ?originLabel FILTER(LANG(?originLabel) = "en") }
    OPTIONAL { ?origin wdt:P297 ?originIso }
  }
  OPTIONAL { ?item p:P528 ?cat . ?cat ps:P528 ?fci ; pq:P972 wd:${FCI} . }
  OPTIONAL { ?item wdt:P18 ?image }
}
ORDER BY ?item`;

type Results = { results: { bindings: Record<string, { value: string }>[] } };

async function run(qids: string[], query: string, out: string) {
	const res = await fetch(ENDPOINT, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/sparql-results+json',
			'User-Agent': USER_AGENT
		},
		body: new URLSearchParams({ query })
	});
	if (!res.ok) throw new Error(`${ENDPOINT}: HTTP ${res.status} ${await res.text()}`);
	const results = (await res.json()) as Results;
	const found = new Set(results.results.bindings.map((b) => b.item.value.split('/').pop()));
	const missing = qids.filter((q) => !found.has(q));
	if (missing.length) throw new Error(`${out}: no result for ${missing.join(', ')}`);
	const raw = {
		source: 'Wikidata Query Service',
		endpoint: ENDPOINT,
		fetchedAt: new Date().toISOString(),
		licence: 'CC0 1.0 (Wikidata structured data)',
		qids,
		query,
		results
	};
	writeFileSync(out, JSON.stringify(raw, null, '\t') + '\n');
	console.log(`${out}: ${qids.length} items, ${results.results.bindings.length} rows`);
}

await run(qids, query, OUT);

const places = originPlacesFileSchema.parse(JSON.parse(readFileSync(PLACES, 'utf8')));
const placeQids = [...new Set(places.entries.map((e) => e.wikidata))].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
const placesQuery = `SELECT ?item ?labelEn ?iso ?coord ?continent ?continentLabel WHERE {
  VALUES ?item { ${placeQids.map((q) => `wd:${q}`).join(' ')} }
  OPTIONAL { ?item rdfs:label ?labelEn FILTER(LANG(?labelEn) = "en") }
  OPTIONAL { ?item wdt:P297 ?iso }
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL {
    ?item wdt:P30 ?continent .
    OPTIONAL { ?continent rdfs:label ?continentLabel FILTER(LANG(?continentLabel) = "en") }
  }
}
ORDER BY ?item`;
await run(placeQids, placesQuery, PLACES_OUT);
