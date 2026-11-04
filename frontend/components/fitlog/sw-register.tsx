'use client';

import { SerwistProvider } from '@serwist/turbopack/react';
import type { ReactNode } from 'react';

// Service Worker（画面のファイルを端末に保存する裏方）を登録する。開発中は古い画面が残って紛らわしいので登録しない
export function SwRegister({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider swUrl="/serwist/sw.js" options={{ scope: '/' }} disable={process.env.NODE_ENV === 'development'}>
      {children}
    </SerwistProvider>
  );
}
