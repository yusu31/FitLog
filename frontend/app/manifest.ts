import type { MetadataRoute } from 'next';
import { buildManifest } from '@/lib/pwa/manifest';

// 静的書き出し（output: "export"）でも出せるよう force-static にする
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return buildManifest();
}
