import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import type { TOC } from '@ember/component/template-only';

type Submit<Elements> = (
  event: SubmitEvent & { currentTarget: HTMLFormElement & { elements: Elements } },
) => void;
const handler = <Elements,>(): Submit<Elements> => () => {};

const Toggle: TOC<{ Element: HTMLInputElement }> = <template>
  <input type="checkbox" ...attributes />
</template>;
const Caption: TOC<{ Element: HTMLLabelElement }> = <template><label ...attributes></label></template>;
const Action: TOC<{ Element: HTMLButtonElement | HTMLAnchorElement }> = <template>
  <button type="button" ...attributes></button>
</template>;
const UI = { Toggle };

export default class FormControlComponents extends Component<{
  Args: { flag: boolean; list: string[]; toggle: typeof Toggle; maybe?: typeof Toggle };
}> {
  Field = Toggle;

  submit = handler<{
    engine: HTMLInputElement;
    sometimes?: HTMLInputElement;
    field?: HTMLInputElement;
    arg?: HTMLInputElement;
    yielded?: HTMLInputElement;
    namespaced?: HTMLInputElement;
  }>();

  union = handler<{ intent: HTMLButtonElement }>();
  notAControl = handler<{ plan: HTMLSelectElement }>();
  inEach = handler<{ engine: HTMLInputElement }>();
  withNative = handler<{ engine: HTMLInputElement }>();
  image = handler<{ go: HTMLInputElement }>();
  maybeUndefined = handler<{ engine: HTMLInputElement }>();
  mayBeAbsent = handler<{ arg: HTMLInputElement }>();

  <template>
    <form {{on "submit" this.submit}}>
      <Toggle name="engine" />
      {{#if @flag}}<Toggle name="sometimes" />{{/if}}
      <this.Field name="field" />
      <@toggle name="arg" />
      {{#let Toggle as |T|}}<T name="yielded" />{{/let}}
      <UI.Toggle name="namespaced" />
    </form>

    {{! @glint-expect-error }}
    <form {{on "submit" this.union}}><Action name="intent" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.notAControl}}><Caption id="plan" /><select name="plan"></select></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.inEach}}>{{#each @list}}<Toggle name="engine" />{{/each}}</form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.withNative}}><Toggle name="engine" /><input name="engine" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.image}}><Toggle type="image" name="go" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.maybeUndefined}}><@maybe name="engine" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.mayBeAbsent}}><@toggle name="arg" /></form>
  </template>
}
