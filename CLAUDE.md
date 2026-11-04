# Dogtrails (dogtrails.net)

Static site telling where dog breeds come from: genetic tree, origin map, timeline.
**PLAN.md is the spec.** Its "Décisions prises" section is frozen: do not reopen it.
One task per session, aligned on the PLAN.md roadmap, reviewed by Paul before the next.

## Stack (fixed)

- SvelteKit **2** + Svelte 5 **runes** (forced in `vite.config.ts`), `adapter-static`, every page prerendered.
  Do not upgrade to SvelteKit 3 without asking.
- TypeScript `strict`. No UI library, no CSS framework.
- D3 v7 **individual modules only** (`d3-hierarchy`, `d3-geo`, `d3-scale`, `d3-shape`); never the full `d3` package.
  D3 computes, Svelte renders the SVG.
- Zod for every generated JSON. Scripts run with plain Node ≥ 22.18 (native type stripping):
  import local files with their `.ts` extension, erasable TS syntax only (no `enum`, no `namespace`).

## Golden rule: no data without a source

Nothing is displayed unless it traces back to a source. Every generated file carries a `source`
block; every route carries `evidence` (`genetic` / `historical` / `oral`) and a source. Zod and
`validate` fail the build otherwise. Ambiguities in sources are **reported, never silently resolved**
(e.g. breeds split across subtrees, unreviewed name mappings).

## Layout

```
data/raw/        raw extractions, versioned (Parker 2017 supplements + text extractions)
data/manual/     human-reviewed tables (name mappings, routes); entries carry `reviewed`
data/reports/    generated review reports (never edited by hand)
data/            sample-30.json, legacy tree-30.* (one dog per breed, from prune_tree.py)
scripts/         pipeline: extract, parse, fetch, merge, validate (scripts/lib: helpers)
src/lib/data/    generated JSON + Zod schemas (src/lib/data/schemas)
src/lib/state/   shared store + URL sync
src/lib/views/   TreeView, MapView, TimelineView
src/lib/story/   chapters and presets
src/routes/      /, /explore, /breed/[id], /sources
```

## Commands

```
npm run dev            dev server
npm run check          svelte-check + type-check of scripts/
npm run build          static build into build/ (runs validate first)
npm run data:extract   Parker supplements (PDF/XLSX) -> data/raw/parker2017-s5.nex, -s1.csv
npm run data:tree      -> src/lib/data/tree.json (+ report: splits, variants, warnings)
npm run data:fci       paiv/fci-breeds CSV at a pinned commit -> data/raw/fci-breeds/
npm run data:wikidata  SPARQL on the QIDs of breed-names.json -> data/raw/wikidata-breeds.json
npm run data:names-report  -> data/reports/breed-names.md (FCI vs Wikidata vs PLAN.md)
npm run validate       Zod + cross-checks on generated JSON
```

## Data notes

- Parker leaf names are `PREFIX_id`. Some prefixes (`Rtw`, `BoC`, `GSh`…) are Vaysse 2011 codes,
  mapped in `data/manual/parker-leaf-prefixes.json`. Only Paul marks entries `reviewed: true`.
- `data/manual/breed-names.json`: one entry per Parker abbreviation; size varieties (SPOO/MPOO/TPOO,
  XOLO/MXOL) share one site `id` and carry a `variant`. Wikidata stores FCI numbers as P528 + P972=Q38603,
  zero-padded (`055`).
- `*` after a clade in supplement 1 = in that clade with < 50 % bootstrap: kept as `cladeLowSupport`.
