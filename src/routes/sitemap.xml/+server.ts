/** /sitemap.xml, prerendered from the routes and breeds.json (listed in static/robots.txt). */
import { breeds } from '$lib/data';
import { SITE_URL } from '$lib/site';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = () => {
	const paths = ['/', '/explore', '/sources', ...breeds.map((b) => `/breed/${b.id}`)];
	const body =
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
		paths.map((p) => `  <url><loc>${SITE_URL}${p === '/' ? '/' : p}</loc></url>`).join('\n') +
		'\n</urlset>\n';
	return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
