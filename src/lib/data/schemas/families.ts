import { z } from 'zod';
import { breedIdSchema } from './breed-names.ts';
import { familySchema } from './breeds.ts';

/**
 * data/manual/families.json: the colour family of each breed outside the 30-breed table of
 * docs/DESIGN.md §2. Family is an editorial choice per breed, not a datum: every entry says why
 * (`basis`) and what else would fit (`doubts`). Drafts stay `reviewed: false` until Paul checks them.
 */
export const familyEntrySchema = z.strictObject({
	id: breedIdSchema,
	family: familySchema,
	basis: z.string().min(1),
	doubts: z.array(z.string().min(1)),
	/** Only Paul sets this to true. */
	reviewed: z.boolean()
});

export const familiesFileSchema = z
	.strictObject({ _about: z.string().min(1), entries: z.array(familyEntrySchema).min(1) })
	.superRefine((f, ctx) => {
		const seen = new Set<string>();
		f.entries.forEach((e, i) => {
			if (seen.has(e.id)) ctx.addIssue({ code: 'custom', path: ['entries', i, 'id'], message: `duplicate breed ${e.id}` });
			seen.add(e.id);
		});
	});

export type FamilyEntry = z.infer<typeof familyEntrySchema>;
