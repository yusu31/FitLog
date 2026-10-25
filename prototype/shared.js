// FitLog プロトタイプ共通
// - 色・角丸・書体の決めごと（Tailwind v4 の @theme）。本番の Next.js へそのまま持ち込む前提の値
// - 確認用パネル（数字の書体・「ふにゃっと」の強さを切り替える。プロトタイプ専用）
// - 下の5タブ（body の data-tab があるページだけ表示）
(() => {
  const theme = String.raw`
@theme {
  --font-sans: "Zen Maru Gothic", system-ui, sans-serif;

  --color-bg: #14161B;
  --color-card: #1E2128;
  --color-raised: #272B33;
  --color-line: #343A45;
  --color-ink: #F4F1EA;
  --color-mute: #9AA0AA;

  /* 色の役割は3つだけ: 次にやること／勝ち／ボスのHP */
  --color-next: #FF5A1F;
  --color-next-deep: #B83A0B;
  --color-win: #C7F43A;
  --color-win-deep: #7E9C12;
  --color-hp: #FF3B5C;

  /* 角丸は --soft（確認用パネルで変える）に比例させる */
  --radius-card: calc(24px * var(--soft));
  --radius-btn: calc(20px * var(--soft));
  --radius-tile: calc(14px * var(--soft));
}

:root { --soft: 1; --num-family: "Nunito"; --spring: cubic-bezier(.34, 1.7, .5, 1); }
html[data-soft="low"] { --soft: .45; }
html[data-soft="high"] { --soft: 1.5; }
html[data-num="mplus"] { --num-family: "M PLUS Rounded 1c"; }
html[data-num="baloo"] { --num-family: "Baloo 2"; }

/* 数字は桁の幅をそろえる（記録中に数字が増えても横に揺れない） */
@utility font-num {
  font-family: var(--num-family), "Zen Maru Gothic", sans-serif;
  font-variant-numeric: tabular-nums;
}

/* 署名的な動きはこの1本: 押すと沈み、ばねで戻る */
@utility press {
  transition: transform .45s var(--spring);
  &:active { transform: scale(.95); transition-duration: .07s; }
}
/* ぷっくりボタン: 下に濃い色の影。押すと影の分だけ沈む */
@utility puff {
  --depth: calc(6px * var(--soft) + 2px);
  box-shadow: 0 var(--depth) 0 var(--puff-c, rgb(0 0 0 / .45));
  transition: transform .45s var(--spring), box-shadow .45s var(--spring);
  &:active {
    transform: translateY(var(--depth));
    box-shadow: 0 0 0 var(--puff-c, rgb(0 0 0 / .45));
    transition-duration: .07s;
  }
}

@keyframes pop { 0% { transform: scale(.4); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
@utility pop-in { animation: pop .5s var(--spring) both; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }
}
`;
  const style = document.createElement("style");
  style.setAttribute("type", "text/tailwindcss");
  style.textContent = theme;
  document.head.appendChild(style);

  // 確認用パネルの選択はページをまたいで残す（使えない環境でも既定値で表示する）
  const KEY = "fitlog-proto";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
  const prefs = { num: "nunito", soft: "mid", ...load() };
  const apply = () => {
    document.documentElement.dataset.num = prefs.num;
    document.documentElement.dataset.soft = prefs.soft;
  };
  apply();

  const icons = {
    today: (on) => `<svg viewBox="0 0 24 24" class="size-6" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="4.5"/><path d="M8 3v4M16 3v4" stroke-linecap="round"/><circle cx="12" cy="13.5" r="2.4" fill="${on ? "var(--color-bg)" : "currentColor"}" stroke="none"/></svg>`,
    raid: (on) => `<svg viewBox="0 0 24 24" class="size-6" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.2 19 6v5.2c0 4.4-3 7.8-7 9.6-4-1.8-7-5.2-7-9.6V6z"/><path d="m9.5 10.5 1.2 1.2M14.5 10.5l-1.2 1.2M9.5 15h5" stroke="${on ? "var(--color-bg)" : "currentColor"}" stroke-linecap="round"/></svg>`,
    friends: (on) => `<svg viewBox="0 0 24 24" class="size-6" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5z"/><circle cx="17" cy="8" r="2.6"/><path d="M17.5 13.6c2 .3 3.3 1.9 3.6 4.4h-3.4"/></svg>`,
    me: (on) => `<svg viewBox="0 0 24 24" class="size-6" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.8-3.9 3.7-6 7.5-6s6.7 2.1 7.5 6z"/></svg>`,
  };

  function renderTabs(active) {
    const tab = (id, label, href) => {
      const on = id === active;
      return `<a href="${href}" class="press flex flex-1 flex-col items-center gap-1 py-1 text-[11px] font-bold ${on ? "text-ink" : "text-mute"}" ${on ? 'aria-current="page"' : ""}>${icons[id](on)}${label}</a>`;
    };
    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", "メイン");
    nav.className = "fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t border-line/70 bg-bg/90 px-2 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur";
    nav.innerHTML = `<div class="flex items-end">
      ${tab("today", "今日", "today.html")}
      ${tab("raid", "レイド", "#")}
      <a href="record-strength.html" class="puff mx-1 flex h-12 w-[4.5rem] flex-col items-center justify-center rounded-btn bg-next text-bg [--puff-c:var(--color-next-deep)]" aria-label="記録する">
        <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        <span class="-mt-0.5 text-[10px] font-black">記録</span>
      </a>
      ${tab("friends", "仲間", "#")}
      ${tab("me", "自分", "#")}
    </div>`;
    document.body.appendChild(nav);
  }

  function renderPanel() {
    const group = (key, title, options) => `
      <p class="mb-2 text-xs font-bold text-mute">${title}</p>
      <div class="mb-5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="${title}">
        ${options.map(([v, label, cls = ""]) => `<button type="button" role="radio" data-key="${key}" data-val="${v}" class="press rounded-tile border-2 px-2 py-2.5 text-sm font-bold ${cls}">${label}</button>`).join("")}
      </div>`;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <button type="button" id="proto-open" class="fixed top-1/3 right-0 z-40 rounded-l-tile border-2 border-r-0 border-dashed border-mute/60 bg-bg/90 px-1 py-3 text-[11px] font-bold tracking-widest text-mute backdrop-blur [writing-mode:vertical-rl]" aria-haspopup="dialog">調整</button>
      <div id="proto-sheet" class="fixed inset-0 z-50 hidden" role="dialog" aria-modal="true" aria-label="プロトタイプの調整">
        <div data-close class="absolute inset-0 bg-black/60"></div>
        <div class="absolute inset-x-0 bottom-0 mx-auto max-w-[430px] rounded-t-card bg-raised p-5 pb-8">
          <div class="mb-4 flex items-center justify-between">
            <p class="font-black">プロトタイプの調整</p>
            <button type="button" data-close class="press rounded-full bg-card px-3 py-1 text-sm font-bold">閉じる</button>
          </div>
          ${group("num", "数字の書体（桁の幅はどれもそろう）", [["nunito", "Nunito 0123", "font-['Nunito']"], ["mplus", "M PLUS 0123", "font-['M_PLUS_Rounded_1c']"], ["baloo", "Baloo 2 0123", "font-['Baloo_2']"]])}
          ${group("soft", "ふにゃっと（角丸・ボタンの厚み）", [["low", "控えめ"], ["mid", "標準"], ["high", "強め"]])}
          <p class="text-xs leading-relaxed text-mute">この調整ボタンは確認用で、本番には入りません。</p>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const sheet = wrap.querySelector("#proto-sheet");
    const sync = () => wrap.querySelectorAll("[data-key]").forEach((b) => {
      const on = prefs[b.dataset.key] === b.dataset.val;
      b.setAttribute("aria-checked", on);
      b.classList.toggle("border-next", on);
      b.classList.toggle("text-ink", on);
      b.classList.toggle("border-line", !on);
      b.classList.toggle("text-mute", !on);
    });
    wrap.querySelector("#proto-open").addEventListener("click", () => sheet.classList.remove("hidden"));
    sheet.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", () => sheet.classList.add("hidden")));
    wrap.querySelectorAll("[data-key]").forEach((b) => b.addEventListener("click", () => {
      prefs[b.dataset.key] = b.dataset.val;
      save(prefs); apply(); sync();
    }));
    sync();
  }

  // 画面の下に一瞬だけ出す知らせ
  window.toast = (html, tone = "ink") => {
    const t = document.createElement("div");
    const tones = { ink: "bg-ink text-bg", win: "bg-win text-bg", next: "bg-next text-bg" };
    t.className = `pop-in fixed inset-x-4 bottom-28 z-50 mx-auto max-w-[398px] rounded-btn px-4 py-3 text-center font-bold shadow-2xl ${tones[tone]}`;
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.tab) renderTabs(document.body.dataset.tab);
    renderPanel();
  });
})();
