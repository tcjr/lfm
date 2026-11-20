import type { TOC } from '@ember/component/template-only';
import { ReactiveImage } from 'reactiveweb/image';
import type { ScrobbleRecord } from '#shared/types.ts';
import {
  type ArtworkFallbackPalette,
  formatFallbackInitials,
  getArtworkFallbackPalette,
} from '#utils/artwork-fallback.ts';

export interface ScrobbleArtworkSignature {
  Element: HTMLSpanElement;
  Args: {
    scrobble: ScrobbleRecord;
  };
}

interface FallbackArtworkSignature {
  Args: {
    initials: string;
    palette: ArtworkFallbackPalette;
  };
}

function formatAltText(scrobble: ScrobbleRecord): string {
  return scrobble.album || 'Unknown Album';
}

const IMAGE_BASE_CLASSES = 'relative flex items-center justify-center overflow-hidden bg-base-300';

const FALLBACK_BASE_CLASSES =
  'relative flex items-center justify-center overflow-hidden select-none ring-1 ring-inset ring-white/10 before:pointer-events-none before:absolute before:inset-0 before:bg-linear-to-tr before:from-black/20 before:via-transparent before:to-white/15';

function fallbackContainerClasses(palette: ArtworkFallbackPalette): string {
  return `${FALLBACK_BASE_CLASSES} ${palette.background}`;
}

const FallbackArtwork: TOC<FallbackArtworkSignature> = <template>
  <span
    data-artwork-fallback-content
    class="relative @container flex size-full items-center justify-center"
  >
    <span class="relative flex aspect-square h-[84%] max-w-[84%] items-center justify-center">
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        class="pointer-events-none size-full drop-shadow-sm"
      >
        {{! Vinyl disc body }}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="rgb(0 0 0 / 0.34)"
          stroke="rgb(255 255 255 / 0.22)"
          stroke-width="1"
        />

        {{! Opposing specular sheen wedges across the vinyl grooves }}
        <path
          d="M 8.3 30.6 A 46 46 0 0 1 30.6 8.3 L 38.2 24.6 A 28 28 0 0 0 24.6 38.2 Z"
          fill="rgb(255 255 255 / 0.11)"
        />
        <path
          d="M 91.7 69.4 A 46 46 0 0 1 69.4 91.7 L 61.8 75.4 A 28 28 0 0 0 75.4 61.8 Z"
          fill="rgb(255 255 255 / 0.11)"
        />

        {{! Concentric micro-grooves }}
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="rgb(255 255 255 / 0.12)"
          stroke-width="0.75"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="rgb(255 255 255 / 0.08)"
          stroke-width="0.75"
        />
        <circle
          cx="50"
          cy="50"
          r="36"
          fill="none"
          stroke="rgb(255 255 255 / 0.12)"
          stroke-width="0.75"
        />
        <circle
          cx="50"
          cy="50"
          r="32"
          fill="none"
          stroke="rgb(255 255 255 / 0.09)"
          stroke-width="0.75"
        />

        {{! Center record label }}
        <circle
          cx="50"
          cy="50"
          r="28"
          class={{@palette.labelFill}}
          stroke="rgb(255 255 255 / 0.36)"
          stroke-width="1"
        />
        <circle
          cx="50"
          cy="50"
          r="24.5"
          fill="none"
          stroke="rgb(255 255 255 / 0.16)"
          stroke-width="0.6"
        />
        <line
          x1="43"
          y1="31"
          x2="57"
          y2="31"
          stroke="rgb(255 255 255 / 0.28)"
          stroke-width="0.9"
          stroke-linecap="round"
        />
        <line
          x1="45"
          y1="69"
          x2="55"
          y2="69"
          stroke="rgb(255 255 255 / 0.22)"
          stroke-width="0.9"
          stroke-linecap="round"
        />
      </svg>

      <strong
        data-artwork-fallback-initials
        class="pointer-events-none absolute inset-0 flex items-center justify-center text-[clamp(0.6875rem,19cqi,1.875rem)] leading-none font-bold tracking-wider text-white uppercase drop-shadow-xs"
      >
        {{@initials}}
      </strong>
    </span>
  </span>
</template>;

const ScrobbleArtwork: TOC<ScrobbleArtworkSignature> = <template>
  {{#let
    (getArtworkFallbackPalette @scrobble) (formatFallbackInitials @scrobble)
    as |palette initials|
  }}
    {{#if @scrobble.imageUrl}}
      {{#let (ReactiveImage @scrobble.imageUrl) as |imgState|}}
        <span
          class={{if imgState.isResolved IMAGE_BASE_CLASSES (fallbackContainerClasses palette)}}
          data-loading={{imgState.isLoading}}
          data-error={{imgState.isError}}
          data-fallback-palette={{unless imgState.isResolved palette.id}}
          ...attributes
        >
          {{#if imgState.isResolved}}
            <img
              src={{@scrobble.imageUrl}}
              alt={{formatAltText @scrobble}}
              class="w-full h-full object-cover"
            />
          {{else}}
            <FallbackArtwork @initials={{initials}} @palette={{palette}} />
          {{/if}}
        </span>
      {{/let}}
    {{else}}
      <span
        class={{fallbackContainerClasses palette}}
        data-loading={{false}}
        data-error={{false}}
        data-fallback-palette={{palette.id}}
        ...attributes
      >
        <FallbackArtwork @initials={{initials}} @palette={{palette}} />
      </span>
    {{/if}}
  {{/let}}
</template>;

export default ScrobbleArtwork;
