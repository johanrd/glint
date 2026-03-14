import Component from '@ember/component';
import GlimmerComponent from '@glimmer/component';
import { hbs } from 'ember-cli-htmlbars';
import { typeTest } from '@glint/type-test';
import { WithBoundArgs, ModifierLike } from '@glint/template';
import {
  emitComponent,
  NamedArgsMarker,
  resolve,
  resolveForBind,
  templateForBackingValue,
  yieldToBlock,
} from '@glint/ember-tsc/-private/dsl';

// String-based lookups
typeTest(
  {},
  hbs`
    {{#let (component 'input') as |BoundInput|}}
      <BoundInput @value="hello" />

      {{! @glint-expect-error: wrong arg type}}
      <BoundInput @value={{array 1 2 3}} />
    {{/let}}
  `,
);

// String-based lookups of special builtins
typeTest(
  {},
  hbs`
    {{#let (component 'link-to' route="widgets") as |Link|}}
      <Link @models={{array 123}} />
    {{/let}}
  `,
);

declare const formModifier: ModifierLike<{
  Element: HTMLFormElement;
}>;

class StringComponent extends Component<{
  Element: HTMLFormElement;
  Args: { value: string };
  Blocks: { default: [string] };
}> {}

// Simple no-op binding
typeTest(
  { StringComponent, formModifier },
  hbs`
    {{#let (component this.StringComponent) as |NoopCurriedStringComponent|}}
      <NoopCurriedStringComponent @value="hi" {{this.formModifier}} />

      {{! @glint-expect-error: missing required arg }}
      <NoopCurriedStringComponent />

      <NoopCurriedStringComponent @value="ok" {{this.formModifier}} as |value|>
        {{@expectTypeOf value @to.beString}}
      </NoopCurriedStringComponent>
    {{/let}}
  `,
);

// Nullable in, nullable out
typeTest(
  { StringComponent: StringComponent as typeof StringComponent | null },
  hbs`
    {{#let (component this.StringComponent) as |NoopCurriedStringComponent|}}
      <NoopCurriedStringComponent @value="hi" />

      {{@expectTypeOf null @to.beAssignableToTypeOf NoopCurriedStringComponent}}
    {{/let}}
  `,
);

// Currying a named arg makes it optional but still override-able
typeTest(
  {
    StringComponent,
    formModifier,
    expectedType: {} as WithBoundArgs<typeof StringComponent, 'value'>,
  },
  hbs`
    {{#let (component this.StringComponent value="hello") as |BoundStringComponent|}}
      <BoundStringComponent />
      <BoundStringComponent @value="overridden" />

      {{@expectTypeOf BoundStringComponent @to.equalTypeOf this.expectedType}}

      <BoundStringComponent {{this.formModifier}} as |value|>
        {{@expectTypeOf value @to.beString}}
      </BoundStringComponent>
    {{/let}}
  `,
);

class ParametricComponent<T> extends Component<{
  Element: HTMLFormElement;
  Args: { values: Array<T>; optional?: string };
  Blocks: { default: [T, number] };
}> {}

// Simple no-op binding
typeTest(
  { ParametricComponent, formModifier },
  hbs`
    {{#let (component this.ParametricComponent) as |NoopCurriedParametricComponent|}}
      <NoopCurriedParametricComponent @values={{array "hi"}} {{this.formModifier}} />

      {{! @glint-expect-error: missing required arg }}
      <NoopCurriedParametricComponent />

      <NoopCurriedParametricComponent
        @values={{array}}
        {{! @glint-expect-error: extra arg }}
        @extra={{true}}
      />

      <NoopCurriedParametricComponent @values={{array "ok"}} {{this.formModifier}} as |value index|>
        {{@expectTypeOf value @to.beString}}
        {{@expectTypeOf index @to.beNumber}}
      </NoopCurriedParametricComponent>

      <NoopCurriedParametricComponent @values={{array true}} {{this.formModifier}} as |value index|>
        {{@expectTypeOf value @to.beBoolean}}
        {{@expectTypeOf index @to.beNumber}}
      </NoopCurriedParametricComponent>
    {{/let}}
  `,
);

// Binding a required arg makes it optional
typeTest(
  { ParametricComponent, formModifier },
  hbs`
    {{#let (component this.ParametricComponent values=(array "hi")) as |RequiredValueCurriedParametricComponent|}}
      <RequiredValueCurriedParametricComponent @values={{array "hi"}} {{this.formModifier}} />

      <RequiredValueCurriedParametricComponent />

      {{! @glint-expect-error: wrong type for what we pre-bound above }}
      <RequiredValueCurriedParametricComponent @values={{array 1 2 3}} />

      <RequiredValueCurriedParametricComponent
        {{! @glint-expect-error: extra arg }}
        @extra={{true}}
      />

      <RequiredValueCurriedParametricComponent {{this.formModifier}} as |value index|>
        {{@expectTypeOf value @to.beString}}
        {{@expectTypeOf index @to.beNumber}}
      </RequiredValueCurriedParametricComponent>
    {{/let}}
  `,
);

// Issue #1068: {{component}} with named args on generic class component
// When the curried arg references a generic type parameter T from the parent,
// resolveForBind erases T (via Parameters<>/ReturnType<>) causing TS2589.
//
// Root cause: resolveForBind uses Parameters<Instance[typeof Invoke]> which
// collapses T to unknown. The IIFE wrapper compounds this by isolating inference.
// A fix requires class-accepting overloads in BindInvokableKeyword that can
// preserve T through the pre-binding process.
{
  class PickerOption1068<T> extends GlimmerComponent<{
    Args: { value: T; onSelect: (value: T) => void };
    Blocks: { default: [T] };
  }> {}

  class Picker1068<T> extends GlimmerComponent<{
    Args: { onSelect: (value: T) => void };
    Blocks: { default: [WithBoundArgs<typeof PickerOption1068, 'onSelect'>] };
  }> {
    static {
      templateForBackingValue(this, function (__glintRef__) {
        const componentKw =
          undefined as unknown as import('@glint/template/-private/keywords/component').ComponentKeyword;

        // This mirrors {{yield (component PickerOption onSelect=@onSelect)}}
        // where @onSelect is (value: T) => void.
        // BUG: T is erased to unknown, making the result unassignable to
        // WithBoundArgs<typeof PickerOption1068, 'onSelect'>.
        const curried = resolve(componentKw)((() => resolveForBind(PickerOption1068))(), {
          onSelect: __glintRef__.args.onSelect,
          ...NamedArgsMarker,
        });
        // @ts-expect-error TS2589: T erased to unknown due to resolveForBind
        yieldToBlock(__glintRef__, 'default')(curried);
      });
    }
  }

  emitComponent(resolve(Picker1068)({ onSelect: (v: string) => {}, ...NamedArgsMarker }));
}

// Issue #661: WithBoundArgs with ModifierLike arg should not cause TS2589
// (Verified fixed - currying named args including ModifierLike works without deep instantiation)
{
  class TriggerComponent661 extends Component<{
    Element: HTMLButtonElement;
    Args: {
      menu: { isOpen: boolean };
      trigger: ModifierLike<{ Element: HTMLButtonElement }>;
    };
    Blocks: { default: [] };
  }> {}

  type BoundTrigger661 = WithBoundArgs<typeof TriggerComponent661, 'menu' | 'trigger'>;

  typeTest(
    {
      TriggerComponent: TriggerComponent661,
      BoundTrigger: undefined as unknown as BoundTrigger661,
      menu: { isOpen: false },
      triggerMod: undefined as unknown as ModifierLike<{ Element: HTMLButtonElement }>,
    },
    hbs`
      {{! Using the bound type directly }}
      <this.BoundTrigger />

      {{! Currying via component helper should not cause TS2589 }}
      {{#let (component this.TriggerComponent menu=this.menu trigger=this.triggerMod) as |Bound|}}
        <Bound />
      {{/let}}
    `,
  );
}

// Binding an optional arg still leaves the required one(s)
typeTest(
  { ParametricComponent, formModifier },
  hbs`
    {{#let (component this.ParametricComponent optional="hi") as |OptionalValueCurriedParametricComponent|}}
      <OptionalValueCurriedParametricComponent @values={{array "hi"}} {{this.formModifier}} />

      {{! @glint-expect-error: missing required arg }}
      <OptionalValueCurriedParametricComponent />

      <OptionalValueCurriedParametricComponent
        {{! @glint-expect-error: extra arg }}
        @extra={{true}}
      />

      <OptionalValueCurriedParametricComponent @values={{array "ok"}} {{this.formModifier}} as |value index|>
        {{@expectTypeOf value @to.beString}}
        {{@expectTypeOf index @to.beNumber}}
      </OptionalValueCurriedParametricComponent>


      <OptionalValueCurriedParametricComponent @values={{array true}} {{this.formModifier}} as |value index|>
        {{@expectTypeOf value @to.beBoolean}}
        {{@expectTypeOf index @to.beNumber}}
      </OptionalValueCurriedParametricComponent>
    {{/let}}
  `,
);
