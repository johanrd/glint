import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import type { TOC } from '@ember/component/template-only';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
declare function assert<T extends true>(): void;
type Submit<Elements> = (
  event: SubmitEvent & { currentTarget: HTMLFormElement & { elements: Elements } },
) => void;
const handler = <Elements,>(): Submit<Elements> => () => {};

const Toggle: TOC<{ Element: HTMLInputElement }> = <template>
  <input type="checkbox" ...attributes />
</template>;
class Picker extends Component<{ Element: HTMLSelectElement }> {
  <template><select ...attributes></select></template>
}
const Caption: TOC<{ Element: HTMLLabelElement }> = <template><label ...attributes></label></template>;
const UI = { Toggle };

export default class FormControls extends Component<{ Args: { flag: boolean; list: string[] } }> {
  submit: Submit<{
    from: HTMLInputElement;
    plan: HTMLSelectElement;
    to?: HTMLInputElement;
    size: RadioNodeList & { value: 'small' | 'large' | '' };
    entry?: HTMLInputElement | RadioNodeList;
    engine: HTMLInputElement;
    connector: HTMLSelectElement;
  }> = (event) => {
    let { from, to, size, engine } = event.currentTarget.elements;
    assert<Equal<typeof engine.checked, boolean>>();
    assert<Equal<typeof from, HTMLInputElement>>();
    assert<Equal<typeof to, HTMLInputElement | undefined>>();
    assert<Equal<typeof size.value, 'small' | 'large' | ''>>();
  };
  mixed = handler<{
    plan: HTMLSelectElement;
    own: HTMLInputElement;
    sibling: HTMLInputElement;
    size: RadioNodeList & { value: 'a' | 'b' | '' };
    engine: HTMLInputElement;
  }>();

  missing = handler<{ until: HTMLInputElement }>();
  required = handler<{ to: HTMLInputElement }>();
  wrongType = handler<{ plan: HTMLInputElement }>();
  radioValue = handler<{ size: RadioNodeList & { value: 'small' | '' } }>();
  dynamic = handler<{ other: HTMLInputElement }>();
  elsewhere = handler<{ elsewhere: HTMLInputElement }>();
  shadowed = handler<{ length: HTMLInputElement }>();
  notAControl = handler<{ frame: HTMLIFrameElement }>();
  notAControlComponent = handler<{ caption: HTMLLabelElement }>();
  componentTwice = handler<{ engine: HTMLInputElement }>();
  componentInEach = handler<{ engine: HTMLInputElement }>();
  yielded = handler<{ engine?: HTMLInputElement }>();
  image = handler<{ go: HTMLInputElement }>();
  dynamicType = handler<{ when: HTMLInputElement }>();
  index = handler<{ '0': HTMLInputElement }>();
  prototype = handler<{ constructor: HTMLInputElement }>();
  overridden = handler<{ from: HTMLInputElement }>();
  customElement = handler<{ from: HTMLInputElement }>();

  <template>
    <form {{on "submit" this.submit}}>
      <input name="from" />
      <select name="plan"></select>
      {{#if @flag}}<input name="to" />{{/if}}
      <input type="radio" name="size" value="small" />
      <input type="radio" name="size" value="large" />
      {{#each @list as |entry|}}<input name="entry" value={{entry}} />{{/each}}
      <Toggle name="engine" disabled />
      <Picker name="connector" />
    </form>

    <form id="mixed" {{on "submit" this.mixed}}>
      <Caption id="plan" /><select name="plan"></select>
      <input name="own" form="mixed" />
      {{#let Toggle as |input|}}{{input}}{{/let}}<input name="sibling" />
      <input type="RADIO" name="size" value="a" /><input type="radio" name="size" value="b" />
      <UI.Toggle name="engine" />
    </form>

    {{! @glint-expect-error }}
    <form {{on "submit" this.missing}}><input name="from" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.required}}>{{#if @flag}}<input name="to" />{{/if}}</form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.wrongType}}><select name="plan"></select></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.radioValue}}>
      <input type="radio" name="size" value="small" /><input type="radio" name="size" value="xl" />
    </form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.dynamic}}><input name={{if @flag "other" "x"}} /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.elsewhere}}><input name="elsewhere" form="other" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.shadowed}}><input name="length" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.notAControl}}><iframe name="frame"></iframe></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.notAControlComponent}}><Caption name="caption" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.componentTwice}}><Toggle name="engine" /><input name="engine" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.componentInEach}}>{{#each @list}}<Toggle name="engine" />{{/each}}</form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.yielded}}>{{#let Toggle as |T|}}<T name="engine" />{{/let}}</form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.image}}><input type="image" name="go" alt="Go" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.dynamicType}}><input type={{if @flag "date" "image"}} name="when" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.index}}><input name="0" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.prototype}}><input name="constructor" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.overridden}}><input name="elements" /><input name="from" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.customElement}}><input name="from" /><my-input name="from"></my-input></form>
  </template>
}
