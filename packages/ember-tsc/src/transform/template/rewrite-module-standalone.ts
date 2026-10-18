import { toTree, VisitorPath } from 'ember-estree';
import * as path from 'node:path';
import { GlintEnvironment } from '../../config/index.js';
import type { PreprocessData } from '../../environment-ember-template-imports/-private/environment/common.js';
import {
  EmbeddedTemplate,
  ImportedBindings,
  PartialCorrelatedSpan,
  TemplateThisBinding,
  ThisBindingAncestor,
  thisBindingFromAncestors,
} from './inlining/index.js';
import { calculateTemplateSpans } from './inlining/tagged-strings.js';
import {
  buildTransformedModule,
  parseError,
  RewriteInput,
  toTransformError,
} from './rewrite-module.js';
import TransformedModule, { Directive, TransformError } from './transformed-module.js';

/**
 * What the transform needs to know about a script beyond its text: which
 * names it imports, and where each `<template>` sits. `rewriteModule` reads
 * this off the TypeScript AST; this entry reads it off ember-estree's.
 */
type ScriptAnalysis = {
  /** oxc's diagnostics for the script; see `rewriteModuleStandalone`. */
  errors: Array<ScriptError>;
  imports: ImportedBindings;
  /**
   * Keyed by the offset of each template's `<template>` tag. A template with
   * no entry is emitted as a context-bound expression (`{{this}}` is the
   * template context) with no `export default`.
   */
  placements: Map<number, TemplatePlacement>;
};

type ScriptError = { message: string; labels?: Array<{ start: number; end: number }> };

type TemplatePlacement = {
  thisBinding: TemplateThisBinding;
  /**
   * Whether the template is the whole of an expression statement: the RFC 931
   * implicit `export default` form.
   */
  isExpressionStatement: boolean;
  lexicalBindings: Set<string>;
};

/**
 * Like `rewriteModule`, but without a TypeScript compiler API.
 *
 * The script is analyzed with ember-estree (content-tag + oxc-parser), so
 * embedders that pair the transform with a compiler that has no JS API
 * (TypeScript 7, build plugins, content mappers) do not need a second
 * TypeScript install just to run the transform. The output is identical to
 * `rewriteModule`'s for the same input.
 *
 * oxc does not recover from script syntax errors the way TypeScript's parser
 * does. When it reports any, this entry does what `rewriteModule` does when
 * content-tag fails to parse the file: the raw source is kept as the
 * transformed text with verification disabled, the error is recorded on
 * `errors`, and the type-checker's own (recovering) parser powers completions
 * in the script until it parses again. Templates in such a file are not
 * checked until then, exactly as on the content-tag path.
 *
 * Exposed only as `@glint/ember-tsc/transform/standalone` so that the
 * language server, tsserver plugin and `ember-tsc` never load ember-estree
 * (and oxc-parser's native binary).
 */
export function rewriteModuleStandalone(
  { script }: RewriteInput,
  environment: GlintEnvironment,
): TransformedModule | null {
  let { filename, contents } = script;
  let { preprocess } = environment.getConfigForExtension(path.extname(filename)) ?? {};

  if (!preprocess) {
    return null;
  }

  let errors: Array<TransformError> = [];
  let directives: Array<Directive> = [];
  let partialSpans: Array<PartialCorrelatedSpan> = [];

  let data: PreprocessData;
  try {
    data = preprocess(contents, filename).data;
  } catch (e) {
    errors.push(toTransformError(parseError(e, filename), script));
    return buildTransformedModule(script, { errors, directives, partialSpans });
  }

  if (!data.templateLocations.length) {
    return null;
  }

  let {
    errors: scriptErrors,
    imports,
    placements,
  } = analyzeScript(blankTemplateBodies(contents, data), filename);

  if (scriptErrors.length) {
    let [{ message, labels }] = scriptErrors;
    let start = Math.min(labels?.[0]?.start ?? 0, Math.max(0, contents.length - 1));
    errors.push({
      // Recorded as a content-tag error because that is the flag the
      // consumers key on to keep the raw source and disable verification;
      // see `TransformedModule#toVolarMappings`.
      isContentTagError: true,
      message,
      source: script,
      location: { start, end: Math.min(start + 1, contents.length) },
    });
    return buildTransformedModule(script, { errors, directives, partialSpans });
  }

  for (let location of data.templateLocations) {
    let start = location.startTagOffset;
    let end = location.endTagOffset + location.endTagLength;
    let contentStart = location.startTagOffset + location.startTagLength;
    let contentEnd = location.endTagOffset;
    let placement = placements.get(start);

    let embedded: EmbeddedTemplate = {
      template: contents.slice(contentStart, contentEnd),
      templateLocation: { start, end, contentStart, contentEnd },
      thisBinding: placement?.thisBinding ?? 'context',
      lexicalBindings: placement?.lexicalBindings,
    };

    if (location.type === 'class-member') {
      // The class's own template. `rewriteModule` rewrites the preprocessed
      // `;[___T`...`]` member into a static block and emits the template
      // inside it; see `isETITemplateProperty` in the environment transform.
      embedded.thisBinding = 'backing-class';
      embedded.prepend = 'static { ';
      embedded.append = ' }';
    } else if (placement?.isExpressionStatement) {
      // A template that is the whole of an expression statement is the
      // implicit default export (RFC 931); see `isETIDefaultTemplate` and
      // `isETIDefaultSatisfiesTemplate` in the environment transform.
      embedded.prepend = 'export default ';
    }

    let result = calculateTemplateSpans(embedded, imports, script, environment);
    errors.push(...result.errors);
    directives.push(...result.directives);
    partialSpans.push(...result.partialSpans);
  }

  return buildTransformedModule(script, { errors, directives, partialSpans });
}

type Node = { type: string; start?: number; end?: number };

type ImportDeclaration = Node & {
  source: { value: string };
  specifiers: Array<
    Node & { local: { name: string }; imported?: { name?: string; value?: string } }
  >;
};

type ClassNode = Node & { superClass?: Node | null; implements?: Array<Node> };

// ember-estree splices a `GlimmerTemplate` in place of the whole expression
// statement when the two span the same range, so the template's parent is
// then the statement list itself rather than the `ExpressionStatement`.
const STATEMENT_LISTS = new Set(['Program', 'BlockStatement', 'StaticBlock', 'SwitchCase']);

/**
 * Replaces the body of every `<template>` with spaces of the same length.
 * Only the script is analyzed here; the templates are parsed by
 * `calculateTemplateSpans`, which also reports their errors. Blanking them
 * keeps every offset the same, spares ember-estree a second handlebars parse
 * of each one, and means a template that does not parse cannot abort the
 * script analysis.
 */
function blankTemplateBodies(contents: string, data: PreprocessData): string {
  let out = '';
  let cursor = 0;
  for (let location of data.templateLocations) {
    let contentStart = location.startTagOffset + location.startTagLength;
    let contentEnd = location.endTagOffset;
    out += contents.slice(cursor, contentStart);
    out += contents.slice(contentStart, contentEnd).replace(/[^\n]/g, ' ');
    cursor = contentEnd;
  }
  return out + contents.slice(cursor);
}

/**
 * Reads import bindings and the syntactic placement of every template off
 * ember-estree's traversal of the module. See `rewriteModuleStandalone` for
 * what happens when the script does not parse.
 */
function analyzeScript(contents: string, filename: string): ScriptAnalysis {
  let imports: ImportedBindings = {};
  let placements = new Map<number, TemplatePlacement>();
  let errors: Array<ScriptError> = [];

  let file = toTree(contents, {
    filePath: filename,
    visitors: {
      ImportDeclaration(node) {
        collectImportedBindings(node as ImportDeclaration, imports);
      },
      GlimmerTemplate(node, path) {
        placements.set(node.start as number, {
          thisBinding: thisBindingFromAncestors(ancestorsOf(path)),
          isExpressionStatement: isExpressionStatement(path),
          lexicalBindings: lexicalBindingsOf(path),
        });
      },
    },
  });

  if ('errors' in file) errors = file.errors as Array<ScriptError>;

  return { errors, imports, placements };
}

function* ancestorsOf(path: VisitorPath): Generator<ThisBindingAncestor> {
  for (
    let child = path, parent = path.parentPath;
    parent;
    child = parent, parent = parent.parentPath
  ) {
    let node = parent.node;
    switch (node.type) {
      case 'StaticBlock':
        yield 'static-block';
        break;
      case 'ClassDeclaration':
      case 'ClassExpression': {
        let { superClass, implements: implemented } = node as ClassNode;
        if (superClass === child.node || implemented?.includes(child.node)) yield 'heritage-clause';
        break;
      }
      case 'ClassBody':
        yield 'class';
        break;
    }
  }
}

function isExpressionStatement(path: VisitorPath): boolean {
  let parent = path.parent;
  if (parent?.type === 'TSSatisfiesExpression') {
    return path.parentPath?.parent?.type === 'ExpressionStatement';
  }
  return (
    parent !== null && (parent.type === 'ExpressionStatement' || STATEMENT_LISTS.has(parent.type))
  );
}

function collectImportedBindings(statement: ImportDeclaration, result: ImportedBindings): void {
  let { source, specifiers } = statement;
  for (let specifier of specifiers) {
    if (specifier.type === 'ImportDefaultSpecifier') {
      result[specifier.local.name] = {
        specifier: 'default',
        source: source.value,
        synthetic: false,
      };
    } else if (specifier.type === 'ImportSpecifier' && specifier.imported) {
      result[specifier.local.name] = {
        specifier: specifier.imported.name ?? specifier.imported.value ?? specifier.local.name,
        source: source.value,
        synthetic: false,
      };
    }
  }
}

type Pattern = Node & {
  name?: string;
  left?: Pattern;
  value?: Pattern;
  argument?: Pattern;
  parameter?: Pattern;
  properties?: Array<Pattern>;
  elements?: Array<Pattern | null>;
};

type ScopeNode = Node & {
  id?: Pattern | null;
  params?: Array<Pattern>;
  param?: Pattern | null;
  body?: Node | Array<Node>;
  init?: Node | null;
  left?: Node;
  discriminant?: Node;
  cases?: Array<{ consequent: Array<Node> }>;
};

type DeclarationNode = Node & {
  kind?: string;
  importKind?: string;
  declarations?: Array<{ id: Pattern }>;
  id?: Pattern | null;
  declaration?: DeclarationNode | null;
  specifiers?: Array<Node & { importKind?: string | null; local: Pattern }>;
};

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const VAR_SCOPE_BOUNDARIES = new Set([
  ...FUNCTIONS,
  'ClassDeclaration',
  'ClassExpression',
  'StaticBlock',
  'TSModuleDeclaration',
  'GlimmerTemplate',
]);

/**
 * The ESTree counterpart of `templateLexicalBindings`; the two must agree.
 */
function lexicalBindingsOf(path: VisitorPath): Set<string> {
  let names = new Set<string>();
  let addName = (pattern: Pattern | null | undefined): void => {
    if (!pattern) return;
    switch (pattern.type) {
      case 'Identifier':
        names.add(pattern.name as string);
        break;
      case 'TSQualifiedName':
      case 'AssignmentPattern':
        addName(pattern.left);
        break;
      case 'Property':
        addName(pattern.value);
        break;
      case 'RestElement':
        addName(pattern.argument);
        break;
      case 'TSParameterProperty':
        addName(pattern.parameter);
        break;
      case 'ObjectPattern':
        pattern.properties?.forEach(addName);
        break;
      case 'ArrayPattern':
        pattern.elements?.forEach(addName);
        break;
    }
  };
  let addDeclaration = (node: DeclarationNode | null | undefined): void => {
    switch (node?.type) {
      case 'VariableDeclaration':
        node.declarations?.forEach((d) => addName(d.id));
        break;
      case 'FunctionDeclaration':
      case 'ClassDeclaration':
      case 'TSEnumDeclaration':
      case 'TSModuleDeclaration':
        addName(node.id);
        break;
      case 'TSImportEqualsDeclaration':
        if (node.importKind !== 'type') addName(node.id);
        break;
      case 'ImportDeclaration':
        if (node.importKind === 'type') break;
        for (let specifier of node.specifiers ?? []) {
          if (specifier.importKind !== 'type') addName(specifier.local);
        }
        break;
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
        addDeclaration(node.declaration);
        break;
    }
  };
  let addHoistedVars = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(addHoistedVars);
    if (!node || typeof node !== 'object') return;
    let { type, kind } = node as DeclarationNode;
    if (VAR_SCOPE_BOUNDARIES.has(type)) return;
    if (type === 'VariableDeclaration' && kind === 'var') addDeclaration(node as DeclarationNode);
    for (let value of Object.values(node)) {
      if (value && typeof value === 'object') addHoistedVars(value);
    }
  };

  for (let child = path, scope = path.parentPath; scope; child = scope, scope = scope.parentPath) {
    let node = scope.node as ScopeNode;
    switch (node.type) {
      case 'Program':
      case 'BlockStatement':
      case 'StaticBlock':
      case 'TSModuleBlock':
        (node.body as Array<DeclarationNode>).forEach(addDeclaration);
        break;
      case 'SwitchStatement':
        if (child.node !== node.discriminant) {
          node.cases?.forEach((c) => c.consequent.forEach(addDeclaration));
        }
        break;
      case 'ForStatement':
        addDeclaration(node.init);
        break;
      case 'ForInStatement':
      case 'ForOfStatement':
        addDeclaration(node.left);
        break;
      case 'CatchClause':
        addName(node.param);
        break;
      case 'ClassDeclaration':
      case 'ClassExpression':
        addName(node.id);
        break;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        node.params?.forEach(addName);
        if (node.type === 'FunctionExpression') addName(node.id);
        break;
    }

    if (node.type === 'Program' || node.type === 'StaticBlock') {
      (node.body as Array<Node>).forEach(addHoistedVars);
    } else if (FUNCTIONS.has(node.type)) {
      addHoistedVars(node.body);
    }
  }
  return names;
}
