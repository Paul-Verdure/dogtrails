import { z } from 'zod';

/** Parker 2017 breed abbreviation, e.g. `BEAG`. */
export const abbrevSchema = z.string().regex(/^[A-Z0-9]+$/);
/** Slug of a Parker clade label, e.g. `new-world`. */
export const cladeIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const sourceSchema = z.strictObject({
	citation: z.string().min(1),
	doi: z.string().min(1),
	url: z.url(),
	/** Licence of the published article and its supplements, with where it was read. */
	licence: z.strictObject({ name: z.string().min(1), url: z.url(), basis: z.string().min(1), checked: z.iso.date() }),
	files: z.array(z.string().min(1)).min(1),
	notes: z.array(z.string())
});

/** A breed, or one fragment of a breed whose dogs do not form a single subtree. */
export const treeLeafSchema = z.strictObject({
	name: z.string().min(1),
	abbrev: abbrevSchema,
	cladeId: cladeIdSchema,
	dogs: z.int().min(1),
	dogIds: z.array(z.string().min(1)).min(1),
	split: z.strictObject({ part: z.int().min(1), of: z.int().min(2) }).optional()
});

export type TreeLeaf = z.infer<typeof treeLeafSchema>;
export type TreeInternal = { support: number | null; children: TreeNode[] };
export type TreeNode = TreeLeaf | TreeInternal;

/** Internal node: `support` is the bootstrap value of the same node in the full Parker tree. */
export const treeInternalSchema: z.ZodType<TreeInternal> = z.strictObject({
	support: z.number().min(0).max(100).nullable(),
	get children() {
		return z.array(treeNodeSchema).min(2);
	}
});

export const treeNodeSchema: z.ZodType<TreeNode> = z.union([treeLeafSchema, treeInternalSchema]);

export const breedSummarySchema = z.strictObject({
	abbrev: abbrevSchema,
	name: z.string().min(1),
	clade: z.string().min(1),
	cladeId: cladeIdSchema,
	/** Marked `*` in supplement 1: included in the clade with < 50 % bootstrap support. */
	cladeLowSupport: z.boolean(),
	dogs: z.int().min(1),
	/** Number of separate subtrees the breed's dogs form, in the sample tree and in the full tree. */
	fragments: z.strictObject({ sample: z.int().min(1), full: z.int().min(1) }),
	/** Other breeds found inside the breed's most recent common ancestor in the full tree. */
	fullTreeIntruders: z.array(abbrevSchema),
	/** Other supplement-1 entries with the same base name (e.g. `MXOL` for `XOLO`): NOT merged. */
	variants: z.array(abbrevSchema)
});

export const treeFileSchema = z.strictObject({
	source: sourceSchema,
	generatedBy: z.string().min(1),
	breeds: z.array(breedSummarySchema).min(1),
	/** Breeds split into several leaves in `root`: reported, never silently merged. */
	splitBreeds: z.array(abbrevSchema),
	root: treeInternalSchema
});

export type BreedSummary = z.infer<typeof breedSummarySchema>;
export type TreeFile = z.infer<typeof treeFileSchema>;

export const isLeaf = (n: TreeNode): n is TreeLeaf => !('children' in n);
