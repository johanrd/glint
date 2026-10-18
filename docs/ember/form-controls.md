# Form Controls

Glint types a `<form>`'s `elements` from the named controls in its template. A submit handler declares the controls it reads, and Glint checks that declaration against the template.

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

- **Controls:** static `name` or `id` on `button`, `fieldset`, `input`, `object`, `output`, `select` and `textarea`. This is the list of elements in lib.dom that have `willValidate`.
- **`{{#if}}` / `{{#unless}}`:** optional, unless every branch renders the control.
- **`{{#let}}`:** no change.
- **`{{#each}}`, component blocks:** optional, and may be a `RadioNodeList`.
- **`<MyInput name="x" />`:** the component's `Element`, where its `...attributes` land.
- **Radio groups with static `value`s:** `value` is the union of them, or `''` while none is checked.
- **Ignored:** dynamic names, `form="…"`, `{{#in-element}}`, and controls a component renders internally.

## `elements` and `FormData`

`FormData` holds what the browser would submit. It leaves out disabled controls and unchecked checkboxes, and its values are `string | File | null`. `elements` holds every control, including disabled ones, with its element type: `.checked`, `.valueAsNumber` and `.valueAsDate` are available.

```ts
let { name } = event.currentTarget.elements;
save({ name: name.disabled ? null : name.value }); // as FormData would
```

Use `FormData` for dynamic names, files and `<select multiple>`.
