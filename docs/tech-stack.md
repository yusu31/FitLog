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

## テストの道具（判断ログ 01-7）

| 層 | 道具 | 理由 |
|----|------|------|
| API（NestJS）の単体・結合 | Jest（`supertest` で HTTP を通す） | NestJS はデコレーターの型情報（`emitDecoratorMetadata`）に頼る。Vitest の標準の変換はこれを出さない見込みで、依存の注入が動かない地雷を避ける |
| 画面の単体 | Vitest ＋ Testing Library | Next.js と同じ ES モジュールの世界で速く動く |
| E2E | Playwright | 前作で使い慣れている。電波なし（オフライン）の切り替えと回線の制限ができる |

- 条件: 02-1 ① で NestJS 12 の雛形を作り、既定の道具を確かめる。**雛形が Vitest なら API も Vitest に寄せる**（道具が1つにそろう）
- 採らなかった案: API も画面も Vitest に統一（上の型情報の心配が消えるまでは選ばない）

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
