import type { TOC } from '@ember/component/template-only';
import type { EmberRenderer } from 'ember-storybook';
import type { Meta, Preview } from 'storybook/internal/csf';
import type { Args, ArgsStoryFn, ComponentAnnotations } from 'storybook/internal/types';

type EmberComponent<TArgs extends Args> =
  TOC<{ Args: TArgs }> | (abstract new (...args: never[]) => { args: Readonly<TArgs> });

type Simplify<T> = { [K in keyof T]: T[K] };

export interface EmberPreview<TRenderer extends EmberRenderer = EmberRenderer> extends Omit<
  Preview<TRenderer>,
  'meta' | 'type'
> {
  type<R>(): EmberPreview<TRenderer & R>;
  meta<TArgs extends Args, TMetaArgs extends Partial<TArgs> = Record<never, never>>(
    input: ComponentAnnotations<TRenderer & { args: TArgs }, TArgs> & {
      component: EmberComponent<TArgs>;
      render?: ArgsStoryFn<TRenderer & { args: TArgs }, TArgs>;
      args?: TMetaArgs;
    },
  ): Meta<
    TRenderer & {
      args: Simplify<TArgs & Omit<TMetaArgs, keyof TArgs>>;
    },
    ComponentAnnotations<TRenderer & { args: TArgs }, TArgs> & { args: TMetaArgs }
  >;
}
