import { defineMain } from 'ember-storybook/node';

export default defineMain({
  stories: ['../app/**/*.stories.g(j|t)s'],

  addons: ['@storybook/addon-vitest'],

  framework: 'ember-storybook',

  core: {
    disableWhatsNewNotifications: true,
  },

  viteFinal(config) {
    // Strip `vite-ember-ssg` so Storybook builds do not run the post-build
    // route prerendering hook from `vite.config.mjs`.
    config.plugins = config.plugins?.filter(
      (plugin) =>
        !(
          plugin &&
          typeof plugin === 'object' &&
          'name' in plugin &&
          plugin.name === 'vite-ember-ssg'
        ),
    );

    return config;
  },
});
