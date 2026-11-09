// ============================================================
// AI サービス層：各画面で使用する Gemini プロンプトと呼び出し
// ============================================================
import { generateJson } from './gemini.js';
import { pickRandomPreset } from './presets.js';

// ---------- 画面② お題生成 ----------
// LLM は呼び出し間で記憶を持たないが、同一プロンプトには毎回「最も無難な答え」に収束しやすい。
// そこでランダム性はコード側で作ってプロンプトに注入し、直近の出題も回避リストとして渡す。
const TARGET_GENRES = [
  '日本の歴史上の人物', '世界の歴史上の人物', '神話・伝説の存在', '野生動物', '海の生き物',
  '珍しい職業の人', '伝統工芸の職人', 'スポーツ選手', '未来から来た人', '宇宙人', 'ロボット・AI',
  '妖怪', 'おとぎ話の登場人物', '特定の時代の人', '極地や秘境に住む人',
  '架空の職業の人',
];
const THEME_CATEGORIES = [
  '最新テクノロジー', 'インターネットサービス', '食べ物・料理', '健康・運動', '睡眠・生活リズム',
  '勉強法・学問', '芸術・音楽', '読書・文学', 'スポーツ', '旅行・観光', '環境・エコ活動',
  'お金・買い物', '人間関係・コミュニケーション', 'ファッション', '住まい・インテリア',
  '乗り物・交通', 'ペット・動物との暮らし', 'ゲーム・遊び', '季節の行事・文化', '仕事・働き方',
];
const TOPIC_HISTORY_KEY = 'retelling.topicHistory';
const TOPIC_HISTORY_MAX = 15;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function loadTopicHistory() {
  try {
    return JSON.parse(localStorage.getItem(TOPIC_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveTopicHistory(entry) {
  try {
    const next = [entry, ...loadTopicHistory()].slice(0, TOPIC_HISTORY_MAX);
    localStorage.setItem(TOPIC_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* localStorage 不可時は履歴なしで動作 */
  }
}

export async function generateTopic() {
  const genre = pick(TARGET_GENRES);
  const category = pick(THEME_CATEGORIES);
  const history = loadTopicHistory();
  const avoidList = history.length
    ? history.map((h) => `- 「${h.target}」に「${h.topic}」`).join('\n')
    : '（なし）';

  try {
    const r = await generateJson(
      `あなたは英語スピーキング・説得実験の課題作成者です。
「［相手］に［テーマ］を伝えよ！」という形式のお題を1つ作ってください。

今回の指定（必ず従うこと）:
- 相手のジャンル: ${genre}
- テーマのカテゴリ: ${category}

【絶対ルール（実現可能性・妥当性）】:
1. 物理的・身体的・生理的に実行が不可能な組み合わせは厳禁です。
   × 不可の例:
     - 生物学的に死ぬ・害になる組み合わせ（例: 吸血鬼に日光浴、猫にチョコレートの良さ）
     - 体格や物理法則上不可能なもの（例: 力士にスキニージーンズ）
     - 会話や説得自体が成立しない相手（例: 昆虫、無生物）
   ○ 適切な例:
     - 心理的・生活習慣的な抵抗やギャップがあるが、本人がやろうと思えば実行可能なもの
       （例: 「夜型プログラマー」に「朝散歩のメリット」、「現金派の商店主」に「キャッシュレス決済の良さ」、「インドア派の作家」に「キャンプの利点」）
2. 相手は日本語15文字以内、テーマは日本語20文字以内で簡潔に指定してください。
3. テーマは必ず「（対象）のメリット」「（対象）の良さ」「（対象）の利点」という形にしてください（「〜のやり方」「〜の仕組み」は不可）。
4. 中高生〜大学生が平易な英語（CEFR A2〜B1）で論理的に説明できる身近な内容にしてください。

以下は最近出題済みのお題です。相手・テーマともに、これらと同じもの・似たものは絶対に避けてください:
${avoidList}

JSON のみで出力: {"target": "相手", "topic": "テーマ"}`,
      { temperature: 0.8 },
    );
    if (!r?.target || !r?.topic) throw new Error('invalid');
    saveTopicHistory({ target: r.target, topic: r.topic });
    return { ...r, source: 'ai' };
  } catch (e) {
    console.warn('お題生成に失敗。プリセットを使用します', e);
    return { ...pickRandomPreset(), source: 'preset' };
  }
}

// ---------- 画面③ カード生成 ----------
export async function generateCards(target, topic, englishLevel) {
  const r = await generateJson(
    `You are creating reading materials for an English retelling experiment.
Mission for the learner: persuade "${target}" about "${topic}" (given in Japanese; write everything in English).
Learner's English level: ${englishLevel || 'CEFR B1-B2'}

Task: Create exactly 4 information cards that present positive aspects (merits or fun aspects) of the topic from 4 different perspectives.
The merits MUST be based on facts (not just subjective opinions).

Crucially, the 4 cards must represent different levels of relevance/persuasiveness to the specific listener ("${target}"):
1. Highly persuasive: A merit perfectly aligned with the listener's nature/needs.
2. Moderately persuasive: A merit somewhat relevant to the listener's situation.
3. Less persuasive: A merit that the listener might struggle to appreciate.
4. Unpersuasive: A merit completely opposite or irrelevant to the listener's values/lifestyle.
(Example: If target=Ninja, topic=SNS. Highly persuasive = information warfare/manipulation. Unpersuasive = exposing private life for self-expression.)

Requirements for each card:
- "title": a short, catchy English title (max 8 words)
- "body": an English paragraph of 50-80 words. The vocabulary and grammar must be appropriate for the learner's English level.
- "body" MUST be written strictly using the PREP method (Point, Reason, Example, Point).
- "relevance_level": A hidden field (integer 1 to 4) representing the levels described above.

Output JSON only:
{"cards":[{"relevance_level":1,"title":"...","body":"..."}, {"relevance_level":2,"title":"...","body":"..."}, {"relevance_level":3,"title":"...","body":"..."}, {"relevance_level":4,"title":"...","body":"..."}]}`,
    { temperature: 0.9 },
  );

  let rawCards = r.cards || [];
  // Shuffle cards so the subject doesn't know the relevance order
  for (let i = rawCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rawCards[i], rawCards[j]] = [rawCards[j], rawCards[i]];
  }

  const cards = rawCards.slice(0, 4).map((c, i) => ({
    id: `C${i + 1}`,
    title: c.title,
    body: c.body,
    relevance_level: c.relevance_level,
  }));
  if (cards.length !== 4) throw new Error('カードを4枚生成できませんでした');
  return cards;
}

// ---------- 画面④→⑤⑥ クイズ事前生成 ----------
export async function generateQuiz(cards) {
  const r = await generateJson(
    `Create a reading comprehension quiz for the following English cards.
For EACH card, create exactly 2 multiple-choice questions (4 options each) that check understanding of the card's main points.
- Questions and options in English (CEFR B1 level)
- "answerIndex": 0-3 (randomize the position of the correct answer)
- "explanation": 日本語で1〜2文の解説（なぜその選択肢が正解か、本文の根拠を示す）

Cards:
${cards.map((c) => `[${c.id}] ${c.title}\n${c.body}`).join('\n\n')}

Output JSON only:
{"quiz":[{"cardId":"C1","questions":[{"question":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"..."}, {...}]}]}`,
    { temperature: 0.5 },
  );
  const quiz = (r.quiz || []).filter((q) => cards.some((c) => c.id === q.cardId));
  if (quiz.length !== cards.length) throw new Error('クイズ生成結果が不完全です');
  return quiz.map((q) => ({ ...q, questions: q.questions.slice(0, 2) }));
}

// ---------- 画面⑧ 相手キャラの第一声 ----------
export async function generateOpening(target, topic, cards) {
  const r = await generateJson(
    `You are role-playing as "${target}" (described in Japanese) in a chat app.
A learner of English is about to try to convince you about "${topic}".
They will base their argument on the following source cards:
${cards.map((c) => `- ${c.title}: ${c.body}`).join('\n')}

TASK 1: Write your FIRST chat message in English (2-3 short sentences, CEFR A2-B1, casual, in character).
Show some skepticism or a reason why you are not interested.
CRITICAL REQUIREMENT: The very last sentence of your message MUST explicitly ask the learner about the topic ("${topic}", translated to English).
For example, if the topic is "菜食主義の利点", the last sentence should be "What are the benefits of vegetarianism?" or "Tell me about the benefits of vegetarianism!"

TASK 2: Extract exactly 2 to 3 "must-include points" (short English phrases) from the source cards. These are the core logical points the learner MUST mention to successfully convince you.

Output JSON only:
{"message":"...", "mustIncludePoints": ["point 1", "point 2"]}`,
    { temperature: 0.7 },
  );
  return r; // Returns { message, mustIncludePoints }
}

/**
 * 画面⑧ 各ターンの判定プロンプト（GAS / フロント直呼び共通）
 * 音声ファイルと共に Gemini へ渡す
 */
export function buildTurnPrompt({ target, topic, cards, keywords, history, turn, mustIncludePoints }) {
  return `You are role-playing as "${target}" (described in Japanese) in a chat-style persuasion task.
The learner (an English learner) is trying to convince you about "${topic}".
The learner read these source cards beforehand:
${cards.map((c) => `- ${c.title}: ${c.body}`).join('\n')}
Learner's keywords: ${keywords.join(', ') || '(none)'}
Must-include points from the cards:
${(mustIncludePoints || []).map(p => `- ${p}`).join('\n') || '(none)'}

Conversation so far:
${history.map((m) => `${m.role === 'partner' ? 'YOU' : 'LEARNER'}: ${m.text}`).join('\n') || '(none)'}

TASK:
1. Transcribe the attached audio of the learner's latest utterance VERBATIM in English (keep fillers like "uh", "um", false starts and grammatical errors; do NOT correct anything).
2. Judge in character whether you are convinced. 
   CRITICAL RULE for judging: 
   - Check if the learner successfully mentioned ALL of the "Must-include points" across their utterances.
   - You MUST judge as "convinced" if they mentioned the points without major omissions.
   - You MUST judge as "rebuttal" (asking an additional follow-up question) if they clearly omitted any of the "Must-include points".
   - The maximum number of additional questions you can ask is 2. This is turn ${turn}. If turn >= 3, you MUST evaluate as "convinced".
3. Write your in-character reply in English (2-3 short sentences, CEFR A2-B1).
   - CRITICAL RULE FOR REBUTTAL (DO NOT SPOIL THE ANSWER):
     * NEVER mention the answer, facts, or exact keywords from the missing "Must-include points" (e.g., do NOT say "You didn't mention that it saves time and money, so how much does it save?").
     * Instead, act like a skeptical, curious persona who notices something is missing or wants to know more from their own perspective. Ask an open-ended, probing question that prompts the learner to explain that point themselves.
     * Examples:
       - Bad (spoiler): "What about the fact that it is good for the environment because it reduces CO2?"
       - Good (probing): "I see, but does this really help our planet? What kind of effect does it have on nature?"
       - Bad (spoiler): "You forgot to explain that it improves sleep quality."
       - Good (probing): "That sounds nice, but how does it actually affect my health or daily rest?"
   - For convinced: express that you are fully persuaded and how your feelings/actions change.

Output JSON only:
{"transcript":"...","verdict":"rebuttal" | "convinced","reply":"...","reason_ja":"判定理由を日本語で1文"}`;
}

/** GAS 未設定時のフォールバック：フロントから直接 Gemini に音声を渡す */
export async function evaluateTurnDirect(promptText, audioBase64, mimeType) {
  return generateJson(
    [
      { text: promptText },
      { inline_data: { mime_type: mimeType, data: audioBase64 } },
    ],
    { temperature: 0.4 },
  );
}

// ---------- 画面⑨ 総合評価 ----------
export async function generateAssessment({ target, topic, cards, keywords, conversation, englishLevel }) {
  const learnerText = conversation
    .filter((m) => m.role === 'learner')
    .map((m, i) => `(Turn ${i + 1}) ${m.text}`)
    .join('\n');

  return generateJson(
    `あなたは2つの役割で、英語学習者のリテリング（読んだ内容を相手に伝える発話）を評価します。

【タスク情報】
お題: 「${target}」に「${topic}」を伝えよ！
学習者の自己申告英語レベル: ${englishLevel || '不明'}
学習者が読んだカード:
${cards.map((c) => `- [${c.id}] ${c.title}: ${c.body}`).join('\n')}
学習者のキーワードメモ: ${keywords.join(', ')}

【対話ログ】
${conversation.map((m) => `${m.role === 'partner' ? target : '学習者'}: ${m.text}`).join('\n')}

【学習者の発話（文字起こし）】
${learnerText}

========================
■ 役割A：相手キャラクター「${target}」としてのフィードバック（日本語・キャラクター口調）
文法・発音は一切無視し、以下の要素を考慮して、あなた（${target}）の感情や行動がどう動いたかを語ってください。
【考慮する要素】学習者が「どのカードを選んだか（カードの説得力や自身との関連性）」および「カードの情報をどれだけ漏らさずに伝えられたか」
- plausibility: 納得度（0〜100の数値）と、その理由（選んだカードの内容と情報の網羅性を踏まえて、キャラ口調で2〜3文）
- pragmaticImpact: 感情・態度のリアクション（どんな気持ちになり、何をしたくなったか。キャラ口調で2〜3文）
- logicGaps: 相手視点での論理の欠落・もっと聞きたかった点や漏れていた情報（キャラ口調の箇条書き1〜3個）

■ 役割B：英語教師としてのアカデミックCAF評価（横川, 2026 準拠ルーブリック）
合計30点満点:
- content（内容の正確さと網羅性）: 12点満点 — カード内容を正確に、かつ十分に伝えられたか
- organization（構成と論理的な流れ）: 10点満点 — 導入・根拠・結論の構成、談話標識、一貫性
- language（言語使用の正確さと流暢さ）: 8点満点 — 文法・語彙の正確さ、複雑さ、流暢さ（フィラー・言い直しの量）
各観点について、日本語で「good」（良かった点 1〜3個）と「improve」（改善点 1〜3個）を書く。
language には具体的な文法修正例 corrections を 1〜4 個（学習者の実際の発話から抜き出した wrong → 修正後 right、日本語の note）。
teacherComment: 次のステップに向けた教師からの励ましとアドバイス（日本語 3〜4文）。

JSON のみで出力:
{
  "character": {
    "plausibility": {"score": 0, "comment": "..."},
    "pragmaticImpact": {"comment": "..."},
    "logicGaps": ["..."],
    "summary": "キャラ口調のひとこと"
  },
  "caf": {
    "content": {"score": 0, "max": 12, "good": ["..."], "improve": ["..."]},
    "organization": {"score": 0, "max": 10, "good": ["..."], "improve": ["..."]},
    "language": {"score": 0, "max": 8, "good": ["..."], "improve": ["..."],
                 "corrections": [{"wrong": "...", "right": "...", "note": "..."}]},
    "total": 0,
    "teacherComment": "..."
  }
}`,
    { temperature: 0.4 },
  ).then((r) => {
    // 合計点の整合性を保証
    const c = r.caf;
    const clamp = (v, max) => Math.max(0, Math.min(max, Number(v) || 0));
    c.content.score = clamp(c.content.score, 12);
    c.organization.score = clamp(c.organization.score, 10);
    c.language.score = clamp(c.language.score, 8);
    c.total = c.content.score + c.organization.score + c.language.score;
    return r;
  });
}
