import type { TOC } from '@ember/component/template-only';
import type { ScrobbleRecord } from '#shared/types.ts';
import { Avatar } from 'ember-primitives';

export interface ScrobblesGridSignature {
  Args: {
    scrobbles: ScrobbleRecord[];
  };
}

function formatFallbackText(scrobble: ScrobbleRecord): string {
  return (scrobble.album || scrobble.artist || '??').slice(0, 2);
}

<template>
  <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
    {{#each @scrobbles as |scrobble|}}
      <article
        class="relative aspect-square rounded-xl overflow-hidden bg-base-200 shadow-sm ring-1 ring-base-content/10"
      >
        <Avatar
          @src="{{scrobble.imageUrl}}"
          class="w-full h-full flex items-center justify-center overflow-hidden bg-base-300 text-base-content/60 text-2xl font-semibold"
          as |a|
        >
          <a.Image alt={{scrobble.album}} class="w-full h-full object-cover" />
          <a.Fallback>
            {{formatFallbackText scrobble}}
          </a.Fallback>
        </Avatar>
      </article>
    {{/each}}
  </div>
</template> satisfies TOC<ScrobblesGridSignature>;
