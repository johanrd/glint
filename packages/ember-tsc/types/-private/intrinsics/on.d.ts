import { ModifierLike } from '@glint/template';

export interface OnModifierArgs {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
}

export type EventForName<Name extends string> = Name extends keyof HTMLElementEventMap
  ? HTMLElementEventMap[Name]
  : Event;

type Listener<Name extends string, El> = (
  event: EventForName<Name> & { currentTarget: El },
) => void;

type DeclaredElements<Handler> = 0 extends 1 & Handler
  ? never
  : Handler extends (event: infer Event) => unknown
    ? Event extends { currentTarget: { elements: infer Elements } }
      ? Elements
      : never
    : never;

/**
 * Checks the `elements` a handler declares against the form's, also where
 * parameter types are compared bivariantly: every declared control, optional
 * ones included, must be one the form renders.
 */
type FormControlsCheck<Handler, El> = El extends { elements: infer Found }
  ? [DeclaredElements<Handler>] extends [never]
    ? unknown
    : [Exclude<keyof DeclaredElements<Handler>, keyof Found>] extends [never]
      ? [Found] extends [DeclaredElements<Handler>]
        ? unknown
        : { 'form controls do not match': DeclaredElements<Handler> }
      : { 'not rendered by this form': Exclude<keyof DeclaredElements<Handler>, keyof Found> }
  : unknown;

export type OnModifier = abstract new <
  Name extends string,
  El extends Element = Element,
  Handler extends Listener<Name, El> = Listener<Name, El>,
>() => InstanceType<
  ModifierLike<{
    Element: El;
    Args: {
      Named: OnModifierArgs;
      Positional: [name: Name, callback: Handler & FormControlsCheck<Handler, El>];
    };
  }>
>;
