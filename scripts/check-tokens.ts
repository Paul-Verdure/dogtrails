/**
 * The day tokens exist twice in tokens.css: under [data-theme="day"] and under
 * @media (prefers-color-scheme: light) for visitors who made no choice. Fails if they drift.
 *
 * usage: node scripts/check-tokens.ts
 */
import { readFileSync } from 'node:fs';

const FILE = 'src/lib/styles/tokens.css';
const css = readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const decls = (block: string) =>
	[...block.matchAll(/(--dt-[\w-]+)\s*:\s*([^;]+);/g)].map((m) => `${m[1]}: ${m[2].trim()}`).sort();

const day = /\[data-theme="day"\]\s*\{([^}]*)\}/.exec(css)?.[1];
const os = /@media \(prefers-color-scheme: light\)\s*\{\s*:root:not\(\[data-theme\]\)\s*\{([^}]*)\}/.exec(css)?.[1];
if (!day || !os) throw new Error(`${FILE}: day block or OS-light block not found`);

const a = decls(day);
const b = decls(os);
const diff = [...a.filter((d) => !b.includes(d)), ...b.filter((d) => !a.includes(d))];
if (diff.length) {
	console.error(`${FILE}: day tokens and OS-light tokens differ:\n  ${diff.join('\n  ')}`);
	process.exit(1);
}
console.log(`${FILE}: OK (${a.length} day tokens in sync)`);
