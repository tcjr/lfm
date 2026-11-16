import type { TOC } from '@ember/component/template-only';
import { ReactiveImage } from 'reactiveweb/image';
import type { ScrobbleRecord } from '#shared/types.ts';

export interface ScrobbleArtworkSignature {
  Element: HTMLSpanElement;
  Args: {
    scrobble: ScrobbleRecord;
  };
}

function formatFallbackText(scrobble: ScrobbleRecord): string {
  return (scrobble.album || scrobble.artist || '??').slice(0, 2);
}

function formatAltText(scrobble: ScrobbleRecord): string {
  return scrobble.album || 'Unknown Album';
}

const BASE_CLASSES =
  'flex items-center justify-center overflow-hidden bg-base-300 text-base-content/50 font-bold tracking-wider uppercase';

const ScrobbleArtwork: TOC<ScrobbleArtworkSignature> = <template>
  {{#if @scrobble.imageUrl}}
    {{#let (ReactiveImage @scrobble.imageUrl) as |imgState|}}
      <span
        class={{BASE_CLASSES}}
        data-loading={{imgState.isLoading}}
        data-error={{imgState.isError}}
        ...attributes
      >
        {{#if imgState.isResolved}}
          <img
            src={{@scrobble.imageUrl}}
            alt={{formatAltText @scrobble}}
            class="w-full h-full object-cover"
          />
        {{else}}
          <span>{{formatFallbackText @scrobble}}</span>
        {{/if}}
      </span>
    {{/let}}
  {{else}}
    <span class={{BASE_CLASSES}} data-loading={{false}} data-error={{false}} ...attributes>
      <span>{{formatFallbackText @scrobble}}</span>
    </span>
  {{/if}}
</template>;

export default ScrobbleArtwork;
