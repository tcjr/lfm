import addonVitest from '@storybook/addon-vitest';
import { definePreview, type EmberTypes } from 'ember-storybook';
import { createStorybookApp } from '#app/app-storybook.ts';
import type { EmberPreview } from '../types/ember-storybook.d.ts';

const preview: EmberPreview<EmberTypes> = definePreview({
  addons: [addonVitest()],
  globalTypes: {
    theme: {
      description: 'DaisyUI color theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'system', title: 'System' },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'system',
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    ember: {
      app: (options: Record<string, unknown> = {}) => createStorybookApp(options),
      updateGlobals: (globals: Record<string, unknown>) => {
        const theme = globals['theme'];
        if (theme === 'light' || theme === 'dark') {
          document.documentElement.dataset['theme'] = theme;
        } else {
          delete document.documentElement.dataset['theme'];
        }
      },
    },
  },
  tags: ['vitest'],
});

export default preview;
