// FitLog プロトタイプ v2 共通
// - 色・角丸・書体の決めごと（Tailwind v4 の @theme）。本番の Next.js へそのまま持ち込む前提の値
// - 確認用パネル（書体・「ふにゃっと」・休むボタンの有無・状況の切替。プロトタイプ専用）
// - 下の3タブ（body の data-tab があるページだけ表示）
// - 今週の7マスの元になる週のデータ（状況の切替で変わる）
// - 記録直後の0.8秒の祝福
(() => {
  // static: クラスで使っていない色も変数として書き出す（祝福・炎の絵は style 属性から var() で色を読むため）
  const theme = String.raw`
@theme static {
  --font-sans: "Zen Maru Gothic", system-ui, sans-serif;

  --color-bg: #FFF8EC;
  --color-card: #FFFFFF;
  --color-raised: #FFF0DA;
  --color-line: #F0E2CB;
  --color-ink: #2B2D42;
  --color-mute: #74768B;

  /* 色の役割: 次にやること／勝ち／記録した日（炎）／仲間／負け（赤にしない）／休んだ日 */
  --color-next: #F55D3E;
  --color-next-deep: #C8411F;
  --color-win: #2EC4A6;
  --color-win-deep: #1A9580;
  --color-sun: #FFC93C;
  --color-sun-deep: #E09F12;
  --color-sky: #4DA8FF;
  --color-sky-deep: #2B83D9;
  --color-lose: #8B6BFF;
  --color-rest: #E6EEFB;
  --color-rest-ink: #6F8DBF;

  /* 角丸は --soft（確認用パネルで変える）に比例させる */
  --radius-card: calc(26px * var(--soft));
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
  --depth: calc(5px * var(--soft) + 2px);
  box-shadow: 0 var(--depth) 0 var(--puff-c, var(--color-line));
  transition: transform .45s var(--spring), box-shadow .45s var(--spring);
  &:active {
    transform: translateY(var(--depth));
    box-shadow: 0 0 0 var(--puff-c, var(--color-line));
    transition-duration: .07s;
  }
}
/* カードの下にも薄い厚みを付けて、紙を重ねたように見せる */
@utility slab { box-shadow: 0 4px 0 var(--color-line); }

@keyframes pop { 0% { transform: scale(.4); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
@utility pop-in { animation: pop .5s var(--spring) both; }

/* マスが埋まる: 中心から色が広がり、少し跳ねる */
@keyframes fill { 0% { transform: scale(.2); opacity: 0 } 60% { transform: scale(1.15); opacity: 1 } 100% { transform: scale(1) } }
@utility fill-in { animation: fill .7s var(--spring) both; }
/* 炎が灯る: 下から伸びて、ゆらぐ */
@keyframes ignite { 0% { transform: scaleY(0); opacity: 0 } 70% { transform: scaleY(1.25); opacity: 1 } 100% { transform: scaleY(1) } }
@keyframes flicker { 0%, 100% { transform: rotate(-4deg) scaleY(1) } 50% { transform: rotate(4deg) scaleY(1.08) } }
@utility flame { transform-origin: 50% 100%; animation: flicker 1.6s ease-in-out infinite; }
@utility flame-in { transform-origin: 50% 100%; animation: ignite .6s var(--spring) .35s both, flicker 1.6s ease-in-out 1s infinite; }

/* 祝福の紙吹雪 */
@keyframes burst { 0% { transform: translate(0, 0) scale(.3); opacity: 1 } 100% { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 0 } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; animation-iteration-count: 1 !important; }
}
`;
  const style = document.createElement("style");
  style.setAttribute("type", "text/tailwindcss");
  style.textContent = theme;
  document.head.appendChild(style);

  // 確認用パネルの選択と「今日の状態」はページをまたいで残す（使えない環境でも既定値で表示する）
  const KEY = "fitlog-proto-v2";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
  const prefs = { num: "nunito", soft: "mid", rest: "on", gap: "yday", today: "none", ...load() };
  const apply = () => {
    document.documentElement.dataset.num = prefs.num;
    document.documentElement.dataset.soft = prefs.soft;
  };
  apply();

  // ---- 週のデータ（プロトタイプの「今日」は 10/29 木 に固定） ----
  // 状況: yday＝昨日も記録した／d3＝3日ぶり（空き2日）／d8＝8日ぶり（空き7日）
  const DAYS = ["月", "火", "水", "木", "金", "土", "日"];
  const TODAY = 3; // 木
  const scenarios = {
    yday: { gap: 1, last: "10/28（水）", week: [{ kind: "strength", title: "胸の日", parts: { chest: 3, shoulders: 2, arms: 2 } }, null, { kind: "strength", title: "背中の日", parts: { back: 3, arms: 2, shoulders: 1 } }] },
    d3: { gap: 3, last: "10/26（月）", week: [{ kind: "strength", title: "胸の日", parts: { chest: 3, shoulders: 2, arms: 2 } }, null, null] },
    d8: { gap: 8, last: "10/21（水）", week: [null, null, null] },
  };
  const LEG_DAY = { kind: "strength", title: "脚の日", parts: { quads: 3, glutes: 2, hamstrings: 2, calves: 1 } };

  // 7日分を返す。state: done（記録した）／rest（休むと宣言）／off（記録なし＝淡い休）／today（今日まだ）／future
  const DATES = ["10/26", "10/27", "10/28", "10/29", "10/30", "10/31", "11/1"];
  function week() {
    const s = scenarios[prefs.gap];
    return DAYS.map((label, i) => {
      const date = DATES[i];
      if (i < TODAY) {
        const rec = s.week[i];
        return { label, date, state: rec ? "done" : "off", rec };
      }
      if (i === TODAY) {
        if (prefs.today === "done") return { label, date, state: "done", rec: LEG_DAY, isToday: true };
        if (prefs.today === "rest") return { label, date, state: "rest", isToday: true };
        return { label, date, state: "today", isToday: true };
      }
      return { label, date, state: "future" };
    });
  }

  const flameSvg = (cls = "flame") => `<svg viewBox="0 0 24 30" class="${cls} absolute -top-2.5 -right-1.5 h-6 w-5 drop-shadow-[0_1px_0_var(--color-card)]" aria-hidden="true"><path d="M12 1.5c1.2 4.2 6.8 7.6 6.8 15.2A6.8 6.8 0 0 1 12 23.6a6.8 6.8 0 0 1-6.8-6.9c0-3.3 1.6-5.5 3.3-7.1.4 2 1.4 3.2 2.6 3.7C10.4 9.6 10.9 5.2 12 1.5z" fill="var(--color-next)"/><path d="M12 11.5c.6 2.2 3.3 3.6 3.3 7a3.3 3.3 0 0 1-6.6 0c0-1.5.7-2.6 1.6-3.4.3 1 .8 1.5 1.3 1.7-.3-1.8 0-3.6.4-5.3z" fill="var(--color-sun)"/></svg>`;
  const moonSvg = `<svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true"><path d="M20 14.6A8 8 0 1 1 9.4 4a6.5 6.5 0 0 0 10.6 10.6z"/></svg>`;
  const checkSvg = `<svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;

  // 7マスを描く。animateToday: 今日のマスを「埋まる・灯る」動きで出す
  function renderWeek(el, { animateToday = false } = {}) {
    el.innerHTML = week().map((d) => {
      const inner = {
        done: `<span class="${d.isToday && animateToday ? "fill-in" : ""} grid size-full place-items-center rounded-tile bg-sun text-ink shadow-[inset_0_-4px_0_var(--color-sun-deep)]">${checkSvg}</span>${flameSvg(d.isToday && animateToday ? "flame-in" : "flame")}`,
        rest: `<span class="fill-in grid size-full place-items-center rounded-tile bg-rest text-rest-ink">${moonSvg}</span>`,
        off: `<span class="grid size-full place-items-center rounded-tile bg-rest/70 text-[11px] font-bold text-rest-ink">休</span>`,
        today: `<span class="grid size-full place-items-center rounded-tile border-[3px] border-dashed border-next/70 text-[11px] font-black text-next">今日</span>`,
        future: `<span class="block size-full rounded-tile border-2 border-line"></span>`,
      }[d.state];
      const sr = { done: "記録した", rest: "休むと決めた", off: "記録なし（休み）", today: "今日。まだ記録していない", future: "これから" }[d.state];
      return `<li class="flex flex-col items-center gap-1.5">
        <span class="text-[11px] font-bold ${d.isToday ? "text-next" : "text-mute"}">${d.label}</span>
        <span class="relative aspect-square w-full" role="img" aria-label="${d.label}曜 ${sr}">${inner}</span>
      </li>`;
    }).join("");
  }

  // 今週鍛えた部位（部位ごとのセット数）
  function weekParts() {
    const sum = {};
    week().forEach((d) => d.state === "done" && Object.entries(d.rec.parts).forEach(([k, v]) => { sum[k] = (sum[k] || 0) + v; }));
    return sum;
  }

  const setPref = (k, v) => { prefs[k] = v; save(prefs); apply(); };

  window.FitLog = { prefs, setPref, scenarios, week, renderWeek, weekParts, TODAY_LABEL: "10月29日（木）", flameSvg, moonSvg };

  // ---- 下の3タブ ----
  const icons = {
    today: (on) => `<svg viewBox="0 0 24 24" class="size-6" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="4.5"/><path d="M8 3v4M16 3v4" stroke-linecap="round"/><circle cx="12" cy="13.5" r="2.4" fill="${on ? "var(--color-card)" : "currentColor"}" stroke="none"/></svg>`,
    friends: (on) => `<svg viewBox="0 0 24 24" class="size-6" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5z"/><circle cx="17" cy="8" r="2.6"/><path d="M17.5 13.6c2 .3 3.3 1.9 3.6 4.4h-3.4"/></svg>`,
    me: (on) => `<svg viewBox="0 0 24 24" class="size-6" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.8-3.9 3.7-6 7.5-6s6.7 2.1 7.5 6z"/></svg>`,
  };
  const tabColor = { today: "text-next", friends: "text-sky", me: "text-win" };

  function renderTabs(active) {
    const tab = (id, label, href) => {
      const on = id === active;
      return `<a href="${href}" class="press flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-black ${on ? tabColor[id] : "text-mute"}" ${on ? 'aria-current="page"' : ""}>${icons[id](on)}${label}</a>`;
    };
    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", "メイン");
    nav.className = "fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t-2 border-line bg-card/95 px-4 pt-1.5 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur";
    nav.innerHTML = `<div class="flex">${tab("today", "今日", "today.html")}${tab("friends", "仲間", "friends.html")}${tab("me", "自分", "me.html")}</div>`;
    document.body.appendChild(nav);
  }

  // ---- 確認用パネル ----
  function renderPanel() {
    const group = (key, title, options, cols = 3) => `
      <p class="mb-2 text-xs font-bold text-mute">${title}</p>
      <div class="mb-4 grid gap-2" style="grid-template-columns:repeat(${cols},minmax(0,1fr))" role="radiogroup" aria-label="${title}">
        ${options.map(([v, label, cls = ""]) => `<button type="button" role="radio" data-key="${key}" data-val="${v}" class="press rounded-tile border-2 px-2 py-2.5 text-sm font-bold ${cls}">${label}</button>`).join("")}
      </div>`;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <button type="button" id="proto-open" class="fixed top-1/3 right-0 z-40 rounded-l-tile border-2 border-r-0 border-dashed border-mute/50 bg-card/95 px-1 py-3 text-[11px] font-bold tracking-widest text-mute [writing-mode:vertical-rl]" aria-haspopup="dialog">調整</button>
      <div id="proto-sheet" class="fixed inset-0 z-50 hidden" role="dialog" aria-modal="true" aria-label="プロトタイプの調整">
        <div data-close class="absolute inset-0 bg-ink/40"></div>
        <div class="absolute inset-x-0 bottom-0 mx-auto max-h-[88dvh] max-w-[430px] overflow-y-auto rounded-t-card bg-card p-5 pb-8">
          <div class="mb-4 flex items-center justify-between">
            <p class="font-black">プロトタイプの調整</p>
            <button type="button" data-close class="press rounded-full bg-raised px-3 py-1 text-sm font-bold">閉じる</button>
          </div>
          ${group("gap", "状況（前回の記録からの空き）", [["yday", "昨日も記録"], ["d3", "3日ぶり"], ["d8", "8日ぶり"]])}
          ${group("rest", "「今日は休む」ボタン（最終確認用）", [["on", "あり"], ["off", "なし"]], 2)}
          ${group("num", "数字の書体（桁の幅はどれもそろう）", [["nunito", "Nunito 0123", "font-['Nunito']"], ["mplus", "M PLUS 0123", "font-['M_PLUS_Rounded_1c']"], ["baloo", "Baloo 2 0123", "font-['Baloo_2']"]])}
          ${group("soft", "ふにゃっと（角丸・ボタンの厚み）", [["low", "控えめ"], ["mid", "標準"], ["high", "強め"]])}
          <button type="button" id="proto-reset" class="press mb-3 w-full rounded-tile border-2 border-line py-2.5 text-sm font-bold">今日の記録・休みを取り消す</button>
          <p class="text-xs leading-relaxed text-mute">この調整ボタンは確認用で、本番には入りません。プロトタイプの「今日」は 10/29（木）に固定しています。</p>
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
    // 書体・角丸はその場で変わる。状況・休むボタン・取り消しは画面の中身が変わるので読み直す
    wrap.querySelectorAll("[data-key]").forEach((b) => b.addEventListener("click", () => {
      setPref(b.dataset.key, b.dataset.val);
      sync();
      if (b.dataset.key === "gap" || b.dataset.key === "rest") location.reload();
    }));
    wrap.querySelector("#proto-reset").addEventListener("click", () => { setPref("today", "none"); location.reload(); });
    sync();
  }

  // ---- 画面の下に一瞬だけ出す知らせ ----
  window.toast = (html, tone = "ink") => {
    const t = document.createElement("div");
    const tones = { ink: "bg-ink text-card", win: "bg-win text-card", next: "bg-next text-card", sky: "bg-sky text-card" };
    t.className = `pop-in fixed inset-x-4 bottom-24 z-50 mx-auto max-w-[398px] rounded-btn px-4 py-3 text-center font-bold shadow-xl ${tones[tone]}`;
    t.setAttribute("role", "status");
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  };

  // ---- 記録直後の祝福（0.8秒・タップで飛ばせる。共通部品1つ） ----
  // title: 大きな一言／sub: 事実を1行／badge: 「ベスト」などの札（任意）
  window.celebrate = ({ title, sub = "", badge = "", tone = "win" } = {}) => new Promise((resolve) => {
    const color = { win: "var(--color-win)", next: "var(--color-next)", sky: "var(--color-sky)" }[tone];
    const dots = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2, r = 110 + (i % 3) * 30;
      const c = ["var(--color-sun)", "var(--color-next)", "var(--color-sky)", "var(--color-win)", "var(--color-lose)"][i % 5];
      return `<span class="absolute top-1/2 left-1/2 -mt-1.5 -ml-1.5 size-3 rounded-full" style="background:${c};--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r}px;animation:burst .8s cubic-bezier(.2,.8,.3,1) both"></span>`;
    }).join("");
    const o = document.createElement("div");
    o.className = "fixed inset-0 z-[60] grid place-items-center bg-card/85 backdrop-blur-sm";
    o.setAttribute("role", "alert");
    o.innerHTML = `<div class="relative text-center">
      ${dots}
      <div class="pop-in mx-auto grid size-28 place-items-center rounded-full text-card shadow-[inset_0_-8px_0_rgb(0_0_0/.15)]" style="background:${color}">
        <svg viewBox="0 0 24 24" class="size-16" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
      </div>
      ${badge ? `<span class="pop-in absolute top-0 -right-6 rotate-12 rounded-full bg-sun px-3 py-1 text-sm font-black text-ink shadow-[0_3px_0_var(--color-sun-deep)]" style="animation-delay:.15s">${badge}</span>` : ""}
      <p class="pop-in mt-5 text-3xl font-black" style="animation-delay:.08s">${title}</p>
      ${sub ? `<p class="pop-in mt-1 font-bold text-mute" style="animation-delay:.14s">${sub}</p>` : ""}
    </div>`;
    let closed = false;
    const close = () => { if (closed) return; closed = true; o.remove(); resolve(); };
    o.addEventListener("click", close);
    document.body.appendChild(o);
    setTimeout(close, 800);
  });

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.tab) renderTabs(document.body.dataset.tab);
    renderPanel();
  });
})();
