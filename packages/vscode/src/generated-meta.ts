// This file is generated by `vscode-ext-gen`. Do not modify manually.
// @see https://github.com/antfu/vscode-ext-gen

// Meta info
export const publisher = "typed-ember"
export const name = "glint-vscode"
export const version = "1.4.0"
export const displayName = "Glint"
export const description = "Glint language server integration for VS Code"
export const extensionId = `${publisher}.${name}`

/**
 * Type union of all commands
 */
export type CommandKey = 
  | "glint.restart-language-server"

/**
 * Commands map registed by `typed-ember.glint-vscode`
 */
export const commands = {
  /**
   * Glint: Restart Glint Server
   * @value `glint.restart-language-server`
   */
  restartLanguageServer: "glint.restart-language-server",
} satisfies Record<string, CommandKey>

/**
 * Type union of all configs
 */
export type ConfigKey = 
  | "glint.libraryPath"
  | "glint.trace.server"
  | "glint.server.compatibleExtensions"
  | "glint.server.includeLanguages"

export interface ConfigKeyTypeMap {
  "glint.libraryPath": (string | undefined),
  "glint.trace.server": ("off" | "messages" | "verbose"),
  "glint.server.compatibleExtensions": string[],
  "glint.server.includeLanguages": string[],
}

export interface ConfigShorthandMap {
  libraryPath: "glint.libraryPath",
  traceServer: "glint.trace.server",
  serverCompatibleExtensions: "glint.server.compatibleExtensions",
  serverIncludeLanguages: "glint.server.includeLanguages",
}

export interface ConfigShorthandTypeMap {
  libraryPath: (string | undefined),
  traceServer: ("off" | "messages" | "verbose"),
  serverCompatibleExtensions: string[],
  serverIncludeLanguages: string[],
}

export interface ConfigItem<T extends keyof ConfigKeyTypeMap> {
  key: T,
  default: ConfigKeyTypeMap[T],
}


/**
 * Configs map registered by `typed-ember.glint-vscode`
 */
export const configs = {
  /**
   * 
   * @key `glint.libraryPath`
   * @default `undefined`
   * @type `string`
   */
  libraryPath: {
    key: "glint.libraryPath",
    default: undefined,
  } as ConfigItem<"glint.libraryPath">,
  /**
   * Traces communication between VS Code and the Glint language server.
   * @key `glint.trace.server`
   * @default `"off"`
   * @type `string`
   */
  traceServer: {
    key: "glint.trace.server",
    default: "off",
  } as ConfigItem<"glint.trace.server">,
  /**
   * Set compatible extensions to skip automatic detection of Hybrid Mode.
   * @key `glint.server.compatibleExtensions`
   * @default `[]`
   * @type `array`
   */
  serverCompatibleExtensions: {
    key: "glint.server.compatibleExtensions",
    default: [],
  } as ConfigItem<"glint.server.compatibleExtensions">,
  /**
   * 
   * @key `glint.server.includeLanguages`
   * @default `["glimmer-js","glimmer-ts","handlebars"]`
   * @type `array`
   */
  serverIncludeLanguages: {
    key: "glint.server.includeLanguages",
    default: ["glimmer-js","glimmer-ts","handlebars"],
  } as ConfigItem<"glint.server.includeLanguages">,
}

export interface ScopedConfigKeyTypeMap {
  "libraryPath": (string | undefined),
  "trace.server": ("off" | "messages" | "verbose"),
  "server.compatibleExtensions": string[],
  "server.includeLanguages": string[],
}

export const scopedConfigs = {
  scope: "glint",
  defaults: {
    "libraryPath": undefined,
    "trace.server": "off",
    "server.compatibleExtensions": [],
    "server.includeLanguages": ["glimmer-js","glimmer-ts","handlebars"],
  } satisfies ScopedConfigKeyTypeMap,
}

export interface NestedConfigs {
  "glint": {
    "libraryPath": (string | undefined),
    "trace": {
      "server": ("off" | "messages" | "verbose"),
    },
    "server": {
      "compatibleExtensions": string[],
      "includeLanguages": string[],
    },
  },
}

export interface NestedScopedConfigs {
  "libraryPath": (string | undefined),
  "trace": {
    "server": ("off" | "messages" | "verbose"),
  },
  "server": {
    "compatibleExtensions": string[],
    "includeLanguages": string[],
  },
}

