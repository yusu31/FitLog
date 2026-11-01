// UUID の形（8-4-4-4-12 の16進数）。大文字小文字は区別しない。
// UUID でない文字列を DB の uuid 列に渡すとエラー（500）になるので、DB を引く前にこれで弾く
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
