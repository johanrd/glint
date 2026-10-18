import Component from '@glimmer/component';
import { on } from '@ember/modifier';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
declare function assert<T extends true>(): void;

interface FormControlsSignature {
  Args: { withTo: boolean; channelList: Array<string> };
}

export default class FormControls extends Component<FormControlsSignature> {
  // A handler may state the controls it reads; the template is checked against it.
  submit = (
    event: SubmitEvent & {
      currentTarget: HTMLFormElement & {
        elements: { from: HTMLInputElement; connector: HTMLSelectElement; to?: HTMLInputElement };
      };
    },
  ) => {
    let { from, connector, to } = event.currentTarget.elements;
    assert<Equal<typeof from, HTMLInputElement>>();
    assert<Equal<typeof connector, HTMLSelectElement>>();
    assert<Equal<typeof to, HTMLInputElement | undefined>>();
  };

  // Disabled controls are in `elements`, unlike FormData.
  restrict = (
    event: SubmitEvent & {
      currentTarget: HTMLFormElement & { elements: { engineStatus: HTMLInputElement } };
    },
  ) => {
    assert<Equal<typeof event.currentTarget.elements.engineStatus.checked, boolean>>();
  };

  // Two definite radios form a RadioNodeList; `{{#each}}` may render none, one or many.
  groups = (
    event: SubmitEvent & {
      currentTarget: HTMLFormElement & {
        elements: { size: RadioNodeList; channel?: HTMLInputElement | RadioNodeList };
      };
    },
  ) => {
    assert<Equal<typeof event.currentTarget.elements.size.value, string>>();
  };

  // A radio group with static values: the value is one of them, or '' while none is checked.
  role = (
    event: SubmitEvent & {
      currentTarget: HTMLFormElement & {
        elements: { role: RadioNodeList & { value: 'contractor' | 'quarry' | 'other' | '' } };
      };
    },
  ) => {
    assert<Equal<typeof event.currentTarget.elements.role.value, 'contractor' | 'quarry' | 'other' | ''>>();
  };

  // Dynamic names, `form=` controls, collection members and non-controls are not exposed.
  dynamic = (
    event: SubmitEvent & { currentTarget: HTMLFormElement & { elements: { tag: HTMLInputElement } } },
  ) => void event;
  elsewhere = (
    event: SubmitEvent & {
      currentTarget: HTMLFormElement & { elements: { elsewhere: HTMLInputElement } };
    },
  ) => void event;
  shadowed = (
    event: SubmitEvent & { currentTarget: HTMLFormElement & { elements: { length: HTMLInputElement } } },
  ) => void event;
  notAControl = (
    event: SubmitEvent & { currentTarget: HTMLFormElement & { elements: { frame: HTMLIFrameElement } } },
  ) => void event;

  // Claims a control the template does not render.
  missing = (
    event: SubmitEvent & {
      currentTarget: HTMLFormElement & { elements: { until: HTMLInputElement } };
    },
  ) => void event;

  // Claims `to` always exists, but it renders conditionally.
  notOptional = (
    event: SubmitEvent & {
      currentTarget: HTMLFormElement & { elements: { to: HTMLInputElement } };
    },
  ) => void event;

  // Claims the wrong element type.
  wrongTag = (
    event: SubmitEvent & {
      currentTarget: HTMLFormElement & { elements: { connector: HTMLInputElement } };
    },
  ) => void event;

  <template>
    <form {{on "submit" this.submit}}>
      <input name="from" type="date" />
      <select name="connector"></select>
      {{#if @withTo}}<input name="to" type="date" />{{/if}}
    </form>

    <form {{on "submit" this.restrict}}>
      <input name="engineStatus" type="checkbox" disabled />
    </form>

    {{! @glint-expect-error }}
    <form {{on "submit" this.missing}}>
      <input name="from" />
    </form>

    {{! @glint-expect-error }}
    <form {{on "submit" this.notOptional}}>
      {{#if @withTo}}<input name="to" />{{/if}}
    </form>

    {{! @glint-expect-error }}
    <form {{on "submit" this.wrongTag}}>
      <select name="connector"></select>
    </form>

    <form {{on "submit" this.groups}}>
      <input name="size" type="radio" value="s" />
      <input name="size" type="radio" value="m" />
      {{#each @channelList as |channel|}}<input name="channel" value={{channel}} />{{/each}}
    </form>

    <form {{on "submit" this.role}}>
      <input type="radio" name="role" value="contractor" />
      <input type="radio" name="role" value="quarry" />
    </form>

    {{! A radio value outside the handler's union }}
    {{! @glint-expect-error }}
    <form {{on "submit" this.role}}>
      <input type="radio" name="role" value="contractor" />
      <input type="radio" name="role" value="rental" />
    </form>

    {{! @glint-expect-error }}
    <form {{on "submit" this.dynamic}}><input name={{if @withTo "tag" "other"}} /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.elsewhere}}><input name="elsewhere" form="other-form" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.shadowed}}><input name="length" /></form>
    {{! @glint-expect-error }}
    <form {{on "submit" this.notAControl}}><iframe name="frame"></iframe></form>
  </template>
}
