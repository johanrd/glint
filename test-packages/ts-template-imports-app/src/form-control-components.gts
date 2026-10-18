import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import type { TOC } from '@ember/component/template-only';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
declare function assert<T extends true>(): void;

const Toggle: TOC<{ Element: HTMLInputElement; Blocks: { default: [] } }> = <template>
  <label><input type="checkbox" ...attributes />{{yield}}</label>
</template>;

class Picker extends Component<{ Element: HTMLSelectElement }> {
  <template><select ...attributes></select></template>
}

const Labelled: TOC<{ Element: HTMLLabelElement }> = <template>
  <label ...attributes></label>
</template>;

export default class FormControlComponents extends Component<{ Args: { flag: boolean } }> {
  submit = (
    event: SubmitEvent & {
      currentTarget: HTMLFormElement & {
        elements: { engineStatus: HTMLInputElement; connector: HTMLSelectElement; optional?: HTMLInputElement };
      };
    },
  ) => {
    let { engineStatus, connector } = event.currentTarget.elements;
    assert<Equal<typeof engineStatus, HTMLInputElement>>();
    assert<Equal<typeof connector, HTMLSelectElement>>();
  };

  // A component whose `...attributes` land on a <label> exposes no control.
  label = (
    event: SubmitEvent & {
      currentTarget: HTMLFormElement & { elements: { caption: HTMLLabelElement } };
    },
  ) => void event;

  <template>
    <form {{on "submit" this.submit}}>
      <Toggle name="engineStatus">Engine status</Toggle>
      <Picker name="connector" />
      {{#if @flag}}<Toggle name="optional" />{{/if}}
    </form>

    {{! @glint-expect-error }}
    <form {{on "submit" this.label}}><Labelled name="caption" /></form>
  </template>
}
