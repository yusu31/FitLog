// 地図の部品の失敗を見張る（L13）。スタイルやタイルが取れないと、地図は灰色のまま黙って残る。
// 失敗したと分かったら代替表示（距離・時間とルートの線）に切り替える。RouteMap・JapanMap で共通に使う。
// - スタイルの失敗（タイルでも出典でもないエラー）は、1回で失敗とする（地図の土台が無い）
// - タイルの失敗は1つ2つなら表示は崩れないので、続けて TILE_ERROR_LIMIT 回で失敗とする（描き終わった idle で数え直す）
export const TILE_ERROR_LIMIT = 3;

type ErrorLike = { sourceId?: unknown; tile?: unknown };
type Watchable = { on: (event: string, listener: (e?: unknown) => void) => unknown };

export function isTileError(e: unknown): boolean {
  const x = (e ?? {}) as ErrorLike;
  return x.tile !== undefined || x.sourceId !== undefined;
}

export function watchMapFailure(map: Watchable, onFail: () => void): void {
  let tileErrors = 0;
  let failed = false;
  const fail = () => {
    if (failed) return;
    failed = true;
    onFail();
  };
  map.on('error', (e) => {
    if (!isTileError(e)) return fail();
    tileErrors += 1;
    if (tileErrors >= TILE_ERROR_LIMIT) fail();
  });
  map.on('idle', () => {
    tileErrors = 0;
  });
}
