// Type checks N generated components per template with TypeScript 7 through
// ember-content-mapper, and prints the checker's counts per component above `empty`.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { component, variants } from './templates.mjs';

const { values } = parseArgs({
  options: {
    components: { type: 'string', default: '100' },
    runs: { type: 'string', default: '5' },
    json: { type: 'string' },
  },
});
const count = Number(values.components);
const runs = Number(values.runs);
const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');
const modules = join(import.meta.dirname, 'node_modules');
const root = join(import.meta.dirname, 'generated');

function check(name, variant) {
  let dir = join(root, name.replace(/\W+/g, '-'));
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'app'), { recursive: true });
  for (let i = 0; i < count; i++) {
    writeFileSync(join(dir, 'app', `c${i}.gts`), component(`C${i}`, variant));
  }
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      extends: '@ember/app-tsconfig',
      compilerOptions: {
        types: [],
        // As in ts7-content-mapper-app: one instance of the packages Glint augments.
        paths: {
          '@glimmer/component': [join(modules, '@glimmer/component/dist/index.d.ts')],
          'ember-modifier': [join(modules, 'ember-modifier/declarations/index.d.ts')],
        },
      },
      include: ['app'],
      contentMappers: [{ package: 'ember-content-mapper', extensions: ['.gts'] }],
    }),
  );

  let result;
  for (let run = 0; run < runs; run++) {
    let args = ['--noEmit', '--runExternalCode', '--extendedDiagnostics', '--checkers', '1'];
    let output;
    try {
      output = execFileSync(process.execPath, [tsc, ...args, '--pretty', 'false'], {
        cwd: dir,
        encoding: 'utf8',
      });
    } catch (error) {
      throw new Error(`${name} has type errors:\n${error.stdout}`);
    }
    let stat = (label) => Number(output.match(new RegExp(`^${label}:\\s+([\\d.]+)`, 'm'))[1]);
    result = {
      instantiations: stat('Instantiations'),
      types: stat('Types'),
      checkTime: Math.min(stat('Check time'), result?.checkTime ?? Infinity),
    };
  }
  return result;
}

let results = Object.fromEntries(
  Object.entries(variants).map(([name, variant]) => [name, check(name, variant)]),
);
let report = {
  components: count,
  runs,
  typescript: require('typescript/package.json').version,
  results,
};

if (values.json) writeFileSync(values.json, JSON.stringify(report, null, 2));

let base = results.empty;
let perComponent = (result, key) => (result[key] - base[key]) / count;
console.log(`TypeScript ${report.typescript}, ${count} components, check time best of ${runs}\n`);
console.table(
  Object.fromEntries(
    Object.entries(results).map(([name, result]) => [
      name,
      {
        'instantiations / component': Math.round(perComponent(result, 'instantiations')),
        'types / component': Math.round(perComponent(result, 'types')),
        'check ms / component': +(perComponent(result, 'checkTime') * 1000).toFixed(2),
      },
    ]),
  ),
);
