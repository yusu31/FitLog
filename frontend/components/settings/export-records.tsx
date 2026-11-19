'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { exportRecordsCsv } from '@/lib/api/generated';
import { EXPORT_MESSAGES as M } from '@/lib/messages';

const FILE_NAME = 'fitlog-records.csv';
const BOM = '\uFEFF';

// 記録の書き出し（C-01。設定 S-31）。API（GET /api/me/export.csv）の CSV をファイルとして保存する。
// 押している間は押せない。response.text() は先頭の BOM を取り除くので、Excel が文字化けしないよう付け直す
export function ExportRecords() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setPending(true);
    setError(null);
    try {
      const res = await exportRecordsCsv();
      if (res.status !== 200) {
        setError(M.failed);
        return;
      }
      const text = res.data.startsWith(BOM) ? res.data : BOM + res.data;
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = FILE_NAME;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(M.network);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-2">
      <ThickButton tone="white" onClick={onExport} disabled={pending}>
        <Download aria-hidden />
        {pending ? M.busy : M.button}
      </ThickButton>
      <p className="px-1 text-note font-bold text-sub-strong [word-break:auto-phrase]">{M.hint}</p>
      {error && (
        <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}
    </section>
  );
}
