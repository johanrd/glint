import './elements';
import './custom-elements';
import { AttrValue } from '../index';
import type { ComponentReturn, InvokableInstance } from '../integration';
import type { HTMLElementMap, SVGElementMap } from './lib.dom.augmentation';

/**
 * A utility for constructing the type of an environment's `resolveOrReturn` from
 * the type of its `resolve` function.
 */
export type ResolveOrReturn<T> = T & (<U>(item: U) => () => U);

/**
 * Given a tag name, returns an appropriate `Element` subtype.
 * NOTE: This will return a union for elements that exist both in HTML and SVG. Technically, this will be too permissive.
 */
export type ElementForTagName<Name extends string> = Name extends keyof HTMLElementTagNameMap
  ? HTMLElementTagNameMap[Name]
  : Name extends keyof GlintCustomElementTagNameMap
    ? GlintCustomElementTagNameMap[Name] extends Element
      ? GlintCustomElementTagNameMap[Name]
      : Element
    : Element;

/**
 * Where an element with a static `name` renders inside a `<form>`, as found by
 * the template transform: `once` whenever the form renders, `maybe` inside a
 * conditional block, `many` inside `{{#each}}` or a component's contents. The
 * element is a tag name, or the `Element` of a component the `name` was passed to.
 */
export type FormControlOccurrence = [
  element: unknown,
  presence: 'once' | 'maybe' | 'many',
  radioValue?: string,
];

/** The `Element` of a component's signature: where its `...attributes` land. */
export type ComponentElement<C> = C extends abstract new (
  ...args: any
) => InvokableInstance<infer F>
  ? ReturnType<F> extends ComponentReturn<any, infer El>
    ? El
    : never
  : never;

type OccurrenceElement<E> = E extends string ? ElementForTagName<E> : E;

// The HTML spec's "listed elements" are the ones with the constraint validation API.
type ListedOccurrences<T> = T extends [infer Head extends FormControlOccurrence, ...infer Rest]
  ? OccurrenceElement<Head[0]> extends { willValidate: boolean; form: HTMLFormElement | null }
    ? [Head, ...ListedOccurrences<Rest>]
    : ListedOccurrences<Rest>
  : [];

type OnceOccurrences<T> = T extends [infer Head extends FormControlOccurrence, ...infer Rest]
  ? Head[1] extends 'once'
    ? [Head, ...OnceOccurrences<Rest>]
    : OnceOccurrences<Rest>
  : [];

// When every control of a group is a radio with a static `value`, the group's
// value is one of them, or '' while none is checked.
type RadioGroup<T> =
  T extends Array<[unknown, unknown, infer Value extends string]>
    ? RadioNodeList & { value: Value | '' }
    : RadioNodeList;

// `form.elements[name]` is the control itself when one renders, and a
// `RadioNodeList` when several do.
type FormControlFor<T> = T extends [[infer E, 'once' | 'maybe', ...unknown[]]]
  ? OccurrenceElement<E>
  : OnceOccurrences<T> extends [unknown, unknown, ...unknown[]]
    ? RadioGroup<T>
    : T extends Array<[infer E, unknown, ...unknown[]]>
      ? OccurrenceElement<E> | RadioGroup<T>
      : never;

// A collection member of the same name (`length`, `item`, `namedItem`) wins
// over the control.
type FormControlName<K, T, Presence> = K extends keyof HTMLFormControlsCollection
  ? never
  : ListedOccurrences<T> extends []
    ? never
    : OnceOccurrences<ListedOccurrences<T>> extends []
      ? Presence extends 'optional'
        ? K
        : never
      : Presence extends 'required'
        ? K
        : never;

/**
 * The named controls of a `<form>`'s `elements` collection, given the named
 * elements the transform found in its contents.
 */
export type FormControls<Found extends Record<string, Array<FormControlOccurrence>>> = Flatten<
  {
    [K in keyof Found as FormControlName<K, Found[K], 'required'>]: FormControlFor<
      ListedOccurrences<Found[K]>
    >;
  } & {
    [K in keyof Found as FormControlName<K, Found[K], 'optional'>]?: FormControlFor<
      ListedOccurrences<Found[K]>
    >;
  }
>;

// Resolves to one object type, so errors print the controls rather than an alias.
type Flatten<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

export type SVGElementForTagName<Name extends string> = Name extends keyof SVGElementTagNameMap
  ? SVGElementTagNameMap[Name]
  : Element;

export type MathMlElementForTagName<Name extends string> =
  Name extends keyof MathMLElementTagNameMap ? MathMLElementTagNameMap[Name] : Element;

/**
 * This doesn't generate _totally_ unique mappings, but they all have the same attributes.
 *
 * For example, given T = HTMLDivElement,
 * we get back:
 *   - "HTMLTableCaptionElement"
 *     | "HTMLDivElement"
 *     | "HTMLHeadingElement"
 *     | "HTMLParagraphElement"
 *
 * And for the purposes of attribute lookup, that's good enough.
 */
type HTMLElementLookup<T> = {
  [K in keyof HTMLElementMap]: T extends HTMLElementMap[K]
    ? HTMLElementMap[K] extends T
      ? K
      : never
    : never;
}[keyof HTMLElementMap];

type SVGElementLookup<T> = {
  [K in keyof SVGElementMap]: T extends SVGElementMap[K]
    ? SVGElementMap[K] extends T
      ? K
      : never
    : never;
}[keyof SVGElementMap];

export type WithDataAttributes<T> = T & Record<`data-${string}`, AttrValue>;

/**
 * Reverse lookup from an element instance type to its registered custom
 * element tag name(s), using the same bidirectional-assignability technique
 * as `HTMLElementLookup` above. `never` when the type isn't registered.
 */
type CustomElementLookup<T> = {
  [K in keyof GlintCustomElementTagNameMap]: [GlintCustomElementTagNameMap[K]] extends [T]
    ? [T] extends [GlintCustomElementTagNameMap[K]]
      ? K
      : never
    : never;
}[keyof GlintCustomElementTagNameMap];

/**
 * Attributes for a registered custom element tag name: strict when the tag
 * has an entry in `GlintCustomElementAttributesMap`, otherwise arbitrary
 * attribute values are accepted (custom elements take arbitrary attributes,
 * and we have no way to know which ones are meaningful).
 */
type AttributesForCustomElement<Name> = Name extends keyof GlintCustomElementAttributesMap
  ? WithDataAttributes<GlintCustomElementAttributesMap[Name]>
  : Record<string, AttrValue>;

export type AttributesForElement<T extends Element> = [CustomElementLookup<T>] extends [never]
  ? T extends HTMLElement
    ? [HTMLElementLookup<T>] extends [never]
      ? // An `HTMLElement` subclass we know nothing about, e.g. an unregistered
        // custom element class used as a component signature's `Element`.
        Record<string, AttrValue>
      : WithDataAttributes<GlintHtmlElementAttributesMap[HTMLElementLookup<T>]>
    : T extends SVGElement
      ? [SVGElementLookup<T>] extends [never]
        ? Record<string, AttrValue>
        : WithDataAttributes<GlintSvgElementAttributesMap[SVGElementLookup<T>]>
      : Record<string, AttrValue>
  : AttributesForCustomElement<CustomElementLookup<T>>;

/**
 * Attributes for an element written with the given tag name. Unlike
 * `AttributesForElement`, this can resolve attributes for custom elements
 * that only have an attributes registration (no element type registration),
 * since it looks up by name rather than by element type.
 */
export type AttributesForTagName<Name extends string> =
  Name extends keyof GlintCustomElementAttributesMap
    ? WithDataAttributes<GlintCustomElementAttributesMap[Name]>
    : Name extends keyof HTMLElementTagNameMap
      ? AttributesForElement<HTMLElementTagNameMap[Name]>
      : Record<string, AttrValue>;
