// キャラ編集（F-32）の画面の言葉。判定・評価の言葉（「ダサい」「おすすめ」など）は使わない
export const CHARA_MESSAGES = {
  title: 'キャラを変える',
  back: '自分へ戻る',
  loading: '読み込み中…',
  loadFailed: '読み込めませんでした。電波の良い所で開き直してください',
  tabsLabel: '変える所',
  tabs: { body: '体型', hair: '髪', shirt: '服', pants: 'ズボン', accessory: '小物', pose: 'ポーズ' },
  hairStyle: '髪型',
  hairColor: '髪の色',
  shirtColor: '服の色',
  pantsColor: 'ズボンの色',
  poseHint: 'ポーズは見るだけです（保存されません）。どのポーズでも、いま選んだ見た目で動きます',
  save: '保存する',
  saving: '保存しています',
  saved: '保存しました',
  saveFailed: '保存できませんでした。もう一度試してください',
  entry: 'キャラを変える',
} as const;
