// @vitest-environment node
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate } from 'orval';

// F-30（オフライン記録）は、送信処理ごとの mutationKey と、フックの外で使える送信処理が要る
// （setMutationDefaults に渡して、再読み込みしても再送できるようにする。docs/tech-stack.md）。
// 今の API には POST が無いので、POST を1本持つ試しの OpenAPI で、orval が必要な部品を作ることを固定する。
// 2026-10 の手元の確認（orval 8.45.0）で作れると分かっている。orval を上げたとき、ここが赤になれば気づける。
describe('orval の生成物（F-30 に必要な部品）', () => {
  // T-FE-05: POST から mutationKey と mutationOptions と、フックの外で使える送信処理ができる
  it('POST の操作から mutationKey・mutationOptions・送信処理を生成する', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'orval-'));
    const target = join(outDir, 'generated.ts');

    await generate(
      {
        input: join(__dirname, '__fixtures__/openapi-create-record.json'),
        output: { mode: 'single', target, client: 'react-query', httpClient: 'fetch', baseUrl: '' },
      },
      process.cwd(),
    );

    const code = readFileSync(target, 'utf-8');
    expect(code).toContain('export const getCreateTrainingRecordMutationKey');
    expect(code).toContain('export const getCreateTrainingRecordMutationOptions');
    expect(code).toContain('export const createTrainingRecord = async');
    // スキーマ名に Record を使わない（TypeScript の Record<K, V> とぶつかる）。TrainingRecord にしてある
    expect(code).not.toMatch(/export (interface|type) Record\b/);
  }, 60_000);
});
