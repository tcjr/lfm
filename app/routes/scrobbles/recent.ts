import Route from '@ember/routing/route';
import type { ScrobbleRecord, ScrobbleSnapshot } from '#shared/types.ts';
import { daysAgo, filterScrobblesByDateRange } from '#utils/filter-scrobbles.ts';

export default class ScrobblesRecentRoute extends Route {
  model(): ScrobbleRecord[] {
    const snapshot = this.modelFor('scrobbles') as ScrobbleSnapshot;

    return filterScrobblesByDateRange(snapshot.scrobbles, daysAgo(30), daysAgo(0));
  }
}
