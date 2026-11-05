import Route from '@ember/routing/route';
import type { ScrobbleSnapshot } from '#shared/types.ts';

export default class ScrobblesRoute extends Route {
  async model(): Promise<ScrobbleSnapshot> {
    const response = await fetch('/data/scrobbles.json');
    if (!response.ok) {
      return {
        user: '',
        exportedAt: '',
        count: 0,
        scrobbles: [],
      };
    }

    return (await response.json()) as ScrobbleSnapshot;
  }
}
