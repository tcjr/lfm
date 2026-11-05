/**
 * Looking for services that come from addons?
 *
 * App-tree merging from libraries is not supported.
 * See: https://github.com/embroider-build/embroider/issues/2659
 *
 * For services, look in to either of:
 * - https://github.com/chancancode/ember-polaris-service-
 * - https://ember-primitives.pages.dev/6-utils/createService.md
 *   - https://ember-primitives.pages.dev/6-utils/createAsyncService.md
 */
import Application from '@ember/application';
import EmberPageTitleService from 'ember-page-title/services/page-title';
import './app.css';

export default class App extends Application {
  modules = {
    './services/page-title': EmberPageTitleService,

    ...import.meta.glob('./router.*', { eager: true }),
    ...import.meta.glob('./routes/**/*', { eager: true }),
    ...import.meta.glob('./templates/**/*', { eager: true }),
    ...import.meta.glob('./services/**/*', { eager: true }),
  };
}
