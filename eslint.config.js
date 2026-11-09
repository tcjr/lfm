/**
 * This tries to follow what the official blueprints are doing more closely
 * but in a way that abstracts the dependencies and configuration
 * out of your project.
 *
 * Handles: (G)TS + (G)JS, QUnit, Supporting Node files
 */
import { ember } from 'ember-eslint';
import templateLintMigration from 'eslint-plugin-ember/configs/template-lint-migration';

export default [
  { ignores: ['storybook-static/'] },
  ...ember.recommended(import.meta.dirname),
  ...templateLintMigration,
];
