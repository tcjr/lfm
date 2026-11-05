import { defineConfig } from 'vite';
import { ember } from '@nullvoxpopuli/ember-vite';
import { emberSsg } from 'vite-ember-ssr/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      // Without this, we get a build-time warning on every build because the
      // `@tailwindcss/vite:generate:build` plugin returns `map: undefined`, while
      // `vite:css` and `vite:css-post` return `map: { mappings: "" }`.
      // When Rolldown sees `undefined`, it reports a warning.
      checks: {
        sourcemapBroken: false,
      },
    },
  },
  plugins: [
    ember(),
    emberSsg({
      // specify all paths to render during build
      routes: [
        'index', // special name for the root
        'scrobbles',
        'scrobbles/recent',
      ],
      ssrEntry: 'app/app-ssr',
      // shoebox: true,
    }),
    tailwindcss(),
  ],
});
