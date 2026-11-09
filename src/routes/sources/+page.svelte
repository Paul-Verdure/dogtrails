<!-- Sources and credits, all generated from the data files at build time (see +page.server.ts). -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Sources · Dogtrails</title>
	<meta name="description" content="Every dataset behind Dogtrails, with its licence, version and access date, and the sources of each breed." />
</svelte:head>

<div class="page">
	<header>
		<p class="eyebrow">Sources</p>
		<h1>Where every fact comes from</h1>
		<p class="lede">
			This page is generated when the site is built, from the source blocks written into each data file. Nothing on
			Dogtrails is shown without a source.
		</p>
	</header>

	<section aria-labelledby="datasets">
		<h2 id="datasets">Datasets</h2>
		<div class="cards">
			{#each data.datasets as d (d.id)}
				<article class="card" aria-labelledby="ds-{d.id}">
					<h3 id="ds-{d.id}">{d.title}</h3>
					<p class="gives">{d.gives}</p>
					<p><a href={d.url} rel="external noopener">{d.citation}</a></p>
					<dl>
						<dt>Licence</dt>
						<dd>{#if d.licence}{d.licence}{:else}<span class="none">Not recorded in the data</span>{/if}</dd>
						<dt>Version</dt>
						<dd>{#if d.version}<span class="num">{d.version}</span>{:else}<span class="none">Not recorded</span>{/if}</dd>
						<dt>Accessed</dt>
						<dd>
							{#if d.accessed.length}<span class="num">{d.accessed.join(', ')}</span>{:else}<span class="none"
									>Not recorded</span
								>{/if}
						</dd>
						<dt>Files</dt>
						<dd>
							<ul class="plain">
								{#each d.files as f (f)}<li><code>{f}</code></li>{/each}
							</ul>
						</dd>
					</dl>
					{#if d.notes.length}
						<ul class="notes">
							{#each d.notes as n (n)}<li>{n}</li>{/each}
						</ul>
					{/if}
				</article>
			{/each}
		</div>
	</section>

	<section aria-labelledby="generated">
		<h2 id="generated">Generated files</h2>
		<div class="cards">
			{#each data.generated as g (g.file)}
				<article class="card">
					<h3><code>{g.file}</code></h3>
					<p class="gives">{g.description}</p>
					<dl>
						<dt>Script</dt>
						<dd><code>{g.generatedBy}</code></dd>
						{#if g.generatedAt}
							<dt>Generated</dt>
							<dd class="num">{g.generatedAt}</dd>
						{/if}
						<dt>Inputs</dt>
						<dd>
							<ul class="plain">
								{#each g.inputs as i (i)}<li><code>{i}</code></li>{/each}
							</ul>
						</dd>
					</dl>
					{#if g.notes.length}
						<ul class="notes">
							{#each g.notes as n (n)}<li>{n}</li>{/each}
						</ul>
					{/if}
				</article>
			{/each}
		</div>
	</section>

	<section aria-labelledby="manual">
		<h2 id="manual">Hand-reviewed tables</h2>
		<p class="intro">Where sources disagree or names differ, a person decides. These tables record each decision and its basis.</p>
		<div class="cards">
			{#each data.manual as m (m.file)}
				<article class="card">
					<h3><code>{m.file}</code></h3>
					<p class="gives">{m.about}</p>
					<p class="num">{m.reviewed} of {m.entries} entries reviewed</p>
					{#if m.sources.length}
						<ul class="notes">
							{#each m.sources as s (s.id)}<li><a href={s.url} rel="external noopener">{s.citation}</a></li>{/each}
						</ul>
					{/if}
				</article>
			{/each}
		</div>
	</section>

	<section aria-labelledby="editorial">
		<h2 id="editorial">Editorial choices</h2>
		<ul class="list">
			{#each data.editorial as e (e.id)}
				<li>{e.citation} (<code>{e.path}</code>, {e.retrieved})</li>
			{/each}
		</ul>
	</section>

	<section aria-labelledby="by-breed">
		<h2 id="by-breed">Sources by breed</h2>
		<ul class="breeds">
			{#each data.breeds as b (b.id)}
				<li>
					<details>
						<summary>
							<span class="name">{b.name}</span>
							<span class="count">{b.sources.length} sources</span>
						</summary>
						<p><a href={resolve('/breed/[id]', { id: b.id })}>Open the {b.name} page</a></p>
						<ol>
							{#each b.sources as s (s.id)}
								<li>
									{#if s.url}<a href={s.url} rel="external noopener">{s.citation}</a>{:else}{s.citation} (<code
											>{s.path}</code
										>){/if}
									<span class="none">read {s.retrieved}</span>
								</li>
							{/each}
						</ol>
					</details>
				</li>
			{/each}
		</ul>
	</section>

	<section aria-labelledby="photos">
		<h2 id="photos">Photos</h2>
		<p class="intro">
			Every photo comes from Wikimedia Commons under a free licence. The credit below is generated from each file's
			metadata, or read by hand from its file page when the metadata is not a usable credit (marked *). Photos
			are Wikimedia thumbnails, copied unmodified and served by this site.
		</p>
		<ul class="list photos">
			{#each data.photos as p (p.breedId)}
				<li>
					<a href={resolve('/breed/[id]', { id: p.breedId })}>{p.name}</a>:
					<a href={p.filePage} rel="external noopener">{p.file}</a> by {p.author}{p.authorFrom === 'commons-extmetadata' ? '' : ' *'},
					{#if p.licence.url}<a href={p.licence.url} rel="external noopener license">{p.licence.name}</a
						>{:else}{p.licence.name}{/if}
					<span class="none">read {p.retrieved}</span>
				</li>
			{/each}
		</ul>
		{#if data.withoutPhoto.length}
			<p class="intro">
				No photo yet, because no free file with a named author was found:
				{#each data.withoutPhoto as b, i (b.id)}{i > 0 ? ', ' : ''}<a href={resolve('/breed/[id]', { id: b.id })}
						>{b.name}</a
					>{/each}.
			</p>
		{/if}
	</section>

	<section aria-labelledby="type">
		<h2 id="type">Typefaces</h2>
		<ul class="list">
			{#each data.fonts as f (f.name)}
				<li><code>{f.name}@{f.version}</code>, licence {f.license}, self-hosted</li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.page {
		max-width: 1120px;
		margin: 0 auto;
		padding: var(--dt-space-6) var(--dt-gutter-mobile) var(--dt-space-8);
	}
	header {
		max-width: 64ch;
		margin-bottom: var(--dt-space-7);
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
	.lede {
		margin: 0;
		font-size: var(--dt-text-lede);
	}
	section {
		margin-top: var(--dt-space-7);
	}
	h2 {
		margin: 0 0 var(--dt-space-4);
		font-family: var(--dt-font-serif);
		font-weight: 400;
		font-size: var(--dt-text-h3);
		color: var(--dt-ink);
	}
	.intro {
		max-width: 64ch;
		margin: 0 0 var(--dt-space-4);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
		gap: var(--dt-space-4);
	}
	.card {
		background: var(--dt-surface-raised);
		border: 1px solid var(--dt-line);
		border-radius: var(--dt-radius-md);
		padding: var(--dt-space-5);
		font-size: var(--dt-text-small);
		overflow-wrap: anywhere;
	}
	.card h3 {
		margin: 0 0 var(--dt-space-2);
		font-size: var(--dt-text-body);
		font-weight: 600;
		color: var(--dt-ink);
	}
	.card p {
		margin: 0 0 var(--dt-space-3);
	}
	.gives {
		color: var(--dt-ink-2);
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--dt-space-1) var(--dt-space-4);
		margin: 0;
	}
	dt {
		color: var(--dt-ink-3);
	}
	dd {
		margin: 0;
		color: var(--dt-ink);
	}
	.num {
		font-variant-numeric: tabular-nums;
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
	.notes {
		margin: var(--dt-space-3) 0 0;
		padding-left: var(--dt-space-4);
		color: var(--dt-ink-3);
	}
	.list {
		max-width: 80ch;
		padding-left: var(--dt-space-5);
	}
	.photos {
		overflow-wrap: anywhere;
		font-size: var(--dt-text-small);
	}
	.photos li + li {
		margin-top: var(--dt-space-2);
	}
	.breeds {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
		gap: 0 var(--dt-space-5);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.breeds > li {
		border-bottom: 1px solid var(--dt-line);
	}
	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--dt-space-3);
		min-height: var(--dt-hit);
		cursor: pointer;
	}
	summary:focus-visible {
		outline: 2px solid var(--dt-accent-text);
		outline-offset: 2px;
	}
	summary .name {
		color: var(--dt-ink);
	}
	summary .count {
		color: var(--dt-ink-3);
		font-size: var(--dt-text-small);
	}
	details p {
		margin: 0;
	}
	details p a {
		display: inline-flex;
		align-items: center;
		min-height: var(--dt-hit);
	}
	details ol {
		margin: 0 0 var(--dt-space-4);
		padding-left: var(--dt-space-5);
		font-size: var(--dt-text-small);
		overflow-wrap: anywhere;
	}
	details ol li + li {
		margin-top: var(--dt-space-1);
	}
	a {
		color: var(--dt-accent-text);
	}
	code {
		font-size: 0.92em;
	}
</style>
