import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// 1件ごとに画面の部品を片づける（前のテストの描画が残らないように）
afterEach(() => cleanup());
