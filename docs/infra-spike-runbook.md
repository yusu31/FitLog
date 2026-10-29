# 公開スパイクの手順書（02-1 ③b）

使い捨ての公開（半日）で、[infrastructure.md 3.2章](./infrastructure.md)の確認項目を実機で確かめる手順。**課金の発生しうる操作は、手順の中の「⚠ 課金」の印の所だけ**で、実行の直前に必ず確認してから行う。作るものは `infra/` の Terraform（[7章](./infrastructure.md#7-デプロイ手順)）。

> **状態**: Terraform の下書き（`terraform validate`・Trivy が通る）と、Lambda が起動時に Parameter Store の3値を読む実装（`backend/src/config/ssm-secrets.ts`）まで済んでいる。**実際に AWS で動くかは、公開スパイクで初めて確かめる**（時間待ちではなく、`apply` が要る＝本人確認が要る）。Neon のプロジェクト（`fitlog`・シンガポール・Postgres 17）は作成済み。接続文字列は控えず、手順5で Neon の画面（Connect）から直接コピーする。

## 0. 先に済ませること（本人の操作）

| 項目 | 内容 | 所要 |
|------|------|------|
| AWS の土台（P1） | Budgets（予算の通知）・CloudTrail・Administrator の長期アクセスキーの扱い。手順は [dev-harness.md](./dev-harness.md) の P1 | 画面で30分前後 |
| Neon | 無料のプロジェクトを作る。接続文字列を**2種類**控える（下の手順1） | 10分 |

## 1. Neon の準備

1. Neon の無料プランでプロジェクトを作る。リージョンは日本に近い所（東京があれば東京。なければシンガポール）。**遅延は実測で確かめる**（infrastructure.md 5.1章）
2. 接続文字列を2つ控える（画面の「Connect」。**チャットや GitHub には貼らない**）
   - **API 用**: ホスト名に `-pooler` が付いたもの（接続を束ねる窓口）
   - **マイグレーション用**: `-pooler` なしの直接接続（表を作るときだけ使う）

## 2. Lambda の一式を作る（課金なし）

```
cd backend
npm run build
npm run package:lambda        # .lambda/ ができる（展開後 約 42 MB）
```

## 3. 変更の予告を見る（課金なし。ただし AWS の資格情報を使う）

```
cd infra
terraform init
terraform plan -out=build/spike.plan
```

予告を**私（Claude）と一緒に読む**。作られるのは、Lambda・IAM ロール・CloudFront・S3（画面用）・Parameter Store の入れ物3つ・ログ置き場。

## 4. ⚠ 課金: 作る（`terraform apply`）

**実行の直前に、私が必ず確認する。** 無料枠の範囲に収まる見込みだが、確認していない点がある（infrastructure.md 6章: Free プランで Lambda Function URL を origin にできるか、東京の単価）。

```
terraform apply build/spike.plan
```

作り終えると、`site_url`（`https://xxxx.cloudfront.net`）が表示される。

## 5. 秘密情報を手で入れる（Terraform には書かない）

AWS の画面で Systems Manager → Parameter Store を開き、次の3つの値を**画面から**入れる（コマンドで入れると、値が履歴に残る）。

| 名前 | 値 |
|------|-----|
| `/fitlog/spike/database-url` | 手順1の API 用（`-pooler` 付き） |
| `/fitlog/spike/better-auth-secret` | 32文字以上のランダムな文字列 |
| `/fitlog/spike/better-auth-url` | 手順4で表示された `site_url` |

> Lambda は、起動の最初に（`FITLOG_SSM_PREFIX` の下の）この3つを読む。**仮の文字（`CHANGE_ME`）のまま・足りない・読めないときは、起動を止めて、名前だけをログに出す**（値は出さない）。標準パラメータの暗号化（SecureString）が使えるか・Lambda の実行ロールで読めるか（鍵の権限）は、ここで初めて確かめる（infrastructure.md 8章。理由: 実際の AWS が要る＝`apply` が要る）。

## 6. 表を作る

手元から、**直接接続**で（`-pooler` ではなく）マイグレーションを流す。

```
cd backend
MIGRATION_DATABASE_URL='（手順1のマイグレーション用）' npm run db:migrate
```

## 7. 確認する

`site_url` を開くと、確認ページ（`infra/spike-site/index.html`）が出る。「① 確認を最初から実行」を押す。結果の表の写し（下の JSON）を Claude に貼る。

| 確認項目（infrastructure.md 3.2章） | 期待 | 外れたら |
|------|------|------|
| ① GET／POST／PATCH／DELETE が CloudFront 経由で通る | `/api/health` 200・PATCH/DELETE が 404（NestJS まで届く） | 403 なら Lambda の権限（lambda.tf の2つの permission）か、SHA-256 ヘッダー |
| ② better-auth のログインと Cookie の往復 | sign-up 200・get-session に登録したメール | Origin・外向きアドレスの扱い（**未確認**）。案B（秘密ヘッダー）に落とす条件に近い |
| ③ ブラウザの fetch で SHA-256 付きの POST | ヘッダーなしは 403・ありは 200 | better-auth の POST に付けられないなら案B |
| ④ Free プランで Function URL を origin にできる | CloudFront の画面で Free プランを選べる | 従量課金プランの単価を確認（**未確認**） |
| ⑤ コールドスタートと Neon 起床の実測 | 画面 3 秒・保存 1 秒に収まるか | 目標側の見直しを相談（5.1・9章） |
| ⑥ 6分以上あけた直後の1回目 | ②のボタンで 200 | 500 系なら、接続の張り直し方（5.2章 A・B・C）を決める |
| ⑦ DB が落ちているときのログの中身 | SQL の引数・接続文字列が出ない | `safe-console`・`auth-log` の見直し |

メモリ 512 MB と 1024 MB の起動時間も比べる（`infra/variables.tf` の `lambda_memory_mb` を変えて `apply`）。

## 8. ⚠ 課金: 片づける（`terraform destroy`）

確認が済んだら消す（これも実行の直前に確認する）。Neon のデータは AWS の外なので、別に消す。

```
cd infra
terraform destroy
```

## 検査（課金なし・資格情報なし）

```
cd infra
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
```

Terraform のセキュリティ検査（Trivy。版とダイジェストを固定した公式イメージ。理由つきで受け入れた指摘は `infra/.trivyignore.yaml`）:

```
docker run --rm -v "$PWD:/work:ro" aquasec/trivy@sha256:af6acf9a6b85dfe389a1941505c0ce9efef52a4719635e1a962f022a3d855daa \
  config --skip-dirs /work/.terraform --skip-version-check --ignorefile /work/.trivyignore.yaml \
  --severity LOW,MEDIUM,HIGH,CRITICAL --exit-code 1 /work
```

（Trivy v0.75.0。公開から2週間以上経った版を選んだ。CI へ入れるのは P2 の中で、そのとき GitHub の Actions も SHA で固定する）
