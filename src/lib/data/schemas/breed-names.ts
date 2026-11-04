import { z } from 'zod';
import { abbrevSchema } from './tree.ts';

/** Site slug of a breed, e.g. `beagle`, `nova-scotia-duck-tolling-retriever`. */
export const breedIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const qidSchema = z.string().regex(/^Q[1-9][0-9]*$/);
/** FCI standard number (1, 172, 374…). */
export const fciNumberSchema = z.int().min(1);

/** FCI reference: a number, or `null` with the reason why there is none. */
export const fciRefSchema = z.union([
	z.strictObject({ number: fciNumberSchema }),
	z.strictObject({ number: z.null(), reason: z.string().min(1) })
]);

/** Another item considered for the same Parker entry, kept so the choice stays reviewable. */
export const alternativeSchema = z
	.strictObject({
		wikidata: qidSchema.optional(),
		fci: fciNumberSchema.optional(),
		note: z.string().min(1)
	})
	.refine((a) => a.wikidata || a.fci, { message: 'an alternative names a QID or an FCI number' });

/**
 * One Parker 2017 supplement-1 abbreviation and the site breed it is attached to.
 * Several abbreviations may share an `id` (size varieties): they then carry a `variant`.
 */
export const breedNameEntrySchema = z.strictObject({
	abbrev: abbrevSchema,
	/** Breed name exactly as in supplement 1. */
	parkerName: z.string().min(1),
	id: breedIdSchema,
	/** Size variety within the site breed (`standard`, `miniature`, `toy`), `null` if none. */
	variant: z.string().min(1).nullable(),
	wikidata: qidSchema,
	fci: fciRefSchema,
	/** Why this attachment: which source says what. */
	basis: z.string().min(1),
	/** Open questions for Paul. Never resolved silently. */
	doubts: z.array(z.string().min(1)),
	alternatives: z.array(alternativeSchema),
	/** Only Paul sets this to true. */
	reviewed: z.boolean()
});

export const breedNamesFileSchema = z
	.strictObject({
		_about: z.string().min(1),
		sources: z
			.array(z.strictObject({ id: z.string().min(1), citation: z.string().min(1), url: z.url() }))
			.min(1),
		entries: z.array(breedNameEntrySchema).min(1)
	})
	.superRefine((f, ctx) => {
		const seen = new Set<string>();
		const byId = new Map<string, z.infer<typeof breedNameEntrySchema>[]>();
		f.entries.forEach((e, i) => {
			if (seen.has(e.abbrev)) ctx.addIssue({ code: 'custom', path: ['entries', i, 'abbrev'], message: `duplicate abbreviation ${e.abbrev}` });
			seen.add(e.abbrev);
			byId.set(e.id, [...(byId.get(e.id) ?? []), e]);
		});
		for (const [id, es] of byId) {
			if (es.length === 1) continue;
			const path = ['entries'];
			if (es.some((e) => e.variant === null)) ctx.addIssue({ code: 'custom', path, message: `${id}: shared by ${es.length} entries, each needs a variant` });
			if (new Set(es.map((e) => e.variant)).size !== es.length) ctx.addIssue({ code: 'custom', path, message: `${id}: duplicate variant` });
			if (new Set(es.map((e) => e.wikidata)).size !== 1) ctx.addIssue({ code: 'custom', path, message: `${id}: variants disagree on the Wikidata QID` });
			if (new Set(es.map((e) => e.fci.number)).size !== 1) ctx.addIssue({ code: 'custom', path, message: `${id}: variants disagree on the FCI number` });
		}
	});

export type BreedNameEntry = z.infer<typeof breedNameEntrySchema>;
export type BreedNamesFile = z.infer<typeof breedNamesFileSchema>;
