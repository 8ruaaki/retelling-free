// ============================================================
// お題生成のフォールバック用プリセット
// ============================================================
export const PROMPT_PRESETS = [
  { target: '江戸時代の侍', topic: 'スマートフォンの利点' },
  { target: '魔法使い', topic: '科学実験の面白さ' },
  { target: '未来から来た人', topic: '手書きの手紙の良さ' },
  { target: '深海魚', topic: '深海でのんびり暮らすメリット' },
  { target: '宇宙飛行士', topic: '地球の温泉の良さ' },
  { target: 'サンタクロース', topic: 'ドローン配達の利点' },
  { target: '海賊の船長', topic: 'リサイクル活動のメリット' },
  { target: '古代ローマの哲学者', topic: 'インターネット検索の利点' },
  { target: 'ロボット', topic: '絵の具で絵を描く良さ' },
  { target: '夜更かし好きな吸血鬼', topic: 'オンライン英会話のメリット' },
  { target: '森のフクロウ', topic: '静かな夜の読書の良さ' },
  { target: '雪男（イエティ）', topic: '温かい鍋料理の良さ' },
];

export const pickRandomPreset = () =>
  PROMPT_PRESETS[Math.floor(Math.random() * PROMPT_PRESETS.length)];
