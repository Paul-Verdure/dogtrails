# Dogtrails (dogtrails.net)

An atlas of where dog breeds come from: a radial genetic tree, a world map of origins and a timeline,
linked by one shared state. Site in English first.

- **`docs/PLAN.md` is the spec** (scope, data, roadmap). Its "Décisions prises" section is frozen: do not reopen it.
- **`docs/DESIGN.md` is the visual system B+** ("a star atlas read by lantern light"), validated by Paul.
  Tokens: `src/lib/styles/tokens.css` (`--dt-` prefix).
- One task per session, aligned on the roadmap phase, reviewed by Paul before the next; stop and summarise.

## Stack (fixed)

- SvelteKit **2** + Svelte 5 **runes only** (`$state`, `$derived`, `$effect`, `$props`; forced in `vite.config.ts`),
  `adapter-static`, every page prerendered. Do not upgrade to SvelteKit 3 without asking.
- TypeScript `strict`. No `any` without a comment explaining why. No UI library, no CSS framework.
- D3 v7 **individual modules only** (`d3-hierarchy`, `d3-geo`, `d3-scale`, `d3-shape`); never the full `d3` package.
  D3 computes, Svelte renders the SVG: no D3 DOM manipulation.
- Scrollama 3 for the story (not installed yet). Zod for every generated JSON.
- Scripts run with plain Node ≥ 22.18 (native type stripping): import local files with their `.ts`
  extension, erasable TS syntax only (no `enum`, no `namespace`). Outputs are committed.
- Fonts self-hosted via `@fontsource` (OFL): no request to Google. No server, no cookies, no tracking beyond Plausible (optional).

## Golden rules

- **No data without a source.** Every generated file carries a `source` block; every breed, route and date
  carries `sources[]`. Zod and `validate` fail the build otherwise. Ambiguities in sources are
  **reported, never silently resolved** (breeds split across subtrees, unreviewed name mappings).
- **Every route has `evidence`: `genetic` | `historical` | `oral`.** It picks the stroke style.
  Never draw a line on the map that is not a route (constellations stay in legends, filters, cards).
- Facts used in the mock-ups but unverified are listed in `docs/DESIGN.md` §10: source them before publishing.
- Views (`TreeView`, `MapView`, `TimelineView`) never talk to each other: they read the store and write
  through actions. The story only applies presets. State is shareable in the URL (`?breed=beagle&t=1830`).
- Use design tokens (`var(--dt-*)`), never raw hex in components. Theme: `data-theme="night|day"` on `<html>`;
  without it, the OS preference applies (the day tokens exist twice in `tokens.css`: `npm run check` keeps them in sync).
- MapView uses the projections of `src/lib/map/projections.ts`, the same as the engraved base maps.
- Motion ≤ 600 ms, everything honours `prefers-reduced-motion`.
- Accessibility: tree keyboard-navigable, AA contrast, 44 px hit areas, every visual has a text summary.
- Do not copy FCI standard texts; facts only. Photos only from Wikimedia Commons with generated credits.
- Family (8 colour families) is an editorial choice per breed, not a datum (`docs/DESIGN.md` §2).

## Layout

```
docs/            PLAN.md (spec), DESIGN.md (visual system)
data/raw/        raw extractions, versioned (Parker 2017 supplements + text extractions)
data/manual/     human-reviewed tables (name mappings, routes); entries carry `reviewed`
data/reports/    generated review reports (never edited by hand)
data/            sample-30.json, legacy tree-30.* (one dog per breed, from prune_tree.py)
scripts/         pipeline: extract, parse, fetch, merge, validate, maps (scripts/lib: helpers)
src/lib/data/    generated JSON + Zod schemas (src/lib/data/schemas)
src/lib/map/     shared map projections
src/lib/styles/  tokens.css
src/lib/state/   shared store + URL sync
src/lib/views/   TreeView, MapView, TimelineView
src/lib/story/   chapters and presets
src/routes/      /, /explore, /breed/[id], /sources
static/maps/     engraved base maps (generated)
```

## Commands

```
npm run dev            dev server
npm run check          svelte-check + type-check of scripts/ + token sync check
npm run build          static build into build/ (runs validate first)
npm run data:extract   Parker supplements (PDF/XLSX) -> data/raw/parker2017-s5.nex, -s1.csv
npm run data:tree      -> src/lib/data/tree.json (+ report: splits, variants, warnings)
npm run data:fci       paiv/fci-breeds CSV at a pinned commit -> data/raw/fci-breeds/
npm run data:wikidata  SPARQL on the QIDs of breed-names.json -> data/raw/wikidata-breeds.json
npm run data:names-report  -> data/reports/breed-names.md (FCI vs Wikidata vs docs/PLAN.md)
npm run validate       Zod + cross-checks on generated JSON
npm run maps           -> static/maps/{world,atlantic}-{night,day}.svg (Natural Earth via world-atlas)
```

## Data notes

- Parker leaf names are `PREFIX_id`. Some prefixes (`Rtw`, `BoC`, `GSh`…) are Vaysse 2011 codes,
  mapped in `data/manual/parker-leaf-prefixes.json`. Only Paul marks entries `reviewed: true`.
- `data/manual/breed-names.json` (the name mapping table, human-reviewed: propose changes, never apply
  them silently): one entry per Parker abbreviation; size varieties (SPOO/MPOO/TPOO, XOLO/MXOL) share one
  site `id` and carry a `variant`. Wikidata stores FCI numbers as P528 + P972=Q38603, zero-padded (`055`).
- Origin rule (Paul, 2026-11-04): `origin` = FCI country; Wikidata P495 only cross-checks, its
  disagreements are reported, never turned into `development` automatically. FCI regions stay regions
  (Saluki: "Middle East"). Breeds without FCI number (Rat Terrier) take their origin from Wikidata P495.
- `*` after a clade in supplement 1 = in that clade with < 50 % bootstrap: kept as `cladeLowSupport`.

## Conventions

- Commit messages in English, imperative mood.
