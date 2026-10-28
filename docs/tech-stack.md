# 技術スタック

## FitLog

使用技術・バージョン・選定理由・採らなかった案を定義する。
決定済みの一覧（短い形）は [CLAUDE.md](../CLAUDE.md) の技術スタック表を正とし、本書はその理由と詳細を書く。

> **バージョンについて:** 表のバージョンは、選定時に `npm view` で確認した最新版（2026-10）。実装を始めるときに `package.json` で固定し、本書を実物に合わせて直す。
> まだ決めていないものは「未決」と書き、推測では埋めない。

---

## フロントエンド

| カテゴリ | 使用技術 | バージョン | 選定理由 |
|----------|----------|-----------|---------|
| フレームワーク | Next.js（静的書き出し `output: 'export'`） | 16.x | React の部品資産（shadcn/ui・Motion 等）がそのまま使える。画面は S3 + CloudFront から配るだけにして、サーバーを持たない。詳細ページは動的ルートを使わず `?id=` で表す（静的書き出しでは動的ルートに制約があるため） |
| 言語 | TypeScript | 6.0.x | 画面と API の型をそろえるため。最新の 7.0 は使わない。7.0 はプログラムから使う API を持たず（7.1 で入る予定）、型の生成部品や lint などの道具が対応待ちのため（[下の節](#typescript-の版と型の生成)）。7.1 が出たら移行を検討する |
| UI | shadcn/ui + Tailwind CSS | 未決 | 部品をコピーして持つ方式で、見た目を細かく調整できる |
| データ取得・状態 | TanStack Query（`@tanstack/react-query`） | 5.105.x | 楽観的更新・再試行・キャッシュを1つで持てる。F-30 オフライン記録の中心（[下の節](#オフライン記録f-30)） |
| 型の共有 | `@nestjs/swagger` が出す OpenAPI から、orval で画面用の型と TanStack Query の部品を生成 | orval 8.x | API の形を NestJS 側の1か所で決め、画面は生成した型を使う。orval は TanStack Query のフックに加えて mutationKey とフックの外で使える送信処理も作るので、F-30 の `setMutationDefaults` にそのまま渡せる（[下の節](#typescript-の版と型の生成)） |
| 認証（画面側） | `better-auth/react` | 未決 | API 側の better-auth と対になる |
| 地図 | MapLibre GL JS + PMTiles（`pmtiles`） | 未決 | 地図の画像を自分の S3 + CloudFront から配り、外部の地図サービスに頼らない |
| GPX の読み取り | `@tmcw/togeojson` | 未決 | 依存が無く、地図にそのまま渡せる GeoJSON で出る。壊れた XML・線0本・サイズ上限の検査は自前 |
| 動画 | MediaRecorder（ブラウザ標準） | - | 画面の中で2秒だけ撮る（720p・MP4/H.264 を優先）。変換サーバーを置かない |

## バックエンド

| カテゴリ | 使用技術 | バージョン | 選定理由 |
|----------|----------|-----------|---------|
| フレームワーク | NestJS（AWS Lambda 上で動かす） | 12.x | 型つきで、コントローラー・サービス・モジュールの作法が決まっている。使う時だけ動く Lambda に載せ、費用を抑える |
| ORM | Drizzle | 0.45.x | 週ごと・部位ごとの集計を型つきで書ける。Lambda で軽い |
| 認証 | better-auth（Drizzle アダプター）+ Cookie セッション | 未決 | 利用者が多く、自分の DB に保存できる。`/api/*` を CloudFront の下に置き、画面と同じサイトにして Cookie を使う |
| API 仕様の出力 | `@nestjs/swagger` | 未決 | NestJS 公式。OpenAPI を出力して画面の型を作る |
| メニュー説明文 | テンプレート文 ＋ Cloudflare Workers AI（無料枠） | - | テンプレート文を必ず作り、AI が使えるときだけ数値を変えずに言い換える。AI が止まってもアプリは壊れない |

## データベース・配信

| カテゴリ | 使用技術 | 選定理由 |
|----------|----------|---------|
| データベース | PostgreSQL（Neon Free） | 無料枠で長く使える |
| 画面の配信 | S3 + CloudFront | 静的書き出しのファイルを置くだけ |
| API | AWS Lambda | 使う時だけ動き、費用を抑える |
| ファイル | S3（動画・GPX・地図の PMTiles） | 動画は API が発行する署名付き URL で、ブラウザから直接置く |

---

## オフライン記録（F-30）

ジムの地下など電波の弱い場所でも、記録を失わないための仕組み。範囲は**記録の作成だけ**（オフライン中の編集・削除は対象外）。

### 3つの層

```
① 「できた」を押した瞬間に画面へ出す   … 楽観的更新（失敗したら元に戻す）
② 電波が無い間、送信待ちを端末に残す    … 送信待ち（再読み込みしても消えない）
③ 電波が無い場所で、アプリ自体を開ける  … Service Worker（画面のファイルを端末に保存）
```

①②は「タブを開いたまま」の場面で効き、③は「電波の無い場所でブラウザを開き直した」場面で効く。

### 採用した技術

| 層 | 使用技術 | バージョン | 使い方 |
|----|----------|-----------|--------|
| ① | TanStack Query の楽観的更新 | 5.105.x | `onMutate` で先に画面を更新し、失敗したら巻き戻す |
| ② | TanStack Query の一時停止した送信 ＋ `@tanstack/react-query-persist-client` ＋ `@tanstack/query-async-storage-persister` ＋ `idb-keyval`（IndexedDB） | 5.105.x / 6.3.x | オフラインの送信は一時停止し、再接続すると同じ順番で再送される。再読み込みしても再送できるよう、`setMutationDefaults` で送信処理を登録し、保存した状態を復元した後に `resumePausedMutations()` を呼ぶ（送信処理そのものは保存できないため）。**順番を守るには、同じ `scope.id` を付ける**（同じ `scope.id` の送信は1本ずつ順に実行される。付けないと順番は保証されない。[TanStack Query の公式](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)） |
| ③ | Serwist（最小構成） | 9.5.x | 画面のファイルだけを端末に保存する。API の応答は Service Worker では保存しない（表示は②の永続化が受け持つ） |

**③ は仮置き。実装の前に半日のスパイク（技術検証）で方式を決める。**
1. `@serwist/turbopack` が静的書き出し（`output: 'export'`）で動くか確かめる（Next.js 16 は Turbopack が既定。この部品は Route Handler で Service Worker を配る作りで、静的書き出しでの動作は公式ドキュメントに記載がない）
2. 動かなければ、`@serwist/cli` で書き出し後のフォルダ（`out/`）から Service Worker を作る
3. 半日で決まらなければ Service Worker を置かず、「タブを開いたままなら記録できる」を既知の制限として README に書く

### どの方式でも守る決まり

| 決まり | 内容 |
|--------|------|
| 二重保存の防止 | 記録ごとに端末で ID（UUID）を作って送る。API は同じ ID が来たら新しく作らず成功を返す（Drizzle の `onConflictDoNothing`） |
| 再送のきっかけ | アプリを開いたとき・電波が戻ったとき。iPhone の Safari には、閉じていても裏で送る仕組み（Background Sync）が無いため |
| ログイン切れ | オフライン中にセッションが切れて 401 が返っても、送信待ちを捨てない。ログインし直したら再送する |
| 状態の表示 | 送信待ちがある間だけ、画面の上に帯を出す（出る場所・文言・消えるきっかけは [screen-design.md の送信待ちの表示](./screen-design.md#送信待ちの表示f-30)） |

### 既知の制限

- iPhone の Safari は、そのサイトを操作しないまま Safari を7日使うと、IndexedDB・Service Worker を消す（ホーム画面に追加したアプリは対象外）。送信待ちは次に開いたときに送るので実害は小さいと見ているが、7日以上開かずに Safari で使い続けた場合、送っていない記録は消える

### 実装の段取り（判断ログ 01-7）

記録の書き込みは、**02-2 の最初から**この形で書く: orval の mutationKey ＋ `setMutationDefaults` ＋ `scope.id`（利用者ごとに1つ。記録の作成 → セットの追加の親子の順番を守るため）。02-2 で普通の `useMutation` で書くと、02-4 で書き込みを全部書き直すことになるため。02-4 に残すのは、端末への保存（IndexedDB）・送信待ちの帯・Serwist だけ。送れなかったときの扱いは [design.md 7章](./design.md#7-細かい取り決めテスト設計の洗い出しで決めたもの)。

### テスト

| 層 | 確かめること |
|----|-------------|
| E2E（Playwright） | オフラインにする → 記録する → 再読み込み → オンラインに戻す → サーバーの記録が**ちょうど1件** |
| 結合（API） | 同じ ID の記録を2回送っても、保存されるのは1件 |

### 採らなかった案

| 案 | 理由 |
|----|------|
| TanStack Query ＋ Dexie で送信待ちを自作 | 再送・順番・重複防止を自分で書くことになり、TanStack Query の一時停止・再送と二重になる。作成だけなので Dexie の検索機能は要らない |
| 自作（localStorage ＋ `online` イベント） | 再送・順番・画面の巻き戻しを全部自作することになり、不具合とテストが重い |
| TanStack DB | 0.x 系で API が変わりうる。提出の期限に対して危険が大きい |
| Service Worker を最初から置かない | 電波の無い場所でブラウザを開き直すと何も表示されない。スパイクが失敗したときの逃げ道としてだけ残す |

---

## TypeScript の版と型の生成

TypeScript の最新は 7.0（Go で書き直された新しいコンパイラー）。ただし 7.0 は、ほかの道具がプログラムから呼び出すための API を持っていない（7.1 で新しい API が入る予定）。型を生成する部品の多くはこの API を使うため、版によって動く・動かないが分かれる。

**手元での確認結果（2026-10）**: 3つの部品で、同じ OpenAPI から生成し、生成物を型チェックした。

| 部品 | TypeScript 7.0.2 で生成 | TypeScript 6.0.3 で生成 | 生成物の型チェック（6・7とも） |
|------|------|------|------|
| openapi-typescript 7.13.0 | ✕（`ts.factory` が無く落ちる） | ○ | エラー0件 |
| @hey-api/openapi-ts 0.99.0 | ✕（`ts.SyntaxKind` が無く落ちる） | ○ | エラー0件 |
| **orval 8.45.0（採用）** | ○ | ○ | エラー0件 |

**orval の設定（予定）**: `client: 'react-query'`・`httpClient: 'fetch'`。送信処理ごとに `get{操作名}MutationKey()` と `get{操作名}MutationOptions()` が生成されるので、F-30 の再送の登録に使う。

**注意**: スキーマ名（DTO の名前）に `Record` を使わない。TypeScript に元からある `Record<K, V>` 型とぶつかり、生成物が型エラーになる（試しの OpenAPI で実際に起きた。`TrainingRecord` に変えたら0件）。

### 採らなかった案

| 案 | 理由 |
|----|------|
| TypeScript 7.0 | 速い（公式で約10倍）が、プログラムから使う API が無く、型の生成部品・lint などが対応待ち |
| TypeScript 7.0 と 6.0 の並べ入れ（`@typescript/typescript6` を npm の別名で入れる） | 公式に用意された方法だが、構成が複雑になり、設定の誤りで道具が落ちる原因になる |
| openapi-typescript ＋ openapi-fetch ＋ openapi-react-query | 最も軽く利用者も多いが、TypeScript 5 までしか対応を宣言しておらず、6.0 でも入れるときに衝突する。7.0 では落ちる |
| @hey-api/openapi-ts | TypeScript 6.0 なら動くが、0.x 系で API が変わりうる。7.0 では落ちる |

---

## 画面の骨組み（02-1 ②。実装で確かめたこと）

| 項目 | 内容 |
|------|------|
| 雛形 | `create-next-app` 16.4.3（`frontend/`）。TypeScript は雛形が 5 系なので **6.0.3 に直した**（決定どおり） |
| 静的書き出し | `output: "export"`・`trailingSlash: true`・`images.unoptimized`。**雛形の `cacheComponents`・`partialPrefetching` は静的書き出しと併用できず（`Invariant: PPR cannot be enabled in export mode`）外した**（実際のビルドで確認） |
| フォント | Google Fonts は使わない（ビルドが通信に頼らず、利用者の端末が外部へ問い合わせない）。システムの標準フォント。shadcn の初期化が戻したものも外した。`out/` に外部フォントの参照が無いことを確認 |
| UI 部品 | shadcn/ui 4.23（base-nova・neutral）。追加された `cn` は shadcn 本人の公式パッケージ（clsx と tailwind-merge の置き換え。メンテナー・リポジトリを npm と GitHub で確認）。`@base-ui/react`・`class-variance-authority`・`lucide-react`・`tw-animate-css` も入った |
| 型チェック | `next typegen && tsc --noEmit`。`LayoutProps` などの型は Next.js がビルド・開発のときに生成する。手元は `.next/` が残っているので通るが、**きれいな状態の CI では `Cannot find name 'LayoutProps'` で落ちた**（まっさらなクローンで再現し、`next typegen` を先に走らせて解消）|
| 画面のテスト | Vitest 4（backend と同じ）＋ Testing Library ＋ jsdom。`tsconfig.json` の `types` に `vitest/globals` |
| 型の生成 | バックエンドが `@nestjs/swagger` で `backend/openapi.json` を出し（`npm run openapi`）、画面が orval 8.45 で `frontend/lib/api/generated.ts` を作る（`npm run api:generate`）。**どちらも Git に入れ、CI が再生成して差分が出たら落とす**（陽性対照: 仕様を変えて再生成すると `git diff --exit-code` が 1 になることを確認） |
| F-30 の部品 | 今の API には POST が無いので、POST を1本持つ試しの OpenAPI（`lib/api/__fixtures__/`）で、`getCreateTrainingRecordMutationKey`・`...MutationOptions`・フックの外で使える `createTrainingRecord` が生成されることをテストで固定した（T-FE-05）。orval を上げて壊れたら赤になる |
| Serwist | **この PR に含めない**（半日のスパイクは別。方式は結果で決める） |

## テストの道具（判断ログ 01-7）

| 層 | 道具 | 理由 |
|----|------|------|
| API（NestJS）の単体・結合 | **Vitest**（`supertest` で HTTP を通す） | NestJS 12 の雛形の既定。**デコレーターの型情報が効くことを実測で確認した**（`emitDecoratorMetadata` を切ると見本テストが `undefined` で落ち、入れると通る。2026-10-28） |
| 画面の単体 | Vitest ＋ Testing Library | Next.js と同じ ES モジュールの世界で速く動く。API と同じ道具で覚えることが減る |
| E2E | Playwright | 前作で使い慣れている。電波なし（オフライン）の切り替えと回線の制限ができる |

- **決め直した経緯**: 01-7 では「API は Jest」としたが、理由は「Vitest ではデコレーターの型情報が出ない見込み」という**推測**だった。02-1 ① で雛形を作って実測したところ、その心配は当たらなかった（雛形は Vitest ＋ Vite 8。NestJS 12 の移行ガイドにも「ESM は既定 Vitest」「Jest で ESM 版を読むには Node 24.9 以上が要る」とある）。01-7 に書いた条件「雛形が Vitest なら API も寄せる」のとおり、Vitest に統一した
- 採らなかった案: API は Jest（雛形の既定から外れ、NestJS 12 の ESM では Node の版の条件が付く。型情報の心配は消えたので、選ぶ理由がない）
- 型は Vitest が見ない。**型チェック（`tsc --noEmit`）を CI の別の手順に置く**（02-1 ① で、`err.code` の型の誤りを Vitest は通し、`tsc` が見つけた）

## バックエンドの道具（判断ログ 02-1 ①）

| 役割 | 決定 | 版 | 決め手 | 選ばなかった案を選ぶ条件 |
|------|------|-----|--------|--------------------------|
| DB ドライバー | **node-postgres（`pg`）**＋ `drizzle-orm/node-postgres`。Neon の `-pooler` 経由・`Pool({ max: 1 })` | pg 8.23.x | 「グループ参加」は「人数を数える→追加する」を1つのトランザクションにする。**`neon-http` は `transaction()` が例外を投げて使えない**（drizzle-orm 0.45.4 の `neon-http/session.js` に `"No transactions support in neon-http driver"`。2026-10-28 に原本で確認）。Neon 自身の Lambda ガイドも `pg` | `neon-serverless`（WebSocket）: `pg` の TCP が使えない環境（Cloudflare Workers など）へ移るとき |
| Lambda に載せる部品 | **`@codegenie/serverless-express`** ＋ `@nestjs/platform-express` | 5.0.0 | NestJS 公式の serverless の FAQ が名指し（NestJS 12 対応済み）。Function URL の形式（API Gateway payload 2.0）を処理し、複数の Set-Cookie を `cookies` 配列で返すことをソースで確認 | `@fastify/aws-lambda`＋`platform-fastify`: 起動時間を詰めたいとき（実測が先） |
| Lambda 用のまとめ方 | **まず `nest build` ＋ 本番の依存だけを同梱**。サイズと起動時間を測ってから見直す | — | 素の esbuild は `emitDecoratorMetadata` に**対応しない**（esbuild 公式）ので、依存の注入が壊れる。公式の手順外の組み合わせはスパイクで確かめてから | 実測で遅い・大きいとき: tsc／SWC の出力を esbuild でまとめる |
| フォルダ構成 | **npm のみ。`backend/` と `frontend/` を別の package**（ルートに `package.json` は置かない）。CI は job を分ける | npm 11 | 型は orval が OpenAPI から画面側に生成するので、共有 package が要らない。Lambda の zip づくりも `backend/` で閉じる | npm workspaces／pnpm: 画面と API で共有する実コード（スキーマ・定数）が出たとき、または CI の install が実測で遅いとき |

- **使い方の落とし穴（再レビューで実測）**:
  - `serverless-express` は**名前付き import** で使う: `import { configure } from '@codegenie/serverless-express'`。NestJS 公式の FAQ の例（既定の import）を ESM でそのまま写すと、型が `This expression is not callable`（TS2349）になる。型エラーを消そうと `.default(...)` と書くと、CI は通るのに Lambda で即死する（実行時は `.default` が `undefined`）
  - **トランザクションの中は `tx` だけを使う**。`Pool({ max: 1 })` なので、中で `db` を使うと、空かない接続を待って10秒固まってからエラーになる（実測）。結合テストは `max: 1` のまま実際にトランザクションを通す
  - 想定外のエラーは、全体の例外フィルター（`backend/src/common/all-exceptions.filter.ts`）で処理する。drizzle のエラーの message には SQL の引数（トークン・メールアドレス・招待リンクの値になりうる）が入り、Nest の既定ではそのままログに出るため、ログには名前と原因の印（`cause.code`）だけを出す
  - 雛形の `npm run deploy`（外部の配備サービス Mau を起動する）は、お金・対外的な操作の止まる条件に当たるので、スクリプトと依存を消した
- 起動時間の実測値と、`serverless-express` を ESM のまま動かす確認は、**02-1 ③ の公開スパイクで行う**（実機が要る＝時間待ち。今は取れない）
- Neon の公式に「Lambda にはこのドライバー」と名指しする文はない（`choose-connection` のページに Lambda の語がない。原理的に取れない）。根拠は上のソース確認と Neon の Lambda ガイド（`pg` の例）
- 雛形の `AGENTS.md` は外部の監視サービス（NestJS Observe）の宣伝で、採らない。外部サービスの追加は、比較してから決める

## 採用しない技術と理由

| 技術 | 理由 |
|------|------|
| React Router（SPA）／Vite + TanStack Router | 技術的には素直だが、前作（React Router 7 + Vite）と同じ土台になり、別の技術スタックで作る目的に合わない |
| Nuxt／SvelteKit | React の部品資産（shadcn/ui・Motion・three.js の React 版）が使えなくなる |
| Next.js を Lambda で SSR | 静的配信の構成が崩れ、ページごとに起動待ちが乗る |
| Prisma | 版の作り直しの途中で、週ごと・部位ごとの集計を型つきで書きにくい。Lambda で重い |
| TypeORM／MikroORM／Kysely | 型の抜け・情報の少なさ・表定義とマイグレーションが自前、のいずれか |
| ECS + ALB + RDS | 常に動く構成で月額がかかり、無料で長く使う方針に合わない |
| ts-rest／tRPC 連携／nestjs-zod | NestJS 12 に対応していない |
| oRPC | NestJS との連携部品の利用者が少ない |
| 動画の変換（MediaConvert・Lambda + ffmpeg） | 費用がかかる／変換サーバーの管理が増える |
