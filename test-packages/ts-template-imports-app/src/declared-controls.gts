import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';

type Submit<Elements> = (
  event: SubmitEvent & { currentTarget: HTMLFormElement & { elements: Elements } },
) => void;
const handler = <Elements,>(): Submit<Elements> => () => {};

export default class DeclaredControls extends Component<{ Args: { flag: boolean } }> {
  optional = handler<{ from: HTMLInputElement; to?: HTMLInputElement }>();
  renamedOptional = handler<{ from: HTMLInputElement; until?: HTMLInputElement }>();
  method(event: SubmitEvent & { currentTarget: HTMLFormElement & { elements: { from: HTMLInputElement } } }) {
    event.currentTarget.elements.from.value;
  }

  withArg = (n: number, event: SubmitEvent & { currentTarget: HTMLFormElement & { elements: { from: HTMLInputElement } } }) => n;

  <template>
    <form {{on "submit" this.optional}}><input name="from" />{{#if @flag}}<input name="to" />{{/if}}</form>
    <form {{on "submit" this.method}}><input name="from" /></form>
    <form {{on "submit" (fn this.method)}}><input name="from" /></form>
    <form {{on "submit" (fn this.withArg 1)}}><input name="from" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.renamedOptional}}><input name="from" /></form>
  </template>
}
