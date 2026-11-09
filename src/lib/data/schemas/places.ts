import { z } from 'zod';
import { qidSchema } from './breed-names.ts';

/**
 * data/manual/origin-places.json: how a country (or region) written in the FCI export, or a
 * Wikidata P495 value, becomes a place on the map. Coordinates and continent are not typed here:
 * they come from Wikidata (P625, P30) through data/raw/wikidata-places.json.
 */
export const originPlaceSchema = z.strictObject({
	/** Country exactly as in the FCI export (`GREAT BRITAIN`), `null` for a place used only through P495. */
	fciCountry: z.string().min(1).nullable(),
	label: z.string().min(1),
	kind: z.enum(['country', 'region']),
	/** ISO 3166-1 alpha-2 for a country, `null` for a region. */
	iso: z.string().regex(/^[A-Z]{2}$/).nullable(),
	/** Wikidata item whose P625 gives the point drawn on the map (a region may borrow a country's item). */
	wikidata: qidSchema,
	basis: z.string().min(1),
	doubts: z.array(z.string().min(1)),
	/** Only Paul sets this to true. */
	reviewed: z.boolean()
});

export const originPlacesFileSchema = z
	.strictObject({ _about: z.string().min(1), entries: z.array(originPlaceSchema).min(1) })
	.superRefine((f, ctx) => {
		const fci = new Set<string>();
		const qids = new Set<string>();
		f.entries.forEach((e, i) => {
			if ((e.kind === 'country') !== (e.iso !== null))
				ctx.addIssue({ code: 'custom', path: ['entries', i, 'iso'], message: 'a country has an ISO code, a region has none' });
			if (e.fciCountry !== null) {
				if (fci.has(e.fciCountry)) ctx.addIssue({ code: 'custom', path: ['entries', i], message: `duplicate FCI country ${e.fciCountry}` });
				fci.add(e.fciCountry);
			}
			// a region may borrow the point of a country (two-country FCI regions); two countries may not share an item
			if (e.kind === 'country') {
				if (qids.has(e.wikidata)) ctx.addIssue({ code: 'custom', path: ['entries', i], message: `duplicate QID ${e.wikidata}` });
				qids.add(e.wikidata);
			}
		});
	});

export type OriginPlace = z.infer<typeof originPlaceSchema>;
