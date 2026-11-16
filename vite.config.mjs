import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { ember } from '@nullvoxpopuli/ember-vite';
import { emberSsg } from 'vite-ember-ssr/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

const dirname = path.dirname(fileURLToPath(import.meta.url));

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

    // // This works around a bug in embroider.
    // {
    //   name: 'workaround-embroider-resolver-serve-build-end',
    //   configResolved(config) {
    //     if (config.command === 'serve') {
    //       const resolverPlugin = config.plugins.find((p) => p.name === 'embroider-resolver');
    //       if (resolverPlugin) {
    //         delete resolverPlugin.buildEnd;
    //       }
    //     }
    //   },
    // },

    ...(!process.env['VITEST']
      ? [
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
        ]
      : []),
    tailwindcss(),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['{app,cli,shared}/**/*.{test,spec}.{js,ts,gjs,gts}'],
          browser: {
            enabled: true,
            provider: playwright({}),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        extends: true,
        optimizeDeps: {
          include: ['vite-ember-ssr/client'],
        },
        plugins: [
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
            storybookScript: 'pnpm storybook --no-open',
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            provider: playwright({}),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
