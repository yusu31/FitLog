# 開発の仕組み（hooks・status.sh・skills）

## FitLog

人にもAIにも期待せず、仕組みで作業ルールを守らせるための道具の一覧。CI・テンプレート・ブランチ保護は [CLAUDE.md の「品質の仕組み」](../CLAUDE.md)と `.github/` にあり、ここには書き写さない。

> **方針:** 動くのを確かめたものだけを入れる。壊れても本体を止めない（fail-open）。入れる前に、合成した入力で「止めるべきで止まる・通すべきで通る」を実行件数つきで確かめる。

---

## 1. hooks（`.claude/hooks/guard.py`）

Claude Code が道具を使う直前に走り、次の3つを止める。登録は [.claude/settings.json](../.claude/settings.json)。

| 止めるもの | 理由 |
|---|---|
| `gh pr merge` | マージは本人が GitHub 上で行う（CLAUDE.md） |
| `git push` の force（`--force`・`-f`・`--force-with-lease`）／ main への push（`origin main`・`HEAD:main`） | 直接 push・force push の禁止（CLAUDE.md）。`git -C dir push` のような前置きオプションも見る |
| `.env` 系ファイルの編集（`.env.example` は通す） | 秘密情報は本人が設定する |

- **確認**: `python -I -X utf8 .claude/hooks/test_guard.py` → 「実行 20 件 / 失敗 0 件」（2026-10-28）。何も止めない偽物で実行すると 11 件失敗する（赤）ことも確認した。
- **限界（抜け道）**: コマンド文字列を見ているだけなので、`bash -c "..."`・変数に入れた名前・`gh api` での直接のマージは止められない。**最後の砦は GitHub のブランチ保護（Ruleset）と CI** で、この hook は「うっかり」を防ぐ層。
- **動作の前提**: Windows で `python` が PATH にあること。無い・壊れているときは何も止めずに通す（fail-open）ので、守りが無くなるだけで作業は止まらない。
- **fail-open を選んだ理由**: この hook の不具合で開発全体が止まるほうが損。止めるものは Ruleset が別に守っている。

### 作らなかった hook（理由）

| 案 | 理由 |
|---|---|
| PR 作成前にテストの実行を強制する | テストがまだ無い。CI＋必須チェックが同じ役を果たす |
| コミット前に lint を走らせる | 同上（02-1 で CI に入れる）。端末ごとの差で動かない日が出る |
| 書き込みのたびに docs との整合を検査する | 誤検出が多く、止める価値に見合わない。レビューで見る |

## 2. status.sh（`.claude/scripts/status.sh`）

`bash .claude/scripts/status.sh` で、フェーズ表（済・進行中・未着手）・ブランチ・Issue/PR の件数・hook のテスト件数を1画面で出す。**フェーズの番号の正本はこのスクリプトの表**で、節目ごとに手で更新する。番号と中身は [schedule.md](./schedule.md) 3章と合わせる。アプリのテスト件数は、コードができる 02-1 から表示する。

## 3. skills（まだ作らない）

[CLAUDE.md](../CLAUDE.md) の方針「スキル化は、実際に動くのを確認してから」に従い、動く対象ができるまで作らない。作る条件を決めておく。

| スキル案 | 作る条件 | 中身 |
|---|---|---|
| 品質チェック | 02-1 ①で lint・型・テスト・ビルドのコマンドが CI で動いた後 | その同じコマンドを手元で順に実行し、実行件数を報告する |
| サーバー起動 | 開発サーバー（NestJS・Next.js）と DB がローカルで動いた後 | 起動の順番・ポート・ヘルスチェック |
| 見積もり台帳の更新 | 台帳に3行以上の実績が入った後（同じ手順を3回やったら） | PR のマージ後に使用量を記録し、全体を再計算する |

**却下**: 今のうちに、動かせないコマンドを書いたスキルを先に作る案。実際に動かして確かめていない手順を書くと、間違いを「正しい手順」として固定してしまう（RaiseTimeLine の server-start スキルは、環境構築の前に書かれて「実行できない」注記が残った）。

## 4. 依存とサプライチェーン（2026-10-29）

自分のコードに穴がなくても、**使っている部品（npm の依存・GitHub Actions・コンテナ）の側から**入り込まれることがある（サプライチェーン攻撃）。2026年は GitHub Actions のタグを悪いコードに付け替える乗っ取りが続いた（3月 Trivy・KICS・xygeni-action、5月 actions-cool、6月 semantic-release-action）。

| 仕組み | 置き場 | 何を防ぐか |
|---|---|---|
| Actions を**コミットの SHA** で固定し、版は行末のコメントに書く | `.github/workflows/ci.yml` | タグの付け替え。SHA は中身の指紋なので付け替えが効かない |
| `checkout` に `persist-credentials: false` | 同上 | GitHub の鍵を作業フォルダに残さない。後の手順が乗っ取られても鍵を持ち出せない |
| コンテナ（postgres・pgbouncer）をダイジェストで固定 | `ci.yml`・`docker-compose.yml` | 同じ名前のイメージの中身の入れ替え |
| Dependabot（npm×2・github-actions・docker-compose。週1回・まとめる） | `.github/dependabot.yml` | 固定したまま古くなること。脆弱性の修正は週1回を待たずに個別の PR |
| CODEOWNERS | `.github/CODEOWNERS` | `.github/`・`.claude/` の変更を本人が必ず見る |
| PR テンプレートのセキュリティ欄 | `.github/pull_request_template.md` | 秘密・依存・他人のデータ・ログ・課金の見落とし |
| CodeQL（default setup）・Dependabot の通知 | GitHub の設定（公開リポジトリなので無料） | コードの危ない書き方・既知の脆弱性 |

- **SHA の取り方**: `gh api repos/{owner}/{repo}/git/ref/tags/{tag}` で取る。中身が「注釈付きタグ」なら `git/tags/{sha}` で指す先のコミットまでたどる。推測で書かない
- **大きな版上げ（major）は Dependabot に出させない**（2026-10-29）: 有効にした直後に、決定とぶつかる大きな版上げの PR が9本出た（TypeScript 7・`@types/node` 26・Vitest 5・ESLint 10・Actions の v7 など）。major は [tech-stack.md](./tech-stack.md) の決定の見直しと一緒に人が判断する。Dependabot に任せるのは小さい更新（minor・patch）と脆弱性の通知。注意: この設定は脆弱性の修正 PR にも効くので、修正が major にしかないときは PR が出ない。そのときも Dependabot の通知（Security タブ）には出るので、週1回の確認で拾う
- **CI のコンテナの更新**: Dependabot は `docker-compose.yml` を更新するが、`ci.yml` の `services` の中は更新しない。Dependabot の PR が来たら、同じダイジェストを `ci.yml` にも手で写す
- **確かめ方**: `grep -n "uses:" .github/workflows/ci.yml` で全部が 40 桁の SHA。SHA を1桁変えると CI が「見つからない」で落ちる（赤の確認）
- **非公開リポジトリで使うとき**: GitHub Free では、非公開リポジトリの Ruleset・CodeQL・秘密情報のプッシュ時保護は使えない（有料）。Dependabot は無料。代わりに Semgrep CE・gitleaks の CLI を CI で動かす（提出後に共通の仕組みへ抜き出す。[schedule.md](./schedule.md) 3.2）
