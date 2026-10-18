import { GlintEmitMetadata } from '@glint/ember-tsc/config-types';
import type ts from 'typescript';
import { CorrelatedSpan, Directive, TransformError } from '../transformed-module.js';
import { TSLib } from '../../util.js';

export type PartialCorrelatedSpan = Omit<CorrelatedSpan, 'transformedStart' | 'transformedLength'>;

export type CorrelatedSpansResult = {
  errors: Array<TransformError>;
  directives: Array<Directive>;
  partialSpans: Array<PartialCorrelatedSpan>;
};

export type ImportedBinding = { specifier: string; source: string; synthetic: boolean };
export type ImportedBindings = Record<string, ImportedBinding>;

/**
 * Everything the template transform needs to know about one embedded
 * `<template>`, independent of how the surrounding script was analyzed.
 * `rewriteModule` derives this from the TypeScript AST; the standalone entry
 * point derives it from content-tag's parse output and a lightweight scan of
 * the script (see `script-scanner.ts`).
 */
export type EmbeddedTemplate = {
  /** The template's text, as authored between the tags. */
  template: string;
  /** Offsets into the original script, in the same shape as `GlintEmitMetadata['templateLocation']`. */
  templateLocation: NonNullable<GlintEmitMetadata['templateLocation']>;
  thisBinding: TemplateThisBinding;
  /** JavaScript names in scope at the template; see `templateLexicalBindings`. */
  lexicalBindings?: ReadonlySet<string> | undefined;
  /** Text emitted before / after the template's transformed output (e.g. `export default `). */
  prepend?: string | undefined;
  append?: string | undefined;
};

/**
 * How the `{{this}}` of an embedded template should be bound, based on where
 * the template sits in the surrounding module:
 *
 * - `'backing-class'`: a class-member `<template>` (the class's own template).
 *   The environment transform rewrites that form into a static block, so we
 *   look for one on the way up. Emitted as `templateForBackingValue(this, ...)`;
 *   `{{this}}` is the class instance, reached through the template context.
 *
 * - `'lexical'`: an expression template (RFC 931 implicit form) inside a class
 *   member — a field initializer or method body. Its `this` is the *lexical*
 *   `this` of its position, captured like an arrow function's, so `{{this}}`
 *   in a field initializer sees the enclosing instance. Treating these as
 *   class-backed emitted `templateForBackingValue(this, ...)` into positions
 *   where `this` is not the class constructor, which broke `Context` inference
 *   and silently typed the template's `{{this}}` as `any` (#1182).
 *
 * - `'context'`: an expression template anywhere else — module scope, a call
 *   argument, a heritage clause. `{{this}}` stays on the template context
 *   (`__glintRef__.this`) so that consumers which assign a context type to a
 *   template-only value keep working: `typeTest(context, <template>...)` from
 *   `@glint/type-test` contextually types `Context['this']` through the
 *   expected type of the `templateExpression(...)` expression, and emitting
 *   the module's lexical `this` (type `undefined`) instead severed that and
 *   broke every such type test (#1186).
 */
export type TemplateThisBinding = 'backing-class' | 'lexical' | 'context';

/**
 * The ancestor kinds that decide a template's `this` binding, in the order
 * met walking outward from the template. See {@link TemplateThisBinding}.
 */
export type ThisBindingAncestor = 'static-block' | 'heritage-clause' | 'class' | 'other';

/**
 * Resolves a template's `this` binding from its ancestors, innermost first:
 * the first static block, heritage clause or class met decides.
 */
export function thisBindingFromAncestors(
  ancestors: Iterable<ThisBindingAncestor>,
): TemplateThisBinding {
  for (let ancestor of ancestors) {
    switch (ancestor) {
      case 'static-block':
        return 'backing-class';
      case 'heritage-clause':
        return 'context';
      case 'class':
        return 'lexical';
    }
  }
  return 'context';
}

/**
 * Given a TS AST node for an embedded template, determines how the template's
 * `{{this}}` should be bound. See {@link TemplateThisBinding}.
 */
export function templateThisBinding(ts: TSLib, node: ts.Node): TemplateThisBinding {
  return thisBindingFromAncestors(
    (function* () {
      for (let current = node.parent; current; current = current.parent) {
        if (ts.isClassStaticBlockDeclaration(current)) yield 'static-block';
        else if (ts.isHeritageClause(current)) yield 'heritage-clause';
        else if (ts.isClassLike(current)) yield 'class';
      }
    })(),
  );
}

/**
 * The JavaScript names in scope at a template, as Babel's `scope.getBinding` gives Ember's
 * `lexicalScope`. Class members and type-only imports are not bindings.
 */
export function templateLexicalBindings(ts: TSLib, node: ts.Node): Set<string> {
  let names = new Set<string>();
  let addName = (name: ts.BindingName | ts.Identifier | undefined): void => {
    if (!name) return;
    if (ts.isIdentifier(name)) {
      names.add(name.text);
    } else {
      for (let element of name.elements) {
        if (!ts.isOmittedExpression(element)) addName(element.name);
      }
    }
  };
  let addStatements = (statements: ts.NodeArray<ts.Statement>): void => {
    for (let statement of statements) {
      if (ts.isVariableStatement(statement)) {
        statement.declarationList.declarations.forEach((d) => addName(d.name));
      } else if (
        ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)
      ) {
        addName(statement.name);
      } else if (ts.isModuleDeclaration(statement) && ts.isIdentifier(statement.name)) {
        addName(statement.name);
      } else if (ts.isImportEqualsDeclaration(statement) && !statement.isTypeOnly) {
        addName(statement.name);
      } else if (ts.isImportDeclaration(statement)) {
        let clause = statement.importClause;
        if (!clause || clause.isTypeOnly) continue;
        addName(clause.name);
        let bindings = clause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) {
          addName(bindings.name);
        } else if (bindings) {
          for (let element of bindings.elements) {
            if (!element.isTypeOnly) addName(element.name);
          }
        }
      }
    }
  };
  let addHoistedVars = (scope: ts.Node): void => {
    ts.forEachChild(scope, function visit(child): void {
      if (
        ts.isFunctionLike(child) ||
        ts.isClassLike(child) ||
        ts.isClassStaticBlockDeclaration(child) ||
        ts.isModuleDeclaration(child)
      ) {
        return;
      }
      if (ts.isVariableDeclarationList(child) && !(child.flags & ts.NodeFlags.BlockScoped)) {
        child.declarations.forEach((d) => addName(d.name));
      }
      ts.forEachChild(child, visit);
    });
  };

  for (let scope = node.parent; scope; scope = scope.parent) {
    if (ts.isSourceFile(scope) || ts.isBlock(scope) || ts.isModuleBlock(scope)) {
      addStatements(scope.statements);
    } else if (ts.isCaseBlock(scope)) {
      scope.clauses.forEach((clause) => addStatements(clause.statements));
    } else if (
      (ts.isForStatement(scope) || ts.isForInStatement(scope) || ts.isForOfStatement(scope)) &&
      scope.initializer &&
      ts.isVariableDeclarationList(scope.initializer)
    ) {
      scope.initializer.declarations.forEach((d) => addName(d.name));
    } else if (ts.isCatchClause(scope)) {
      addName(scope.variableDeclaration?.name);
    } else if (ts.isClassLike(scope)) {
      addName(scope.name);
    } else if (ts.isFunctionLike(scope)) {
      scope.parameters.forEach((p) => addName(p.name));
      if (ts.isFunctionExpression(scope)) addName(scope.name);
    }

    if (ts.isSourceFile(scope) || ts.isClassStaticBlockDeclaration(scope)) {
      addHoistedVars(scope);
    } else if (ts.isFunctionLike(scope) && 'body' in scope && scope.body) {
      addHoistedVars(scope.body);
    }
  }
  return names;
}
