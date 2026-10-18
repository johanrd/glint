// Templates the benchmarks compare. Each one is the whole template of a component.
const controls = '<input name="a" /><select name="b"></select><textarea name="c"></textarea>';
const unnamed = '<input /><select></select><textarea></textarea>';
const on = '{{on "submit" this.submit}}';

export const variants = {
  empty: { template: '<div></div>' },
  'div, named controls': { template: `<div ${on}>${controls}</div>` },
  'form, unnamed controls': { template: `<form ${on}>${unnamed}</form>` },
  'form, no {{on}}': { template: `<form>${controls}</form>` },
  'form, handler (event: SubmitEvent)': { template: `<form ${on}>${controls}</form>` },
  'form, handler with currentTarget': {
    template: `<form ${on}>${controls}</form>`,
    event: 'SubmitEvent & { currentTarget: HTMLFormElement }',
  },
};

export function component(name, { template, event = 'SubmitEvent' }) {
  return [
    `import Component from '@glimmer/component';`,
    `import { on } from '@ember/modifier';`,
    `export default class ${name} extends Component {`,
    `  submit = (event: ${event}) => void event;`,
    `  <template>${template}</template>`,
    `}`,
    '',
  ].join('\n');
}
