import type { TOC } from '@ember/component/template-only';
import type { ScrobbleRecord } from '#shared/types.ts';
import { Avatar } from 'ember-primitives';

export type ScrobbleGridDisplayMode = 'always' | 'hover' | 'none';
export type ScrobbleGridOverlay = ScrobbleGridDisplayMode;

export interface ScrobblesGridSignature {
  Args: {
    scrobbles: ScrobbleRecord[];
    overlay?: ScrobbleGridDisplayMode;
    lovedIndicator?: ScrobbleGridDisplayMode;
  };
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatUts(uts: number): string {
  return dateFormatter.format(new Date(uts * 1000));
}

function formatFallbackText(scrobble: ScrobbleRecord): string {
  return (scrobble.album || scrobble.artist || '??').slice(0, 2);
}

function resolveDisplayMode(mode: ScrobbleGridDisplayMode = 'always'): ScrobbleGridDisplayMode {
  return mode;
}

<template>
  {{#let
    (resolveDisplayMode @overlay)
    (resolveDisplayMode @lovedIndicator)
    as |overlayMode lovedMode|
  }}
    <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
      {{#each @scrobbles as |scrobble|}}
        <article
          tabindex="0"
          class="group relative aspect-square rounded-xl overflow-hidden bg-base-200 shadow-sm ring-1 ring-base-content/10 transition-shadow duration-200 hover:shadow-md hover:ring-base-content/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Avatar
            @src="{{scrobble.imageUrl}}"
            class="w-full h-full flex items-center justify-center overflow-hidden bg-base-300 text-base-content/50 text-3xl font-bold tracking-wider uppercase"
            as |a|
          >
            <a.Image
              alt={{scrobble.album}}
              class="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 group-focus-visible:scale-105"
            />
            <a.Fallback>
              <span
                class={{if
                  (eq overlayMode "always")
                  "pb-8"
                  (if
                    (eq overlayMode "hover")
                    "transition-transform duration-200 group-hover:-translate-y-6 group-focus-visible:-translate-y-6"
                    ""
                  )
                }}
              >
                {{formatFallbackText scrobble}}
              </span>
            </a.Fallback>
          </Avatar>

          {{#if (and scrobble.loved (not (eq lovedMode "none")))}}
            <span
              class="badge badge-sm absolute top-2.5 right-2.5 border-0 bg-black/55 px-1.5 text-red-400 backdrop-blur-xs {{if
                (eq lovedMode 'hover')
                '-translate-y-2 opacity-0 transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100'
              }}"
              aria-label="Loved track"
              title="Loved track"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="size-3.5"
                aria-hidden="true"
              >
                <path
                  d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.162-.682 22.045 22.045 0 0 1-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 0 1 8-2.828A4.5 4.5 0 0 1 18 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 0 1-3.744 2.582l-.019.01-.005.003h-.002a.739.739 0 0 1-.69.001l-.002-.001Z"
                />
              </svg>
            </span>
          {{/if}}

          {{#if (eq overlayMode "always")}}
            <div
              class="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end bg-linear-to-t from-black/85 via-black/50 to-transparent p-3 pt-12 text-white transition-colors duration-200 group-hover:from-black/95 group-hover:via-black/70 group-focus-visible:from-black/95 group-focus-visible:via-black/70"
            >
              <p class="truncate text-sm font-semibold leading-tight drop-shadow-xs">
                {{scrobble.track}}
              </p>
              <p class="mt-0.5 truncate text-xs text-white/80 leading-tight">
                {{scrobble.artist}}
              </p>

              <div
                class="grid grid-rows-[0fr] opacity-0 transition-all duration-200 ease-out group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-visible:grid-rows-[1fr] group-focus-visible:opacity-100"
              >
                <div class="overflow-hidden">
                  <div
                    class="mt-1.5 border-t border-white/15 pt-1.5 text-[11px] leading-tight text-white/70"
                  >
                    {{#if scrobble.album}}
                      <p class="truncate italic text-white/80">{{scrobble.album}}</p>
                    {{/if}}
                    <p class="mt-0.5 truncate text-white/65">{{formatUts scrobble.uts}}</p>
                  </div>
                </div>
              </div>
            </div>
          {{else if (eq overlayMode "hover")}}
            <div
              class="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-2 flex-col justify-end bg-linear-to-t from-black/95 via-black/70 to-transparent p-3 pt-12 text-white opacity-0 transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
            >
              <p class="truncate text-sm font-semibold leading-tight drop-shadow-xs">
                {{scrobble.track}}
              </p>
              <p class="mt-0.5 truncate text-xs text-white/80 leading-tight">
                {{scrobble.artist}}
              </p>
              <div
                class="mt-1.5 border-t border-white/15 pt-1.5 text-[11px] leading-tight text-white/70"
              >
                {{#if scrobble.album}}
                  <p class="truncate italic text-white/80">{{scrobble.album}}</p>
                {{/if}}
                <p class="mt-0.5 truncate text-white/65">{{formatUts scrobble.uts}}</p>
              </div>
            </div>
          {{/if}}
        </article>
      {{/each}}
    </div>
  {{/let}}
</template> satisfies TOC<ScrobblesGridSignature>;
