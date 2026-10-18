# bench

Measures what templates cost Glint on TypeScript 7, through ember-content-mapper. Run `pnpm build` at the root first.

- `pnpm bench:check [--components 100] [--runs 5] [--json file]` type checks generated components, one template each, and prints the checker's instantiations, types and check time per component above an empty template. The counts are exact. Check time is the best of `--runs`.
- `pnpm bench:compare base.json head.json` prints a markdown table of two `--json` reports. CI runs it on every pull request and writes it to the job summary.
- `pnpm bench:transform` times the template transform on the same templates with [mitata](https://github.com/evanwashere/mitata).

The templates are in `templates.mjs`.
