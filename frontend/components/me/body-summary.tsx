'use client';

import Link from 'next/link';
import { useGetBody } from '@/lib/api/generated';
import { BODY_CONNECT_MESSAGES as M } from '@/lib/body/body';

// 自分タブのからだ（B14b）。体重の7日平均と BMI を数字だけで出し、からだ画面（/me/body）へ。
// 体重が未入力ならやさしい誘い。読み込めないときは何も出さない（自分タブの他の部分を邪魔しない）。数字は本人だけが見える
export function BodySummary() {
  const body = useGetBody();
  const data = body.data?.status === 200 ? body.data.data : null;
  if (!data) return null;

  const link = 'text-sm font-extrabold text-teal-dark underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-teal/40';
  return (
    <section aria-labelledby="me-body" className="fl-slab space-y-2 px-4 py-3">
      <h2 id="me-body" className="text-sm font-extrabold text-sub-strong">
        {M.summaryTitle}
      </h2>
      {data.latest === null ? (
        <>
          <p className="text-xs text-sub-strong">{M.inviteNote}</p>
          <Link href="/me/body" className={`inline-flex min-h-11 items-center ${link}`}>
            {M.invite}
          </Link>
        </>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 text-center">
            <div>
              <dt className="text-xs font-bold text-sub-strong">{M.summaryAvg7}</dt>
              <dd className="text-xl font-extrabold">{data.avg7 === null ? '—' : `${data.avg7}kg`}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-sub-strong">{M.summaryBmi}</dt>
              <dd className="text-xl font-extrabold">{data.bmi ?? '—'}</dd>
            </div>
          </dl>
          <Link href="/me/body" className={`flex min-h-11 items-center justify-end ${link}`}>
            {M.summaryOpen}
          </Link>
        </>
      )}
    </section>
  );
}
