import { AppShell, PageTitle } from '@/components/fitlog/app-shell';

// S-10 今日（docs/screen-design.md 4章）。週の帯・次の1枚・今日のメニューは、記録の機能（02-2 の後続）で作る
export default function TodayPage() {
  return (
    <AppShell>
      <PageTitle>きょう</PageTitle>
      <section className="fl-stripes relative mx-4 mt-3 overflow-hidden rounded-fl bg-teal-dark [--stripe:rgb(0_0_0/0.14)] px-[18px] pt-3.5 pb-4 text-white shadow-[0_4px_0_var(--color-teal-deep)]">
        <span className="fl-tag bg-gold text-ink">NEXT</span>
        <h2 className="mt-3 text-2xl leading-snug font-extrabold">記録は、もうすぐ</h2>
        <p className="mt-1 text-sm leading-relaxed font-bold">
          筋トレとランの記録は、次の更新で使えるようになります。先に「仲間」タブでグループを作っておけます。
        </p>
      </section>
    </AppShell>
  );
}
