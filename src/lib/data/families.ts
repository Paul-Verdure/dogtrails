import type { Family } from './schemas/breeds.ts';

/** Display names of the 8 colour families (docs/DESIGN.md §2): editorial, not data. */
export const families: Record<Family, { label: string; constellation: string }> = {
	herding: { label: 'Herding', constellation: 'the Crook' },
	sighthound: { label: 'Sighthounds', constellation: 'the Runner' },
	spitz: { label: 'Spitz', constellation: 'the Curled Tail' },
	mastiff: { label: 'Mastiffs', constellation: 'the Gate' },
	terrier: { label: 'Terriers', constellation: 'the Burrow' },
	hunting: { label: 'Hunting dogs', constellation: 'the Scent' },
	companion: { label: 'Companions', constellation: 'the Lap' },
	ancient: { label: 'Ancient', constellation: 'the First Fire' }
};

/** The four-point star of docs/DESIGN.md §3, 20 × 20 around (0, 0). */
export const STAR_PATH = 'M0,-10L2.2,-2.2L10,0L2.2,2.2L0,10L-2.2,2.2L-10,0L-2.2,-2.2Z';
