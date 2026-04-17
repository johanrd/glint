import { runTsc } from '@volar/typescript/lib/quickstart/runTsc.js';
import { createEmberLanguagePlugin } from '../volar/ember-language-plugin.js';
import { findConfig } from '../config/index.js';
import { augmentDiagnostics } from '../transform/diagnostics/augmentation.js';
import { VirtualGtsCode } from '../volar/gts-virtual-code.js';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

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
