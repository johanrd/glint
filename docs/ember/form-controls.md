# Form Controls

Glint types a `<form>`'s `elements` from the named controls in its template. A submit handler declares the controls it reads, and Glint checks that declaration against the template.

It is off by default. Turn it on in `tsconfig.json`, in the content mapper's options on TypeScript 7:

```jsonc
{
  "contentMappers": [
    {
      "package": "ember-content-mapper",
      "extensions": [".gts", ".gjs"],
      "options": { "formControls": true }
    }
  ]
}
```

or in the `glint` object for `ember-tsc`:

```jsonc
{
  "glint": { "formControls": true }
}
```

```gts
import Component from '@glimmer/component';
import { on } from '@ember/modifier';

export default class NewProject extends Component {
  submit = (
    event: SubmitEvent & {
      currentTarget: HTMLFormElement & {
        elements: {
          name: HTMLInputElement;
          plan: HTMLSelectElement;
          public: HTMLInputElement;
          size: RadioNodeList & { value: 'small' | 'large' | '' };
        };
      };
    },
  ) => {
    let { name, plan, public: isPublic, size } = event.currentTarget.elements;
    save({ name: name.value, plan: plan.value, isPublic: isPublic.checked, size: size.value });
  };

  <template>
    <form {{on "submit" this.submit}}>
      <input name="name" required />
      <select name="plan">…</select>
      <input name="public" type="checkbox" />
      <input name="size" type="radio" value="small" />
      <input name="size" type="radio" value="large" />
    </form>
  </template>
}
```

No `as HTMLInputElement`, no `formData.get('name') as string`.

## What it catches

The error is reported on the form's `{{on "submit"}}`.

| Template                                              | Handler declares            | Result                    |
| ----------------------------------------------------- | --------------------------- | ------------------------- |
| `name="plan"` renamed or removed                      | `plan: HTMLSelectElement`   | `'plan' is missing`       |
| `<select name="plan">` changed to `<input>`           | `plan: HTMLSelectElement`   | type mismatch             |
| `{{#if @pro}}<select name="plan">{{/if}}`             | `plan: HTMLSelectElement`   | must be `plan?:`          |
| a second `name="plan"`, or another control `id="plan"` | `plan: HTMLSelectElement`   | it is a `RadioNodeList`   |
| `<input type="radio" name="size" value="medium">`     | `value: 'small' \| 'large' \| ''` | `'medium'` not assignable |

## How controls are found

- **Controls:** static `name` or `id` on `button`, `fieldset`, `input`, `object`, `output`, `select` and `textarea`, the HTML spec's [listed elements](https://html.spec.whatwg.org/multipage/forms.html#category-listed). `<input type="image">` is left out, because `elements` does not include it.
- **`{{#if}}` / `{{#unless}}`:** optional, unless every branch renders the control.
- **`{{#let}}`:** no change.
- **`{{#each}}`, component blocks:** optional, and may be a `RadioNodeList`.
- **A dynamic `type`:** optional if it can be `image`. `{{if}}` and `{{unless}}` with string branches are read.
- **Radio groups with static `value`s:** `value` is the union of them, or `''` while none is checked.
- **`unknown`:** a name on a component or a custom element, because it can render a control of any type. A control with `...attributes` is optional, because the caller can replace its `name`.
- **Not seen:** dynamic names, `{{#in-element}}`, controls that a component or `{{yield}}` renders, and controls outside the form that join it with `form="…"`. If one of them has the same name as a control in the template, `elements` returns a `RadioNodeList` that the type does not show.
- **Not typed:** a form with an element named `elements`, which replaces `form.elements`, and forms in `.gjs` files.

## Limits

- **Optional controls are not checked.** TypeScript does not report a declared optional property that the template lacks, so `{ email?: HTMLInputElement }` still compiles after `name="email"` is renamed.
- **`strictFunctionTypes` is required.** Without it, a handler's parameter is not checked against the form, and most of these errors are not reported.
