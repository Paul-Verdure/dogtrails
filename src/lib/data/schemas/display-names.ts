import { z } from 'zod';
import { breedIdSchema } from './breed-names.ts';

/**
 * data/manual/display-names.json: English names shown on the site when the Wikidata label is not the
 * usual name or casing (Paul, 2026-11-09). An editorial choice: Wikidata stays cited for the label it
 * replaces, and breeds.json keeps that label next to the displayed one.
 */
export const displayNameSchema = z.strictObject({
	id: breedIdSchema,
	en: z.string().min(1),
	basis: z.string().min(1),
	doubts: z.array(z.string().min(1)),
	/** Only Paul sets this to true. */
	reviewed: z.boolean()
});

export const displayNamesFileSchema = z
	.strictObject({ _about: z.string().min(1), entries: z.array(displayNameSchema) })
	.superRefine((f, ctx) => {
		const ids = new Set<string>();
		f.entries.forEach((e, i) => {
			if (ids.has(e.id)) ctx.addIssue({ code: 'custom', path: ['entries', i, 'id'], message: `duplicate id ${e.id}` });
			ids.add(e.id);
		});
	});

export type DisplayName = z.infer<typeof displayNameSchema>;
