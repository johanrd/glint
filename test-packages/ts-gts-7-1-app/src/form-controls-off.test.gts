import Component from '@glimmer/component';
import { on } from '@ember/modifier';

// Without the `formControls` option, a form's `elements` stay untyped.
export default class FormControlsOff extends Component {
  untyped = (event: SubmitEvent & { currentTarget: HTMLFormElement }) => event.preventDefault();
  typed = (
    event: SubmitEvent & {
      currentTarget: HTMLFormElement & { elements: { from: HTMLInputElement } };
    },
  ) => event.currentTarget.elements.from.value;

  <template>
    <form {{on "submit" this.untyped}}><input name="from" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.typed}}><input name="from" /></form>
  </template>
}
