import type { TOC } from '@ember/component/template-only';

// A lexical binding named like an HTML tag is invoked as a component.
const label: TOC<{ Args: { text: string } }> = <template>{{@text}}</template>;

<template>
  <label @text="checked as a component" />
  {{! @glint-expect-error: `text` must be a string }}
  <label @text={{1}} />
</template>
