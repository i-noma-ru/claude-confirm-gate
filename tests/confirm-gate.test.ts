import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { classify, compile, decide } from '../hooks/logic'

const SCRIPT = '/home/me/app/scripts/deploy.sh'
const SOURCE = '/home/me/app/src/x.ts'

/** Bottom hook: answers every AskUserQuestion with `label` and counts the questions. */
function answersAsk(on: On, label: string): { count: () => number; last: () => string } {
  let count = 0
  let last = ''

  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => {
    count++
    const question = e.questions[0]?.question ?? ''
    last = question

    return { result: { questions: e.questions, answers: { [question]: label } } }
  })

  return { count: () => count, last: () => last }
}

/** Bottom hook (one per test): the gated tools are never run; their calls answer "reached" and are counted per tool. */
function marksReached(on: On, ...tools: readonly string[]): { count: (tool: string) => number } {
  const reached = new Map<string, number>()

  on('tool.call', ($, e, next) => {
    const tool = String(e.tool)
    if (!tools.includes(tool)) return next(e)
    reached.set(tool, (reached.get(tool) ?? 0) + 1)

    return { deny: 'reached' }
  })

  return { count: tool => reached.get(tool) ?? 0 }
}

test('defaults: a force push asks, a plain push passes without asking (negative)', async ($, on) => {
  const asked = answersAsk(on, 'Cancel')
  const bash = marksReached(on, 'Bash')

  const forced = await $.tool.call({ tool: 'Bash', command: 'git push --force origin main' })
  expect(forced.deny).toContain('Cancelled by the user (confirm-gate)')
  expect(asked.count()).toBe(1)
  expect(asked.last()).toContain('git push --force origin main')
  expect(bash.count('Bash')).toBe(0)

  const plain = await $.tool.call({ tool: 'Bash', command: 'git push origin main' })
  expect(plain.deny).toBe('reached')
  expect(asked.count()).toBe(1)
  expect(bash.count('Bash')).toBe(1)
})

test('defaults: git -C <dir> reset --hard asks', async ($, on) => {
  const asked = answersAsk(on, 'Cancel')
  marksReached(on, 'Bash')

  const done = await $.tool.call({ tool: 'Bash', command: 'git -C /home/me/app reset --hard' })

  expect(done.deny).toContain('reset --hard')
  expect(asked.count()).toBe(1)
})

test('options: bash_patterns replaces the defaults', { options: { bash_patterns: ['rm -rf'] } }, async ($, on) => {
  const asked = answersAsk(on, 'Cancel')
  const bash = marksReached(on, 'Bash')

  const rm = await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(rm.deny).toContain('rm -rf')
  expect(asked.count()).toBe(1)

  const push = await $.tool.call({ tool: 'Bash', command: 'git push --force origin main' })
  expect(push.deny).toBe('reached')
  expect(asked.count()).toBe(1)
  expect(bash.count('Bash')).toBe(1)
})

test('options: path_patterns gates Edit under the matched folder only', { options: { path_patterns: ['^/home/me/app/scripts/'] } }, async ($, on) => {
  const asked = answersAsk(on, 'Cancel')
  const tools = marksReached(on, 'Edit', 'Write')

  const gated = await $.tool.call({ tool: 'Edit', file_path: SCRIPT, old_string: 'a', new_string: 'b' })
  expect(gated.deny).toContain('^/home/me/app/scripts/')
  expect(asked.count()).toBe(1)
  expect(tools.count('Edit')).toBe(0)

  const other = await $.tool.call({ tool: 'Edit', file_path: SOURCE, old_string: 'a', new_string: 'b' })
  expect(other.deny).toBe('reached')
  expect(asked.count()).toBe(1)
  expect(tools.count('Edit')).toBe(1)

  // Backslash separators are normalized before the match.
  const windows = await $.tool.call({ tool: 'Write', file_path: SCRIPT.replace(/\//g, '\\'), content: 'x' })
  expect(windows.deny).toContain('Cancelled by the user')
  expect(asked.count()).toBe(2)
  expect(tools.count('Write')).toBe(0)
})

test('defaults: with path_patterns empty, Edit is never asked about (negative)', async ($, on) => {
  const asked = answersAsk(on, 'Cancel')
  const edit = marksReached(on, 'Edit')

  const done = await $.tool.call({ tool: 'Edit', file_path: SCRIPT, old_string: 'a', new_string: 'b' })

  expect(done.deny).toBe('reached')
  expect(asked.count()).toBe(0)
  expect(edit.count('Edit')).toBe(1)
})

test('hook: Proceed calls next once and the result is returned unchanged', async ($, on) => {
  const asked = answersAsk(on, 'Proceed')
  const bash = marksReached(on, 'Bash')

  const done = await $.tool.call({ tool: 'Bash', command: 'git push -f origin main' })

  expect(done.deny).toBe('reached')
  expect(asked.count()).toBe(1)
  expect(bash.count('Bash')).toBe(1)
})

test('hook: when ask throws, the call passes', async ($, on) => {
  on('tool.call', { tool: 'AskUserQuestion' }, () => {
    throw new Error('no surface')
  })
  const bash = marksReached(on, 'Bash')

  const done = await $.tool.call({ tool: 'Bash', command: 'git -C /home/me/app clean -fd' })

  expect(done.deny).toBe('reached')
  expect(bash.count('Bash')).toBe(1)
})

test('options: an invalid pattern is skipped and the valid ones still gate', { options: { bash_patterns: ['[', 'rm -rf'] } }, async ($, on) => {
  const asked = answersAsk(on, 'Cancel')
  const bash = marksReached(on, 'Bash')

  const rm = await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(rm.deny).toContain('rm -rf')
  expect(asked.count()).toBe(1)

  const ls = await $.tool.call({ tool: 'Bash', command: 'ls build' })
  expect(ls.deny).toBe('reached')
  expect(bash.count('Bash')).toBe(1)
})

test('compile: invalid patterns are reported, a single string is accepted, matching ignores case', () => {
  const compiled = compile({ bash_patterns: ['[', 'rm -rf'], path_patterns: 'src/' })

  expect(compiled.invalid.length).toBe(1)
  expect(compiled.invalid[0]).toContain('[')
  expect(compiled.bash.length).toBe(1)
  expect(compiled.path.length).toBe(1)
  expect(classify({ tool: 'Bash', command: 'RM -RF build' }, compiled)?.matched).toBe('rm -rf')
  expect(classify({ tool: 'Write', file_path: '/home/me/app/src/x.ts' }, compiled)?.target).toBe('/home/me/app/src/x.ts')
  expect(classify({ tool: 'Read', file_path: '/home/me/app/src/x.ts' }, compiled)).toBeNull()
})

test('decide: no answer or an empty one passes; any label other than Proceed cancels', () => {
  expect(decide(undefined)).toBe('pass')
  expect(decide('')).toBe('pass')
  expect(decide('Proceed')).toBe('pass')
  expect(decide('Cancel')).toBe('deny')
  expect(decide('stop it')).toBe('deny')
})
