import { defineConfig } from 'vite';
import { ember } from '@nullvoxpopuli/ember-vite';
import { emberSsg } from 'vite-ember-ssr/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    ember(),
    emberSsg({
      // specify all paths to render during build
      routes: [
        'index', // special name
        'scrobbles',
        'scrobbles/recent',
      ],
      ssrEntry: 'app/app-ssr',
      // shoebox: true,
    }),
    tailwindcss(),
  ],
});
