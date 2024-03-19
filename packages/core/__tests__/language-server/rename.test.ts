import { Project } from 'glint-monorepo-test-utils';
import { describe, beforeEach, afterEach, test, expect } from 'vitest';
import { stripIndent } from 'common-tags';

describe('Language Server: Renaming Symbols', () => {
  let project!: Project;

  beforeEach(async () => {
    project = await Project.create();
  });

  afterEach(async () => {
    await project.destroy();
  });

  test('querying an standalone template', () => {
    project.setGlintConfig({ environment: 'ember-loose' });
    project.write('index.hbs', '<Foo as |foo|>{{foo}}</Foo>');

    let server = project.startLanguageServer();
    let workspaceEdits = server.getEditsForRename(
      project.fileURI('index.hbs'),
      { line: 0, character: 11 },
      'bar'
    );

    expect(workspaceEdits).toEqual({
      changes: {
        [project.fileURI('index.hbs')]: [
          {
            newText: 'bar',
            range: {
              start: { line: 0, character: 9 },
              end: { line: 0, character: 12 },
            },
          },
          {
            newText: 'bar',
            range: {
              start: { line: 0, character: 16 },
              end: { line: 0, character: 19 },
            },
          },
        ],
      },
    });
  });

  test('preparing rename-able and unrename-able elements', () => {
    project.write({
      'index.gts': stripIndent`
        import Component from '@glimmer/component';

        type GreetingArgs = {
          message: string;
        };

        export default class Greeting extends Component<{ Args: GreetingArgs }> {
          private foo = 'hi';

          <template>
            {{this.foo}}
            {{@missingArg}}
          </template>
        }
      `,
    });

    let server = project.startLanguageServer();
    let renameSuccessful = server.prepareRename(project.fileURI('index.gts'), {
      line: 10,
      character: 12,
    });

    expect(renameSuccessful).toEqual({
      start: { line: 10, character: 11 },
      end: { line: 10, character: 14 },
    });

    let renameFail = server.prepareRename(project.fileURI('index.gts'), {
      line: 11,
      character: 10,
    });

    expect(renameFail).toBeUndefined();
  });

  // TODO: skipped because renaming might not be fully implemented for .gts files
  test.skip('renaming an arg', () => {
    project.write({
      'greeting.gts': stripIndent`
        import Component from '@glimmer/component';

        export type GreetingArgs = {
          message: string;
        };

        export default class Greeting extends Component<{ Args: GreetingArgs }> {
          <template>{{@message}}, World!\`;
        }
      `,
      'index.gts': stripIndent`
        import Component from '@glimmer/component';
        import Greeting from './greeting';

        export class Application extends Component {
          <template>
            <Greeting @message="Hello" />
          </template>
        }
      `,
    });

    let server = project.startLanguageServer();
    let expectedWorkspaceEdit = {
      changes: {
        [project.fileURI('greeting.gts')]: [
          {
            newText: 'greeting',
            range: {
              end: { character: 9, line: 3 },
              start: { character: 2, line: 3 },
            },
          },
          {
            newText: 'greeting',
            range: {
              end: { character: 34, line: 7 },
              start: { character: 27, line: 7 },
            },
          },
        ],
        [project.fileURI('index.gts')]: [
          {
            newText: 'greeting',
            range: {
              end: { character: 22, line: 5 },
              start: { character: 15, line: 5 },
            },
          },
        ],
      },
    };

    // Rename `@message` at the point where we pass it to the component
    let renamePassedArg = server.getEditsForRename(
      project.fileURI('index.gts'),
      { line: 5, character: 17 },
      'greeting'
    );

    expect(renamePassedArg).toEqual(expectedWorkspaceEdit);

    // Rename `@message` where we use it in the template
    let renameReferencedArg = server.getEditsForRename(
      project.fileURI('greeting.gts'),
      { line: 7, character: 31 },
      'greeting'
    );

    expect(renameReferencedArg).toEqual(expectedWorkspaceEdit);

    // Rename `@message` where we its type is declared
    let renameDeclaredArg = server.getEditsForRename(
      project.fileURI('greeting.gts'),
      { line: 3, character: 2 },
      'greeting'
    );

    expect(renameDeclaredArg).toEqual(expectedWorkspaceEdit);
  });

  test('renaming a block param', () => {
    project.write({
      'index.gts': stripIndent`
        import Component from '@glimmer/component';

        export default class Application extends Component {
          <template>
            {{#each (array 'a' 'b' 'c') as |letter|}}
              {{letter}}
            {{/each}}
          </template>
        }
      `,
    });

    let server = project.startLanguageServer();
    let expectedWorkspaceEdit = {
      changes: {
        [project.fileURI('index.gts')]: [
          {
            newText: 'character',
            range: {
              start: { line: 4, character: 36 },
              end: { line: 4, character: 42 },
            },
          },
          {
            newText: 'character',
            range: {
              start: { line: 5, character: 8 },
              end: { line: 5, character: 14 },
            },
          },
        ],
      },
    };

    // Rename the param where it's defined in bars
    let renameDefinition = server.getEditsForRename(
      project.fileURI('index.gts'),
      { line: 4, character: 38 },
      'character'
    );

    expect(renameDefinition).toEqual(expectedWorkspaceEdit);

    // Rename the param where it's used in curlies
    let renameUsage = server.getEditsForRename(
      project.fileURI('index.gts'),
      { line: 5, character: 10 },
      'character'
    );

    expect(renameUsage).toEqual(expectedWorkspaceEdit);
  });

  test('renaming a component', async () => {
    project.write({
      'greeting.gts': stripIndent`
        import Component from '@glimmer/component';

        export type GreetingArgs = {
          message: string;
        };

        export default class Greeting extends Component<{ Args: GreetingArgs }> {
          <template>{{@message}}, World!\`;
        }
      `,
      'index.gts': stripIndent`
        import Component from '@glimmer/component';
        import Greeting from './greeting';

        export class Application extends Component {
          <template>
            <Greeting @message="Hello" />
          </template>
        }
      `,
    });

    let server = project.startLanguageServer();
    let expectedWorkspaceEdit = {
      changes: {
        [project.fileURI('greeting.gts')]: [
          {
            newText: 'Salutation',
            range: {
              start: { line: 6, character: 21 },
              end: { line: 6, character: 29 },
            },
          },
        ],
        [project.fileURI('index.gts')]: [
          {
            newText: 'Salutation',
            range: {
              start: { line: 1, character: 7 },
              end: { line: 1, character: 15 },
            },
          },
          {
            newText: 'Salutation',
            range: {
              start: { line: 5, character: 5 },
              end: { line: 5, character: 13 },
            },
          },
        ],
      },
    };

    // Rename the component class where it's defined
    let renameDefinition = server.getEditsForRename(
      project.fileURI('greeting.gts'),
      { line: 6, character: 24 },
      'Salutation'
    );

    expect(renameDefinition).toEqual(expectedWorkspaceEdit);

    // Rename the component class from where it's invoked
    let renameUsage = server.getEditsForRename(
      project.fileURI('index.gts'),
      { line: 5, character: 9 },
      'Salutation'
    );

    expect(renameUsage).toEqual(expectedWorkspaceEdit);
  });
});
