import Route from '@ember/routing/route';
import type { ScrobbleSnapshot } from '#shared/types.ts';

export default class ScrobblesIndexRoute extends Route {
  model(): ScrobbleSnapshot {
    return this.modelFor('scrobbles') as ScrobbleSnapshot;
  }
}
