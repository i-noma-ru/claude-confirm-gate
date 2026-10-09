/** A rule that matched: the pattern's source and the command or path it matched. */
export type GateHit = { matched: string; target: string }

/** The part of a `tool.call` event the gate reads (MCP variants may carry other shapes, so unknown). */
export type GateInput = {
  readonly tool: string
  readonly command?: unknown
  readonly file_path?: unknown
}

/** A compiled pattern with the text the person wrote (RegExp.source re-escapes it). */
export type Rule = { readonly source: string; readonly regexp: RegExp }

/** The patterns compiled once from the plugin's options. */
export type Compiled = {
  readonly bash: readonly Rule[]
  readonly path: readonly Rule[]
  /** Option values `new RegExp` refused, each with its error message. */
  readonly invalid: readonly string[]
}

export const PROCEED = 'Proceed'
export const CANCEL = 'Cancel'

const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit']

/** Accepts an array of strings or a single string; anything else contributes nothing. */
function listOf(value: unknown): string[] {
  const items: unknown[] = ([] as unknown[]).concat(value ?? [])

  return items.filter((item): item is string => typeof item === 'string' && item !== '')
}

function compileList(value: unknown, into: Rule[], invalid: string[]): void {
  for (const source of listOf(value)) {
    try {
      into.push({ source, regexp: new RegExp(source, 'i') })
    } catch (error) {
      invalid.push(`${source}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

/** Compiles `bash_patterns` and `path_patterns`; an invalid pattern is skipped and reported in `invalid`. */
export function compile(options: Readonly<Record<string, unknown>>): Compiled {
  const bash: Rule[] = []
  const path: Rule[] = []
  const invalid: string[] = []

  compileList(options['bash_patterns'], bash, invalid)
  compileList(options['path_patterns'], path, invalid)

  return { bash, path, invalid }
}

/** Windows `\` separators are compared as `/`. */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function firstMatch(rules: readonly Rule[], target: string): GateHit | null {
  for (const rule of rules) {
    if (rule.regexp.test(target)) return { matched: rule.source, target }
  }

  return null
}

/** The first rule that matches, or null (pure function). */
export function classify(e: GateInput, compiled: Compiled): GateHit | null {
  if (e.tool === 'Bash' && typeof e.command === 'string') return firstMatch(compiled.bash, e.command)

  if (EDIT_TOOLS.includes(String(e.tool)) && typeof e.file_path === 'string') {
    return firstMatch(compiled.path, normalizePath(e.file_path))
  }

  return null
}

/** The question for `$.ui.ask` (it has to end with a question mark). */
export function questionFor(hit: GateHit): string {
  return `Matched "${hit.matched}": ${hit.target}\nProceed?`
}

/** No answer or an empty one passes (a settings hook is the real guard); any label other than Proceed cancels. */
export function decide(answer: unknown): 'pass' | 'deny' {
  if (typeof answer !== 'string' || answer === '') return 'pass'

  return answer === PROCEED ? 'pass' : 'deny'
}

export function denyText(hit: GateHit): string {
  return `Cancelled by the user (confirm-gate): ${hit.matched}`
}

export function invalidText(invalid: readonly string[]): string {
  return `confirm-gate: ${invalid.length} pattern(s) ignored (invalid regular expression): ${invalid.join('; ')}`
}
