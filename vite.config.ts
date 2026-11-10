import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// 404.html: Cloudflare Pages serves it for any unknown path (without it, Pages would answer
			// every unknown path with index.html, as for a single-page app)
			adapter: adapter({ fallback: '404.html' }),
			// a missing page, a broken internal link or anchor, or an entries() mismatch fails the build
			prerender: {
				handleHttpError: 'fail',
				handleMissingId: 'fail',
				handleEntryGeneratorMismatch: 'fail',
				handleUnseenRoutes: 'fail'
			}
		})
	]
});
