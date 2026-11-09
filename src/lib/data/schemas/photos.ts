import { z } from 'zod';
import { breedIdSchema } from './breed-names.ts';

/**
 * data/manual/photos.json: hand-picked Commons photos and author credits (Paul, 2026-11-09).
 * `file` replaces the Wikidata P18 image of breeds.json; `author` replaces the Commons
 * Artist/Attribution text when that text is not a usable credit. Each says why in `basis`.
 */
export const photoChoiceSchema = z
	.strictObject({
		breedId: breedIdSchema,
		/** Commons file name without `File:`, when the P18 image is not used. */
		file: z.string().min(1).optional(),
		/** Credit shown instead of the Commons metadata, read from the file page. */
		author: z.string().min(1).optional(),
		basis: z.string().min(1),
		/** Only Paul sets this to true. */
		reviewed: z.boolean()
	})
	.refine((p) => p.file || p.author, { message: 'a photo choice sets a file, an author or both' });

export const photosFileSchema = z
	.strictObject({ _about: z.string().min(1), entries: z.array(photoChoiceSchema) })
	.superRefine((f, ctx) => {
		const ids = new Set<string>();
		f.entries.forEach((e, i) => {
			if (ids.has(e.breedId)) ctx.addIssue({ code: 'custom', path: ['entries', i, 'breedId'], message: `duplicate breed ${e.breedId}` });
			ids.add(e.breedId);
		});
	});

export type PhotoChoice = z.infer<typeof photoChoiceSchema>;
