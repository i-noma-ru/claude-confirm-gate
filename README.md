# claude-confirm-gate

A small plugin ("mod") for Claude Code's terminal UI that pauses a risky shell command or file edit just before it runs and asks you to proceed or cancel with buttons.

日本語の説明は [README.ja.md](README.ja.md) にあります。

## When to use

- When a settings hook already *blocks* some commands and you would rather be *asked*: a hook can stop a call and print a reason, but only a mod can hold the call and show buttons.
- When there are a few files (release scripts, generated files, a config you hand-edit) that Claude should not change without a second look. Add their paths to `path_patterns`.

Not for you if you run Claude non-interactively (`claude -p`): with no screen, the question cannot be shown and the call goes through. This mod is a convenience, not a security boundary. Keep hard rules in your permission settings or a settings hook.

## What it looks like

When a call matches, a dialog appears before it runs:

```
Matched "git( -C \S+)? reset --hard": git -C /home/me/app reset --hard
Proceed?
  [Proceed]  [Cancel]
```

**Proceed** runs the call. **Cancel** (or any other answer) denies it, and Claude sees the denial reason. If no answer arrives (no screen, dialog dismissed, timeout), the call goes through.

## Requirements

- Built on Claude Code's plugin hooks ("mods") API, which is in early access and may change between versions.
- Developed and tested with Claude Code 2.1.295 on macOS.
- Windows is untested.

## Install

```
claude plugin marketplace add i-noma-ru/claude-confirm-gate
claude plugin install confirm-gate@claude-confirm-gate
```

Or for one session only, from a clone:

```
claude --plugin-dir /path/to/claude-confirm-gate
```

## Configuration

All settings have defaults. Change them with `/plugin configure confirm-gate@claude-confirm-gate`.

| Setting | Default | Meaning |
| --- | --- | --- |
| `bash_patterns` | `git( -C \S+)? push[^\n]* (--force\|-f)\b`, `git( -C \S+)? reset --hard`, `git( -C \S+)? clean -f`, `git( -C \S+)? checkout -- `, `git( -C \S+)? restore ` | JavaScript regular expressions (case-insensitive) tested against each Bash command. A match pauses the call. The optional `-C <dir>` group also catches `git -C /path reset --hard`. Patterns are tested against the whole command text, so a matching string inside a quoted argument, a `grep` pattern or a comment also pauses the call. |
| `path_patterns` | empty | Regular expressions tested against the `file_path` of Edit and Write calls (backslashes normalised to `/`). Empty ignores edits. |

An invalid regular expression is reported once with a toast when the mod loads and that entry is skipped; the others still apply.

## How it works

- On each tool call from the main conversation (subagent calls are passed through), the Bash command or the edit path is tested against the patterns. On a match the mod calls Claude Code's `$.ui.ask` with two options and waits for the answer before letting the call continue.
- The question is shown as an `AskUserQuestion` tool call, so other mods that react to `AskUserQuestion` (for example a mod that explains questions in a pane) will see it too.
- If the hook itself fails, the call goes through: the mod never blocks by accident.

## What the plugin reads

The command text of `Bash` calls and the `file_path` of `Edit` / `Write` calls. It reads no files and sends nothing anywhere.

## Tests

```
claude plugin validate .
claude plugin test .
```

## Notes

- Written with AI assistance (Claude Code).
- Companion mods by the same author: [claude-supervisor-pane](https://github.com/i-noma-ru/claude-supervisor-pane), [claude-decision-tracker](https://github.com/i-noma-ru/claude-decision-tracker). Each is independent.

## License

MIT. See [LICENSE](LICENSE).
