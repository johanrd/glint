import { runTsc } from '@volar/typescript/lib/quickstart/runTsc.js';
import { createEmberLanguagePlugin } from '../volar/ember-language-plugin.js';
import { findConfig } from '../config/index.js';
import { augmentDiagnostics } from '../transform/diagnostics/augmentation.js';
import { VirtualGtsCode } from '../volar/gts-virtual-code.js';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Loaded via CJS require so we can monkey-patch readFileSync; the ESM namespace
// object would be frozen.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('node:fs') as typeof import('node:fs');

/**
 * Wrap Volar's proxyCreateProgram to add Glint diagnostic augmentation.
 *
 * Volar's `decorateProgram` remaps diagnostic locations from generated TS back
 * to .gts source positions, but provides no hook for rewriting diagnostic
 * messages. We wrap the program's `getSemanticDiagnostics` after Volar's
 * decoration to augment error messages with Glint-specific guidance (e.g.
 * "An Element must be specified in the component signature…").
 *
 * Without this, the augmented messages only appear in the IDE (tsserver-plugin)
 * but not in the CLI (`ember-tsc`).
 */
function installDiagnosticAugmentation(): void {
  const proxyApiPath = require.resolve('@volar/typescript/lib/node/proxyCreateProgram');
  const proxyModule = require(proxyApiPath);
  const originalProxyCreateProgram = proxyModule.proxyCreateProgram;

  proxyModule.proxyCreateProgram = function (
    ts: unknown,
    original: unknown,
    create: (...args: unknown[]) => unknown,
  ) {
    let capturedLanguage: any;

    // Wrap the create callback to capture the Volar `language` object via setup.
    const wrappedCreate = (...createArgs: unknown[]) => {
      const result = create(...createArgs) as any;

      if (Array.isArray(result)) {
        return {
          languagePlugins: result,
          setup(language: any) {
            capturedLanguage = language;
          },
        };
      }

      const originalSetup = result.setup;
      return {
        ...result,
        setup(language: any) {
          capturedLanguage = language;
          originalSetup?.(language);
        },
      };
    };

    const proxied = originalProxyCreateProgram(ts, original, wrappedCreate);

    // Wrap the proxied createProgram to augment diagnostics after Volar's
    // decorateProgram has finished location remapping.
    return new Proxy(proxied, {
      apply: (target: any, thisArg: any, args: any[]) => {
        const program: any = Reflect.apply(target, thisArg, args);

        const volarGetSemanticDiagnostics = program.getSemanticDiagnostics;
        program.getSemanticDiagnostics = (sourceFile: any, cancellationToken: any) => {
          const diagnostics = volarGetSemanticDiagnostics(sourceFile, cancellationToken);
          if (!sourceFile || !capturedLanguage) return diagnostics;

          const sourceScript = capturedLanguage.scripts.get(sourceFile.fileName);
          const root = sourceScript?.generated?.root;
          if (root instanceof VirtualGtsCode && root.transformedModule) {
            return augmentDiagnostics(root.transformedModule, diagnostics);
          }

          return diagnostics;
        };

        return program;
      },
    });
  };
}

export function run(): void {
  patchVolarProxyForExtensionlessImports();

  let cwd = process.cwd();

  const options = {
    extraSupportedExtensions: ['.gjs', '.gts'],

    // With the below configuration `{basename.gts}` will produce `{basename}.d.ts`
    // This is in line with how V2 addons build their components.
    // At build time, `.gts` components are emitted as `.js` files, so that's why the corresponding declarations should be `.d.ts`
    //
    // Please refer to https://github.com/typed-ember/glint/issues/988 for more information
    //
    // Before this option, glint emitted broken declarations in which relative imports to other .gts files did not strip extensions (https://github.com/typed-ember/glint/issues/628).
    // The declarations outputted by volar's runTsc luckily also remove extension in imports.
    extraExtensionsToRemove: ['.gjs', '.gts'],
  };

  installDiagnosticAugmentation();

  const main = (): void =>
    runTsc(require.resolve('typescript/lib/tsc'), options, (ts, options) => {
      const glintConfig = findConfig(cwd);

      if (glintConfig) {
        const gtsLanguagePlugin = createEmberLanguagePlugin(glintConfig);
        return [gtsLanguagePlugin];
      } else {
        return [];
      }
    });
  main();
}

// Volar's proxyCreateProgram fast-paths module resolution back to the
// original compiler host when no import literal ends in a `.gts`/`.gjs`
// extension. In one-shot `tsc` the original host has no resolver, so volar's
// wrapper (which makes `Bang.gts` look like `Bang.d.ts` to tsc's extensionless
// resolver via `resolveHiddenExtensions`) runs and extensionless imports work.
// But `tsc --watch` installs a cached resolver on the host before volar's
// proxy runs, so extensionless `.gts` imports skip the wrapper and fail with
// TS2307. Patch the compiled volar source so the fast-path is also disabled
// whenever any plugin sets `resolveHiddenExtensions: true`.
//
// Upstream fix: https://github.com/volarjs/volar.js/pull/309 — once that ships
// in a `@volar/typescript` release we depend on, this monkey-patch can go.
// Tracking: https://github.com/typed-ember/glint/issues/806
function patchVolarProxyForExtensionlessImports(): void {
  const originalReadFileSync = fs.readFileSync;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fs as any).readFileSync = function (...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (originalReadFileSync as any).apply(fs, args);
    const filePath = args[0];
    if (typeof filePath === 'string' && filePath.endsWith('/proxyCreateProgram.js')) {
      const text = typeof result === 'string' ? result : (result as Buffer).toString('utf8');
      const patched = applyProxyPatches(text);
      return typeof result === 'string' ? patched : Buffer.from(patched);
    }
    return result;
  };
}

function applyProxyPatches(source: string): string {
  const guard = '!languagePlugins.some(p => p.typescript?.resolveHiddenExtensions) && ';

  const literalsPattern =
    /(if \(resolveModuleNameLiterals\s+&& )(moduleLiterals\.every\(name => !pluginExtensions\.some\(ext => name\.text\.endsWith\(ext\)\)\)\) \{)/;
  const namesPattern =
    /(if \(resolveModuleNames && )(moduleNames\.every\(name => !pluginExtensions\.some\(ext => name\.endsWith\(ext\)\)\)\) \{)/;

  if (!literalsPattern.test(source) || !namesPattern.test(source)) {
    throw new Error(
      '[glint] failed to patch @volar/typescript proxyCreateProgram.js: ' +
        'fast-path conditions not found in expected shape. ' +
        'The volar dep may have changed; update applyProxyPatches() in run-volar-tsc.ts.',
    );
  }

  return source.replace(literalsPattern, `$1${guard}$2`).replace(namesPattern, `$1${guard}$2`);
}
