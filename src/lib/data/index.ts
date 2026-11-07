/**
 * Typed access to the generated data for the browser.
 * The files are validated by `npm run validate` (run before every build), so they are cast here
 * instead of parsed again: Zod stays out of the client bundle.
 */
import treeJson from './tree.json';
import breedsJson from './breeds.json';
import imagesJson from './images.json';
import type { TreeFile } from './schemas/tree.ts';
import type { Breed, BreedsFile } from './schemas/breeds.ts';
import type { BreedImage, ImagesFile } from './schemas/images.ts';

// JSON imports are typed structurally (string instead of literal unions): validated upstream, see above.
export const tree = treeJson as unknown as TreeFile;
export const breedsFile = breedsJson as unknown as BreedsFile;
export const imagesFile = imagesJson as unknown as ImagesFile;

export const breeds: readonly Breed[] = breedsFile.breeds;
export const breedById: ReadonlyMap<string, Breed> = new Map(breeds.map((b) => [b.id, b]));

/** Parker abbreviation of a tree leaf -> site breed (size varieties share one breed). */
export const breedByAbbrev: ReadonlyMap<string, Breed> = new Map(
	breeds.flatMap((b) => b.parker.entries.map((e) => [e.abbrev, b] as const))
);

/** Credited Commons photo of a breed; absent when no free, credited file exists (data/reports/images.md). */
export const imageByBreed: ReadonlyMap<string, BreedImage> = new Map(imagesFile.images.map((i) => [i.breedId, i]));
