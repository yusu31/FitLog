import { useSyncExternalStore } from 'react';
import { PHONE_VIEW_KEY } from './phone-view-boot';

// 「PC 画面／スマホと同じ画面」の切替（02-9 ⑪・Issue #477）。提出・ポートフォリオで PC から見る人向け。
// PC 幅（1024px 以上）だけ、今の3列とスマホと全く同じ画面（中央に幅430pxの枠）を切り替える。既定は PC 表示。
// 端末に覚え、<html data-view="phone"> を付け外しする。CSS の pc: は「PC 幅かつ phone でない」ときだけ効く（globals.css）。
// 読み込み直後のちらつきを防ぐため、同じ判定を app/layout.tsx の先読みスクリプト（PHONE_VIEW_BOOT_SCRIPT）でも行う
let memory = false; // 保存できない端末のための手元の値
const listeners = new Set<() => void>();

export function readPhoneView(): boolean {
  try {
    return localStorage.getItem(PHONE_VIEW_KEY) === '1';
  } catch {
    return memory;
  }
}

function applyPhoneView(on: boolean): void {
  if (on) document.documentElement.dataset.view = 'phone';
  else delete document.documentElement.dataset.view;
}

export function setPhoneView(on: boolean): void {
  memory = on;
  try {
    if (on) localStorage.setItem(PHONE_VIEW_KEY, '1');
    else localStorage.removeItem(PHONE_VIEW_KEY);
  } catch {
    // 保存できなくても、今の画面は切り替わる
  }
  applyPhoneView(on);
  listeners.forEach((fn) => fn());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

// 書き出し時と最初の描画は「PC 表示」にそろえ、そのあと端末の値に切り替わる
export function usePhoneView(): boolean {
  return useSyncExternalStore(subscribe, readPhoneView, () => false);
}
