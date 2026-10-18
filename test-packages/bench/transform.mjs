// Times the template transform on each template, as the TS 7 content mapper runs it.
import { GlintEnvironment } from '@glint/ember-tsc/config/index';
import { rewriteModuleStandalone } from '@glint/ember-tsc/transform/standalone';
import { bench, run, summary } from 'mitata';
import { component, variants } from './templates.mjs';

const environment = GlintEnvironment.load({});

summary(() => {
  for (let [name, variant] of Object.entries(variants)) {
    let script = { filename: 'component.gts', contents: component('C', variant) };
    bench(name, () => rewriteModuleStandalone({ script }, environment));
  }
});

await run();
