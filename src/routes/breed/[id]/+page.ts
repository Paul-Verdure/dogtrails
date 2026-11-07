import { error } from '@sveltejs/kit';
import { breeds, breedById } from '$lib/data';
import type { EntryGenerator, PageLoad } from './$types';

/** One prerendered page per breed of breeds.json. */
export const entries: EntryGenerator = () => breeds.map((b) => ({ id: b.id }));

export const load: PageLoad = ({ params }) => {
	const breed = breedById.get(params.id);
	if (!breed) error(404, `No breed "${params.id}"`);
	return { breed };
};
