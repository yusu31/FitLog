// 「スマホと同じ画面」の保存キーと、<head> に置く先読みスクリプト（02-9 ⑪）。
// サーバー側の app/layout.tsx から読み込まれるので、React の hook を使う phone-view.ts とは別のファイルにしてある
export const PHONE_VIEW_KEY = 'fitlog.phoneView';

// 読み込み直後のちらつきを防ぐ。壊れても画面を止めない（try/catch）
export const PHONE_VIEW_BOOT_SCRIPT = `try{if(localStorage.getItem('${PHONE_VIEW_KEY}')==='1')document.documentElement.dataset.view='phone'}catch(e){}`;
