import type ApplicationInstance from '@ember/application/instance';
import App from '#app/app.ts';
import config from '#config';

/**
 * Entrypoint used by Storybook (`ember-storybook`) to build an isolated
 * Ember application instance for each canvas.
 */
export function createStorybookApp(options: Record<string, unknown> = {}): ApplicationInstance {
  const app = App.create({ ...config.APP, ...options, autoboot: false });

  return app.buildInstance();
}
