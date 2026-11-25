// 動画のサムネの並び（video-grid）の文言。責めない言い方で、撮ると見られることだけ伝える
export const VIDEO_GRID_MESSAGES = {
  stripLabel: '今週の2秒動画',
  gridLabel: '自分の過去の2秒動画',
  emptyStrip: '今週の動画は まだありません',
  emptyGrid: '撮った動画は まだありません',
  locked: '1本撮ると 見られます',
  unavailable: '動画は 再生できませんでした',
  loading: '動画を読み込み中',
  loadFailed: '動画を読み込めませんでした。電波の良い所で開き直してください',
  loadMore: 'もっと見る',
  lockedNote: '今週1本撮ると、仲間の動画が見られます',
  shoot: '撮りにいく',
  cannotShoot: 'この端末では撮れません',
  open: (label: string) => `${label}の動画を開く`,
} as const;
