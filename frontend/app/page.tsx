// 今日タブの仮の画面。中身は 02-2 以降（docs/screen-design.md S-10）。
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4">
      <h1 className="text-3xl font-bold">FitLog</h1>
      <p className="text-muted-foreground">少人数で使う、筋トレとランの記録アプリ</p>
    </main>
  );
}
