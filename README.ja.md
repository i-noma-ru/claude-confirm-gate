# claude-confirm-gate

Claude Code のターミナル画面で使う小さなプラグイン（MOD）です。危ないシェルコマンドやファイル編集を、実行の直前に止めて「進める／取り消す」のボタンで聞きます。

English: [README.md](README.md)

画面に出る文言は英語です。

## 使いどころ

- settings のフックで一部のコマンドを「止めて」いるが、本当は「聞いて」ほしいとき。フックは止めて理由を出すところまでで、呼び出しを保留してボタンを出せるのは MOD だけです。
- リリース用スクリプト・生成ファイル・手で直している設定など、Claude に黙って変えてほしくないファイルが少しあるとき。そのパスを `path_patterns` に足します。

向かないとき: 画面の無い実行（`claude -p`）。画面が無いと問いを出せないので、呼び出しは通ります。この MOD は手間を省く道具で、安全の境界ではありません。本当に守りたい規則は権限設定か settings のフックに置いてください。

## 動くとこう見える

当たる呼び出しの直前にダイアログが出ます。

```
Matched "git( -C \S+)? reset --hard": git -C /home/me/app reset --hard
Proceed?
  [Proceed]  [Cancel]
```

**Proceed** で実行します。**Cancel**（ほかの答えも同じ）で拒否し、Claude には拒否の理由が渡ります。答えが来ない（画面が無い・閉じた・時間切れ）ときは通します。

## 動作条件

- Claude Code のプラグインフック（MOD）API を使っています。この API は早期提供の段階で、版によって変わる可能性があります。
- Claude Code 2.1.295・macOS で開発・確認しました。
- Windows は確認していません。

## 導入

```
claude plugin marketplace add i-noma-ru/claude-confirm-gate
claude plugin install confirm-gate@claude-confirm-gate
```

クローンして、そのセッションだけ読み込むこともできます。

```
claude --plugin-dir /path/to/claude-confirm-gate
```

## 設定

すべて既定値があります。変えるときは `/plugin configure confirm-gate@claude-confirm-gate` で。

| 設定 | 既定 | 意味 |
| --- | --- | --- |
| `bash_patterns` | `git( -C \S+)? push[^\n]* (--force\|-f)\b`・`git( -C \S+)? reset --hard`・`git( -C \S+)? clean -f`・`git( -C \S+)? checkout -- `・`git( -C \S+)? restore ` | Bash のコマンドに当てる JavaScript の正規表現（大小文字を区別しません）。当たれば保留します。`-C <dir>` の任意グループで `git -C /path reset --hard` も拾います。コマンド文全体に当てるので、引用した引数・`grep` のパターン・コメントの中に同じ字句があっても保留します。 |
| `path_patterns` | 空 | Edit／Write の `file_path`（`\` は `/` に直してから）に当てる正規表現。空なら編集は見ません。 |

正規表現として読めない項目は、MOD の読み込み時に通知で 1 回知らせ、その項目だけ飛ばします（ほかの項目は効きます）。

## 動き

- 主担当の会話からのツール呼び出し（サブエージェントの呼び出しは通す）のたびに、Bash のコマンドまたは編集先のパスをパターンに当てます。当たったら Claude Code の `$.ui.ask` を 2 択で呼び、答えが返るまで呼び出しを待たせます。
- 問いは `AskUserQuestion` のツール呼び出しとして出るので、`AskUserQuestion` に反応するほかの MOD（問いを横のペインで解説するものなど）にも見えます。
- フック自体が失敗したときは通します。事故で止めることはありません。

## 読むもの

`Bash` 呼び出しのコマンド文字列と、`Edit`／`Write` 呼び出しの `file_path`。ファイルは読まず、どこにも送りません。

## テスト

```
claude plugin validate .
claude plugin test .
```

## 補足

- AI（Claude Code）の支援を受けて書いています。
- 同じ作者の MOD: [claude-supervisor-pane](https://github.com/i-noma-ru/claude-supervisor-pane)・[claude-decision-tracker](https://github.com/i-noma-ru/claude-decision-tracker)。それぞれ独立しています。

## ライセンス

MIT です。[LICENSE](LICENSE) を参照してください。
