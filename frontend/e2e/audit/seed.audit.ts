import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';
import { seedAll } from './seed';

// シードを作って .seed.json に書く（後続の audit が読む。メール・パスワードはテスト専用のダミー。git 管理外）
test('シードデータを作る', async ({ baseURL }) => {
  const result = await seedAll(baseURL!);
  writeFileSync(join(__dirname, '.seed.json'), JSON.stringify(result, null, 2), 'utf-8');
  console.log(`seed suffix=${result.suffix} users=${Object.keys(result.users).join(',')}`);
});
