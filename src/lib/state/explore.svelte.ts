/**
 * The shared state of the explorer. Views read it and change it only through its actions;
 * they never talk to each other. Provided by context so that nothing leaks between prerendered pages.
 */
import { createContext } from 'svelte';

/** What the pointer or the keyboard focus is on. `branch` ids are tree-local node keys (see tree-layout.ts). */
export type Hover = { kind: 'breed'; id: string } | { kind: 'branch'; id: string } | null;

export class ExploreState {
	#selectedBreed = $state<string | null>(null);
	#hovered = $state<Hover>(null);
	/** Year of the timeline cursor: reserved for the timeline (phase 4), kept in the URL already. */
	#t = $state<number | null>(null);
	readonly #breedIds: ReadonlySet<string>;

	constructor(breedIds: Iterable<string>) {
		this.#breedIds = new Set(breedIds);
	}

	get selectedBreed() {
		return this.#selectedBreed;
	}
	get hovered() {
		return this.#hovered;
	}
	get t() {
		return this.#t;
	}

	select(id: string) {
		if (this.#breedIds.has(id)) this.#selectedBreed = id;
	}
	clearSelection() {
		this.#selectedBreed = null;
	}
	hover(h: Exclude<Hover, null>) {
		this.#hovered = h;
	}
	/** Clears the hover, only if it is still `h` when given (a late `leave` must not erase a newer hover). */
	unhover(h?: Exclude<Hover, null>) {
		const cur = this.#hovered;
		if (!h || (cur && cur.kind === h.kind && cur.id === h.id)) this.#hovered = null;
	}

	/** Applies `?breed=<id>&t=<year>`; unknown or malformed values are ignored. */
	applyParams(params: URLSearchParams) {
		const breed = params.get('breed');
		this.#selectedBreed = breed && this.#breedIds.has(breed) ? breed : null;
		const t = Number.parseInt(params.get('t') ?? '', 10);
		this.#t = Number.isFinite(t) ? t : null;
	}

	toParams(): URLSearchParams {
		const p = new URLSearchParams();
		if (this.#selectedBreed) p.set('breed', this.#selectedBreed);
		if (this.#t !== null) p.set('t', String(this.#t));
		return p;
	}
}

export const [getExplore, setExplore] = createContext<ExploreState>();
