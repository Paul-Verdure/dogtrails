/**
 * Optional Plausible analytics (docs/PLAN.md: "Plausible ou rien"), off unless PLAUSIBLE_DOMAIN is set
 * when the site is built (e.g. a Cloudflare Pages build variable). No cookies; nothing else is loaded.
 * Runs at prerender time only: every page is static, so the snippet is written into the HTML.
 * PLAUSIBLE_SRC overrides the script URL (a proxied or self-hosted script).
 */
import type { Handle } from '@sveltejs/kit';

const domain = process.env.PLAUSIBLE_DOMAIN?.trim();
const src = process.env.PLAUSIBLE_SRC?.trim() || 'https://plausible.io/js/script.js';
const escape = (s: string) => s.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
const snippet = domain ? `<script defer data-domain="${escape(domain)}" src="${escape(src)}"></script>` : '';

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, { transformPageChunk: ({ html }) => html.replace('<!-- analytics -->', snippet) });
