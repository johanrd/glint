import { assert } from '../util.js';

/**
 * A `ScopeStack` is used while traversing a template
 * to track what identifiers are currently in scope.
 */
export default class ScopeStack {
  private stack: Array<Set<string>>;
  // Ref-counted identifiers from bind-invokable subexpressions (#1068).
  // When these are passed as args to other components, they need `as any`
  // to prevent their independent generic from overriding consumer T inference.
  // Ref-counted so nested {{#let}} blocks with the same name work correctly.
  private bindInvokableRefs = new Map<string, number>();

  public constructor(identifiers: string[]) {
    this.stack = [new Set(identifiers)];
  }

  public push(identifiers: Array<string>): void {
    let scope = new Set(this.top);
    for (let identifier of identifiers) {
      scope.add(identifier);
    }
    this.stack.unshift(scope);
  }

  public pop(): void {
    assert(this.stack.length > 1);
    this.stack.shift();
  }

  public hasBinding(identifier: string): boolean {
    return this.top.has(identifier);
  }

  public markBindInvokable(identifier: string): void {
    this.bindInvokableRefs.set(identifier, (this.bindInvokableRefs.get(identifier) ?? 0) + 1);
  }

  public unmarkBindInvokable(identifier: string): void {
    let count = (this.bindInvokableRefs.get(identifier) ?? 1) - 1;
    if (count <= 0) this.bindInvokableRefs.delete(identifier);
    else this.bindInvokableRefs.set(identifier, count);
  }

  public isBindInvokable(identifier: string): boolean {
    return this.bindInvokableRefs.has(identifier);
  }

  private get top(): Set<string> {
    return this.stack[0];
  }
}
