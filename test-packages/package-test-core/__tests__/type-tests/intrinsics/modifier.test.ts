import Modifier from 'ember-modifier';
import { modifier } from 'ember-modifier';
import { hbs } from 'ember-cli-htmlbars';
import { typeTest } from '@glint/type-test';
import { ModifierLike } from '@glint/template';

class Render3DModelModifier extends Modifier<{
  Element: HTMLCanvasElement;
  Args: {
    Positional: [model: Array<[number, number, number]>];
    Named: { origin: { x: number; y: number } };
  };
}> {}

// Simple no-op binding
typeTest(
  { renderModel: Render3DModelModifier },
  hbs`
    {{#let (modifier this.renderModel) as |noopRender|}}
      <canvas {{noopRender (array) origin=(hash x=0 y=0)}}></canvas>

      {{! @glint-expect-error: wrong element type }}
      <div {{noopRender (array) origin=(hash x=0 y=0)}}></div>

      {{! @glint-expect-error: missing positional }}
      <canvas {{noopRender origin=(hash x=0 y=0)}}></canvas>

      {{! @glint-expect-error: extra named arg }}
      <canvas {{noopRender (array) origin=(hash x=0 y=0) extra="bad"}}></canvas>

      {{! @glint-expect-error: extra positional arg }}
      <canvas {{noopRender (array) "hello" origin=(hash x=0 y=0)}}></canvas>
    {{/let}}
  `,
);

// Pre-bound positional arg
typeTest(
  { renderModel: Render3DModelModifier },
  hbs`
    {{#let (modifier this.renderModel (array)) as |boundRender|}}
      <canvas {{boundRender origin=(hash x=0 y=0)}}></canvas>

      {{! @glint-expect-error: wrong element type }}
      <div {{boundRender origin=(hash x=0 y=0)}}></div>

      {{! @glint-expect-error: extra named arg }}
      <canvas {{boundRender origin=(hash x=0 y=0) extra="bad"}}></canvas>

      {{! @glint-expect-error: extra positional arg }}
      <canvas {{boundRender "hello" origin=(hash x=0 y=0)}}></canvas>
    {{/let}}
  `,
);

// Pre-bound named arg
typeTest(
  { renderModel: Render3DModelModifier },
  hbs`
    {{#let (modifier this.renderModel origin=(hash x=0 y=0)) as |boundRender|}}
    <canvas {{boundRender (array)}}></canvas>
    <canvas {{boundRender (array) origin=(hash x=1 y=-1)}}></canvas>

      {{! @glint-expect-error: wrong element type }}
      <div {{boundRender (array)}}></div>

      {{! @glint-expect-error: extra named arg }}
      <canvas {{boundRender (array) extra="bad"}}></canvas>

      {{! @glint-expect-error: extra positional arg }}
      <canvas {{boundRender (array) "hello"}}></canvas>
    {{/let}}
  `,
);

// Issue #886: Modifier with only optional args should work when bound with modifier keyword
// (Verified fixed - this test documents that it works correctly now)
typeTest(
  {
    optMod: undefined as unknown as ModifierLike<{
      Args: {
        Named: {
          value?: string;
        };
      };
    }>,
  },
  hbs`
    {{! Binding optional named arg should produce a usable modifier }}
    {{#let (modifier this.optMod value="anything") as |aModifier|}}
      <div {{aModifier}}></div>
    {{/let}}

    {{! No-op binding (no args pre-bound) should also work }}
    {{#let (modifier this.optMod) as |noopMod|}}
      <div {{noopMod}}></div>
      <div {{noopMod value="test"}}></div>
    {{/let}}
  `,
);

// Issue #719: A keyword-only modifier with optional args should type-check with modifier helper
// (Verified fixed - this test documents that it works correctly now)
typeTest(
  {
    scrollMod: undefined as unknown as ModifierLike<{
      Element: HTMLElement;
      Args: {
        Named: {
          block?: ScrollLogicalPosition;
        };
      };
    }>,
  },
  hbs`
    <div {{(if true (modifier this.scrollMod block="nearest"))}}></div>
  `,
);

// Issue #812: Conditional modifier with custom modifier (verified fixed)
typeTest(
  {
    custom: modifier(function () {}),
  },
  hbs`
    <button {{(if true (modifier this.custom))}}>test</button>
  `,
);

// Prebinding args at different locations
typeTest(
  {
    myriad: class MyriadPositionals extends Modifier<{
      Args: { Positional: [string, boolean, number] };
    }> {},
  },
  hbs`
    <div {{this.myriad "one" true 3}}></div>
    
    <div {{(modifier this.myriad "one" true 3)}}></div>
    <div {{(modifier this.myriad "one" true) 3}}></div>
    <div {{(modifier this.myriad "one") true 3}}></div>
    <div {{(modifier this.myriad) "one" true 3}}></div>

    {{! @glint-expect-error: missing arg }}
    <div {{(modifier this.myriad "one" true)}}></div>

    {{! @glint-expect-error: extra arg }}
    <div {{(modifier this.myriad "one" true 3) "four"}}></div>
  `,
);
