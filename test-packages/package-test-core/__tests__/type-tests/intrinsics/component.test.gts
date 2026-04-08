import Component from '@ember/component';
import { expectTypeOf, to } from '@glint/type-test';
import { array } from '@ember/helper';
import { hash } from '@ember/helper';
import type { WithBoundArgs, ModifierLike } from '@glint/template';

declare const formModifier: ModifierLike<{ Element: HTMLFormElement }>;

class StringComponent extends Component<{
  Element: HTMLFormElement;
  Args: { value: string };
  Blocks: { default: [string] };
}> {}

// Simple no-op binding
const NoopBindingTest = <template>
  {{#let (component StringComponent) as |NoopCurried|}}
    <NoopCurried @value="hi" {{formModifier}} />

    {{! @glint-expect-error: missing required arg }}
    <NoopCurried />

    <NoopCurried @value="ok" {{formModifier}} as |value|>
      {{expectTypeOf value to.beString}}
    </NoopCurried>
  {{/let}}
</template>;

// Nullable in, nullable out
// (bare block for scoping — isolates declarations from other tests)
{
  const NullableStringComponent = StringComponent as typeof StringComponent | null;

  const NullableTest = <template>
    {{#let (component NullableStringComponent) as |NoopCurried|}}
      <NoopCurried @value="hi" />
      {{expectTypeOf null to.beAssignableToTypeOf NoopCurried}}
    {{/let}}
  </template>;
}

// Currying a named arg makes it optional but still override-able
{
  const expectedType = {} as WithBoundArgs<typeof StringComponent, 'value'>;

  const CurriedArgTest = <template>
    {{#let (component StringComponent value="hello") as |BoundStringComponent|}}
      <BoundStringComponent />
      <BoundStringComponent @value="overridden" />

      {{expectTypeOf BoundStringComponent to.equalTypeOf expectedType}}

      <BoundStringComponent {{formModifier}} as |value|>
        {{expectTypeOf value to.beString}}
      </BoundStringComponent>
    {{/let}}
  </template>;
}

class ParametricComponent<T> extends Component<{
  Element: HTMLFormElement;
  Args: { values: Array<T>; optional?: string };
  Blocks: { default: [T, number] };
}> {}

// Simple no-op binding with generics
const NoopParametricTest = <template>
  {{#let (component ParametricComponent) as |NoopCurried|}}
    <NoopCurried @values={{array "hi"}} {{formModifier}} />

    {{! @glint-expect-error: missing required arg }}
    <NoopCurried />

    <NoopCurried
      @values={{array}}
      {{! @glint-expect-error: extra arg }}
      @extra={{true}}
    />

    <NoopCurried @values={{array "ok"}} {{formModifier}} as |value index|>
      {{expectTypeOf value to.beString}}
      {{expectTypeOf index to.beNumber}}
    </NoopCurried>

    <NoopCurried @values={{array true}} {{formModifier}} as |value index|>
      {{expectTypeOf value to.beBoolean}}
      {{expectTypeOf index to.beNumber}}
    </NoopCurried>
  {{/let}}
</template>;

// Binding a required arg makes it optional
const RequiredArgCurriedTest = <template>
  {{#let (component ParametricComponent values=(array "hi")) as |RequiredCurried|}}
    <RequiredCurried @values={{array "hi"}} {{formModifier}} />

    <RequiredCurried />

    {{! TODO: should error (wrong type for pre-bound) but T is erased in .gts }}
    <RequiredCurried @values={{array 1 2 3}} />

    <RequiredCurried
      {{! @glint-expect-error: extra arg }}
      @extra={{true}}
    />

    {{! TODO: value should be string but T is erased through pre-binding in .gts }}
    <RequiredCurried {{formModifier}} as |value index|>
      {{expectTypeOf index to.beNumber}}
    </RequiredCurried>
  {{/let}}
</template>;

// Binding an optional arg still leaves the required one(s)
const OptionalArgCurriedTest = <template>
  {{#let (component ParametricComponent optional="hi") as |OptionalCurried|}}
    <OptionalCurried @values={{array "hi"}} {{formModifier}} />

    {{! @glint-expect-error: missing required arg }}
    <OptionalCurried />

    <OptionalCurried
      {{! @glint-expect-error: extra arg }}
      @extra={{true}}
    />

    <OptionalCurried @values={{array "ok"}} {{formModifier}} as |value index|>
      {{expectTypeOf value to.beString}}
      {{expectTypeOf index to.beNumber}}
    </OptionalCurried>

    <OptionalCurried @values={{array true}} {{formModifier}} as |value index|>
      {{expectTypeOf value to.beBoolean}}
      {{expectTypeOf index to.beNumber}}
    </OptionalCurried>
  {{/let}}
</template>;

// Regression test: hokulea-style discriminated union modifier in generic component.
// Reproduces https://github.com/typed-ember/glint/issues/1107
//
// A modifier whose Named args use a discriminated union (multi: true vs false)
// used inside a generic component that passes through its generic type.
// The discriminated union creates overloaded call signatures, and
// `multi: boolean | undefined` doesn't match either `multi: true` or `multi?: false`.
//
// This error was previously swallowed because __glintY__.element lacked its own
// Volar source mapping (fixed in #1087). The type error is real — consider
// narrowing the discriminant or restructuring the union type.
{
  type WithItems<T> = {
    items: T[];
    selection?: T | T[];
    activateItem?: (item: T) => void;
  } & (
    | { multi: true; select?: (selection: T[]) => void }
    | { multi?: false; select?: (selection: T) => void }
  );

  type OptionalItems = {
    items?: HTMLElement[];
    selection?: HTMLElement | HTMLElement[];
    activateItem?: (item: HTMLElement) => void;
  } & (
    | { multi: true; select?: (selection: HTMLElement[]) => void }
    | { multi?: false; select?: (selection: HTMLElement) => void }
  );

  type EmitterSignature<T> = WithItems<T> | OptionalItems;

  type ListboxModifier<V> = import('@glint/template').ModifierLike<{
    Element: HTMLElement;
    Args: {
      Named: EmitterSignature<V> & { disabled?: boolean };
    };
  }>;

  // Generic wrapper component (like hokulea's List<V>).
  // Passes multi as `boolean | undefined` — doesn't match either branch
  // of the discriminated union, so TS correctly rejects it.
  class List<V> extends Component<{
    Element: HTMLDivElement;
    Args: {
      items: V[];
      value?: V | V[];
      multiple?: boolean;
      disabled?: boolean;
      update?: (value: V | V[]) => void;
      activateItem?: (value: V) => void;
    };
    Blocks: { default: [] };
  }> {
    declare ariaListbox: ListboxModifier<V>;

    <template>
      <div
        ...attributes
        {{! @glint-expect-error: multi: boolean | undefined is not assignable to true | false discriminant }}
        {{this.ariaListbox
          items=@items
          selection=@value
          multi=@multiple
          disabled=@disabled
          select=@update
          activateItem=@activateItem
        }}
      >
        {{yield}}
      </div>
    </template>
  }
}

// Issue #661: WithBoundArgs with ModifierLike arg — verified fixed.
// Currying named args including ModifierLike no longer causes TS2589.
{
  class TriggerComponent extends Component<{
    Element: HTMLButtonElement;
    Args: {
      menu: { isOpen: boolean };
      trigger: ModifierLike<{ Element: HTMLButtonElement }>;
    };
    Blocks: { default: [] };
  }> {}

  const triggerMod = undefined as unknown as ModifierLike<{ Element: HTMLButtonElement }>;

  const WithBoundArgsModifierTest = <template>
    {{#let (component TriggerComponent menu=(hash isOpen=false) trigger=triggerMod) as |Bound|}}
      <Bound />
    {{/let}}
  </template>;
}
