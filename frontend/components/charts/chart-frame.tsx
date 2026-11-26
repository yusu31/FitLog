import type { ReactNode } from 'react';

// グラフの枠（レポートの棒・折れ線で共通）。絵は role="img" の短い説明つき、同じ数字を <details> の表でも読める（絵だけに頼らない）。
// 数字の表は折りたたみ（図が主役・表は補助）
export function ChartFrame({ summary, caption, head, rows, children }: { summary: string; caption?: string; head: [string, string]; rows: [string, string][]; children: ReactNode }) {
  return (
    <figure className="m-0">
      <div role="img" aria-label={summary}>
        {children}
      </div>
      {caption && <figcaption className="text-center text-note font-bold text-fg-muted">{caption}</figcaption>}
      <details className="mt-1 text-note">
        <summary className="flex min-h-11 cursor-pointer items-center font-extrabold text-brand">数字の表で見る</summary>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th scope="col" className="py-1 font-extrabold text-fg-muted">
                {head[0]}
              </th>
              <th scope="col" className="py-1 font-extrabold text-fg-muted">
                {head[1]}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([a, b]) => (
              <tr key={a}>
                <th scope="row" className="py-0.5 font-bold">
                  {a}
                </th>
                <td className="fl-num py-0.5">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
