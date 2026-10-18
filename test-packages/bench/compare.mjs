// Prints a markdown table of two `check.mjs --json` reports, per component above `empty`.
import { readFileSync } from 'node:fs';

const [base, head] = process.argv.slice(2).map((file) => JSON.parse(readFileSync(file, 'utf8')));

const perComponent = (report, name, key) =>
  (report.results[name][key] - report.results.empty[key]) / report.components;
const signed = (value, digits) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;

let rows = Object.keys(head.results)
  .filter((name) => name !== 'empty' && name in base.results)
  .map((name) => {
    let cells = [
      ['instantiations', 0, 1],
      ['types', 0, 1],
      ['checkTime', 2, 1000],
    ].flatMap(([key, digits, scale]) => {
      let before = perComponent(base, name, key) * scale;
      let after = perComponent(head, name, key) * scale;
      return [before.toFixed(digits), after.toFixed(digits), signed(after - before, digits)];
    });
    return `| ${name} | ${cells.join(' | ')} |`;
  });

console.log(
  [
    `### Template cost per component (TypeScript ${head.typescript}, ${head.components} components)`,
    '',
    '| Template | Inst. base | Inst. head | Δ | Types base | Types head | Δ | Check ms base | Check ms head | Δ |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    `Instantiations and types are exact. Check time is the best of ${head.runs} runs on one checker.`,
  ].join('\n'),
);
