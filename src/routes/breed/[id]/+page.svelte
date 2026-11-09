<!--
	Breed page: facts only (no FCI standard text), each one tied to a numbered source of the breed.
	Empty fields say "Not yet sourced" instead of guessing. The photo comes with its generated Commons credit;
	without a credited free file (images.json), no photo is shown.
-->
<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import { tree, breedByAbbrev, breeds, imageByBreed } from '$lib/data';
	import { families } from '$lib/data/families';
	import type { Breed } from '$lib/data/schemas/breeds';
	import { layoutTree } from '$lib/views/tree-layout';
	import FamilyEmblem from '$lib/views/FamilyEmblem.svelte';
	import TreeExcerpt from '$lib/views/TreeExcerpt.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const breed = $derived(data.breed);
	const photo = $derived(imageByBreed.get(breed.id));
	/** Tallest a photo is drawn; its width follows from the ratio so the box is known before loading. */
	const PHOTO_MAX_HEIGHT = 360;

	const layout = layoutTree(tree, (a) => breedByAbbrev.get(a));

	/** Source number shown next to a fact: its rank in the breed's `sources[]`. */
	const refOf = (b: Breed, sourceId: string) => b.sources.findIndex((s) => s.id === sourceId) + 1;

	const parkerNames = $derived(
		breed.parker.entries.filter((e) => e.inTree && e.name !== breed.names.en).map((e) => e.name)
	);
	const otherNames = $derived(
		[
			{ lang: 'en', label: 'Wikidata', name: breed.names.wikidataEn },
			{ lang: 'fr', label: 'French', name: breed.names.fr },
			{ lang: 'nl', label: 'Dutch', name: breed.names.nl }
		].filter(
			(o): o is { lang: string; label: string; name: string } =>
				o.name !== null && o.name.toLowerCase() !== breed.names.en.toLowerCase()
		)
	);
	const leaf = $derived(layout.leaves.find((l) => l.breed.id === breed.id));
	const relatives = $derived(leaf?.relatives ?? []);
	const sameClade = $derived(
		breeds
			.filter((b) => b.id !== breed.id && breed.parker.cladeId !== null && b.parker.cladeId === breed.parker.cladeId)
			.sort((a, b) => a.names.en.localeCompare(b.names.en))
	);

	/** `35° N · 136° E`, minutes only when the value has some. */
	function coords([lon, lat]: [number, number]) {
		const dm = (v: number) => {
			const a = Math.abs(v);
			const d = Math.floor(a);
			const m = Math.round((a - d) * 60);
			return m ? `${d}°${String(m).padStart(2, '0')}′` : `${d}°`;
		};
		return `${dm(lat)} ${lat >= 0 ? 'N' : 'S'} · ${dm(lon)} ${lon >= 0 ? 'E' : 'W'}`;
	}
	const year = (y: number) => (y < 0 ? `${-y} BCE` : String(y));
</script>

<svelte:head>
	<title>{breed.names.en} · Dogtrails</title>
	<meta
		name="description"
		content="{breed.names.en}: {breed.origin ? `origin ${breed.origin.place.label}, ` : ''}{breed.parker.clade
			? `${breed.parker.clade} clade`
			: 'no clade'} (Parker et al. 2017). Every fact with its source."
	/>
</svelte:head>

{#snippet ref(sourceId: string)}
	{@const n = refOf(breed, sourceId)}
	<sup><a class="ref" href="#source-{n}" aria-label="Source {n}">[{n}]</a></sup>
{/snippet}

{#snippet notYet()}
	<span class="none">Not yet sourced</span>
{/snippet}

<article class="page">
	<header class="head" class:with-photo={!!photo}>
		<div class="emblem"><FamilyEmblem family={breed.family.id} /></div>
		<div>
			<p class="eyebrow">{families[breed.family.id].label} · {families[breed.family.id].constellation}</p>
			<h1>{breed.names.en}{@render ref(breed.names.enSourceId)}</h1>
			{#if parkerNames.length}
				<p class="aside">In Parker et al. 2017 as {parkerNames.join(', ')}{@render ref(breed.parker.sourceId)}</p>
			{/if}
			<p class="actions">
				<a class="pill" href="{resolve('/explore')}?breed={breed.id}">See it in the tree</a>
			</p>
		</div>
		{#if photo}
			<figure class="photo">
				<img
					src={asset(`/${photo.thumb.path}`)}
					width={photo.thumb.width}
					height={photo.thumb.height}
					style:width="min(100%, {Math.round((PHOTO_MAX_HEIGHT * photo.thumb.width) / photo.thumb.height)}px)"
					alt="Photograph of the {breed.names.en} breed"
					loading="lazy"
					decoding="async"
				/>
				<figcaption>
					Photo: {photo.author},
					{#if photo.licence.url}<a href={photo.licence.url} rel="external noopener license">{photo.licence.name}</a
						>{:else}{photo.licence.name}{/if}, via
					<a href={photo.filePage} rel="external noopener">Wikimedia Commons</a>
				</figcaption>
			</figure>
		{/if}
	</header>

	<div class="grid">
		<section aria-labelledby="facts">
			<h2 id="facts">Facts</h2>
			<dl>
				<dt>Family</dt>
				<dd>
					{families[breed.family.id].label}{@render ref(breed.family.sourceId)}
					<span class="note">an editorial choice of Dogtrails, not genetic data</span>
				</dd>

				<dt>Clade</dt>
				<dd>
					{#if breed.parker.clade}
						{breed.parker.clade}{@render ref(breed.parker.sourceId)}
					{:else}
						None{@render ref(breed.parker.sourceId)}
						<span class="note">Parker et al. 2017 place it in none of their clades</span>
					{/if}
					{#if breed.parker.cladeLowSupport}<span class="note">in this clade with low support (below 50 / 100)</span>{/if}
				</dd>

				<dt>FCI</dt>
				<dd>
					{#if breed.fci.number !== null}
						Standard no. {breed.fci.number}, group {breed.fci.group}{@render ref(breed.fci.sourceId)}
						{#if breed.fci.section}<span class="note">{breed.fci.section}</span>{/if}
						{#if breed.fci.provisional}<span class="note">provisionally accepted on {breed.fci.provisional}</span>{/if}
					{:else}
						Not in the FCI nomenclature <span class="note">{breed.fci.reason}</span>
					{/if}
				</dd>

				<dt>Origin</dt>
				<dd>
					{#if breed.origin}
						<span class="place">{breed.origin.place.label}</span>{@render ref(breed.origin.place.sourceId)}
						<span class="note coords"
							>Map point {coords(breed.origin.coords.lonLat)}{@render ref(breed.origin.coords.sourceId)}</span
						>
					{:else}
						{@render notYet()}
					{/if}
				</dd>

				<dt>Developed in</dt>
				<dd>
					{#if breed.development.length}
						<ul class="plain">
							{#each breed.development as d, i (i)}
								<li>
									<span class="place">{d.place.label}</span>{d.period ? `, ${d.period}` : ''}{@render ref(d.place.sourceId)}
								</li>
							{/each}
						</ul>
					{:else}
						{@render notYet()}
					{/if}
				</dd>

				<dt>Fixed around</dt>
				<dd>
					{#if breed.fixedAround}
						{breed.fixedAround.approximate ? 'c. ' : ''}{year(breed.fixedAround.year)}{@render ref(breed.fixedAround.sourceId)}
					{:else}
						{@render notYet()}
					{/if}
				</dd>

				{#if otherNames.length}
					<dt>Other names</dt>
					<dd>
						{#each otherNames as o, i (o.lang)}{i > 0 ? ', ' : ''}<span lang={o.lang}>{o.name}</span> ({o.label}){/each}{@render
							ref(breed.names.sourceId)}
					</dd>
				{/if}

				<dt>In the study</dt>
				<dd>
					{#each breed.parker.entries as e, i (e.abbrev)}{i > 0 ? ', ' : ''}<abbr title={e.name}>{e.abbrev}</abbr
						>{e.variant ? ` (${e.variant})` : ''}{/each}{@render ref(breed.parker.sourceId)}
					<span class="note">Parker et al. 2017 abbreviation{breed.parker.entries.length > 1 ? 's' : ''}</span>
				</dd>
			</dl>
		</section>

		<section aria-labelledby="in-tree">
			<h2 id="in-tree">In the tree</h2>
			<div class="excerpt">
				<TreeExcerpt {layout} breedId={breed.id} />
			</div>
			<p>
				{#if relatives.length === 0}
					No well-supported group holds the {breed.names.en} with other breeds of this tree.
				{:else if relatives.length <= 5}
					Closest in this tree:
					{#each relatives as r, i (r.id)}{i > 0 ? (i === relatives.length - 1 ? ' and ' : ', ') : ''}<a
							href={resolve('/breed/[id]', { id: r.id })}>{r.names.en}</a
						>{/each}.
				{:else}
					It sits in a group of {relatives.length + 1} breeds whose order the DNA does not decide.
				{/if}
				{@render ref(breed.parker.sourceId)}
			</p>
			{#if sameClade.length}
				<p>
					Also in the {breed.parker.clade} clade:
					{#each sameClade as b, i (b.id)}{i > 0 ? ', ' : ''}<a href={resolve('/breed/[id]', { id: b.id })}
							>{b.names.en}</a
						>{/each}.
				</p>
			{/if}
			<p class="note">
				Groupings with a DNA support below 50 / 100 are merged, as in the explorer. The tree holds
				{new Set(layout.leaves.map((l) => l.breed.id)).size} breeds.
			</p>
		</section>
	</div>

	<section aria-labelledby="sources" class="sources">
		<h2 id="sources">Sources</h2>
		<ol>
			{#each breed.sources as s, i (s.id)}
				<li id="source-{i + 1}">
					{#if s.url}<a href={s.url} rel="external noopener">{s.citation}</a>{:else}{s.citation} (<code>{s.path}</code>){/if}
					<span class="note">read {s.retrieved}</span>
				</li>
			{/each}
		</ol>
		<p class="note">
			Facts only: no text of the FCI standards is reproduced. <a href={resolve('/sources')}>All datasets and licences</a>.
		</p>
	</section>
</article>

<style>
	.page {
		max-width: 1120px;
		margin: 0 auto;
		padding: var(--dt-space-6) var(--dt-gutter-mobile) var(--dt-space-8);
	}
	.head {
		display: grid;
		grid-template-columns: 96px minmax(0, 1fr);
		gap: var(--dt-space-5);
		align-items: center;
		margin-bottom: var(--dt-space-7);
	}
	.photo {
		grid-column: 1 / -1;
		margin: 0;
		max-width: 480px;
	}
	@media (min-width: 900px) {
		.head.with-photo {
			grid-template-columns: 96px minmax(0, 1fr) minmax(0, 400px);
		}
		.photo {
			grid-column: auto;
		}
	}
	.photo img {
		display: block;
		height: auto;
		border-radius: var(--dt-radius-lg);
		border: 1px solid var(--dt-line);
		background: var(--dt-surface-raised);
	}
	.photo figcaption {
		margin-top: var(--dt-space-2);
		color: var(--dt-ink-3);
		font-size: var(--dt-text-small);
		overflow-wrap: anywhere;
	}
	.eyebrow {
		margin: 0;
		font-size: var(--dt-text-label);
		font-weight: 600;
		letter-spacing: var(--dt-tracking-label);
		text-transform: uppercase;
		color: var(--dt-accent-text);
	}
	h1 {
		margin: var(--dt-space-2) 0;
		font-family: var(--dt-font-serif);
		font-weight: 400;
		font-size: var(--dt-text-h1);
		line-height: 1;
		color: var(--dt-ink);
	}
	h1 sup {
		font-family: var(--dt-font-sans);
		font-size: var(--dt-text-small);
		vertical-align: super;
	}
	h2 {
		margin: 0 0 var(--dt-space-4);
		font-size: var(--dt-text-label);
		font-weight: 600;
		letter-spacing: var(--dt-tracking-label);
		text-transform: uppercase;
		color: var(--dt-ink-3);
	}
	.aside {
		margin: 0;
		color: var(--dt-ink-3);
		font-size: var(--dt-text-small);
	}
	.actions {
		margin: var(--dt-space-4) 0 0;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		min-height: var(--dt-hit);
		padding: 0 var(--dt-space-5);
		border: 1px solid var(--dt-line-strong);
		border-radius: var(--dt-radius-pill);
		color: var(--dt-ink);
		font-size: var(--dt-text-small);
		text-decoration: none;
		transition: border-color var(--dt-dur-fast) var(--dt-ease);
	}
	.pill:hover,
	.pill:focus-visible {
		border-color: var(--dt-accent-text);
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--dt-space-7);
	}
	@media (min-width: 900px) {
		.grid {
			grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
		}
	}
	dl {
		display: grid;
		grid-template-columns: minmax(7.5em, auto) 1fr;
		gap: var(--dt-space-3) var(--dt-space-5);
		margin: 0;
	}
	dt {
		color: var(--dt-ink-3);
		font-size: var(--dt-text-small);
		padding-top: 2px;
	}
	dd {
		margin: 0;
		color: var(--dt-ink);
	}
	.note {
		display: block;
		color: var(--dt-ink-3);
		font-size: var(--dt-text-small);
	}
	p.note {
		margin-top: var(--dt-space-4);
	}
	.coords {
		font-variant-numeric: tabular-nums;
	}
	.place {
		font-family: var(--dt-font-serif);
		font-style: italic;
		font-size: 19px;
		color: var(--dt-place);
	}
	.none {
		color: var(--dt-ink-3);
		font-style: italic;
	}
	.plain {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	abbr {
		text-decoration: none;
	}
	.excerpt {
		max-width: 360px;
		margin: 0 auto var(--dt-space-4);
	}
	a {
		color: var(--dt-accent-text);
	}
	.ref {
		text-decoration: none;
		font-size: 0.75em;
		padding: 0 1px;
	}
	.ref:hover,
	.ref:focus-visible {
		text-decoration: underline;
	}
	.sources {
		margin-top: var(--dt-space-7);
		padding-top: var(--dt-space-5);
		border-top: 1px solid var(--dt-line);
		font-size: var(--dt-text-small);
	}
	.sources ol {
		margin: 0;
		padding-left: var(--dt-space-5);
	}
	.sources li + li {
		margin-top: var(--dt-space-2);
	}
	.sources li:target {
		outline: 2px solid var(--dt-accent-text);
		outline-offset: 4px;
		border-radius: var(--dt-radius-sm);
	}
	.sources .note {
		display: inline;
	}
	p.note:last-child {
		display: block;
	}
	code {
		font-size: 0.95em;
	}
</style>
