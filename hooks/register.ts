import type { Register } from 'claude-code'

import { CANCEL, classify, compile, decide, denyText, invalidText, PROCEED, questionFor } from './logic'

export const register: Register = (on, options) => {
  const compiled = compile(options)

  // Report invalid patterns once per load; the valid ones stay in force.
  on('session.start', ($, e, next) => {
    if (compiled.invalid.length > 0) {
      try {
        $.ui.toast(invalidText(compiled.invalid))
      } catch {
        // No surface to show it on: nothing to do.
      }
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    // A subagent's call has no screen of its own; the parent decides, so it passes.
    if (e.agentId !== undefined) return next(e)

    const hit = classify(e, compiled)
    if (hit === null) return next(e)

    let answer: unknown
    try {
      answer = await $.ui.ask(questionFor(hit), [PROCEED, CANCEL])
    } catch {
      // No surface (-p) or the question was dismissed: treated as no answer, which passes.
      answer = undefined
    }

    if (decide(answer) === 'pass') return next(e)

    return { deny: denyText(hit) }
  }).catch(($, e, next) =>
    // If the hook itself fails, pass rather than block; a settings hook is the real guard.
    next(e),
  )
}
