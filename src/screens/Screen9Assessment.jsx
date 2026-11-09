import { useEffect, useRef, useState } from 'react';
import { newSessionId, selectedCardsOf, useExperiment } from '../context/ExperimentContext.jsx';
import { ErrorBox, ScreenLayout } from '../components/Layout.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { generateAssessment } from '../lib/ai.js';
import { callGas } from '../lib/gas.js';

/** 【画面⑨】総合評価 ＆ 再挑戦 */
export default function Screen9Assessment() {
  const { state, update, goTo, resetAll, withLoading, clearQuizCache } = useExperiment();
  const cards = selectedCardsOf(state);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // 'home' | 'retryCards' | 'retryKeywords' | null
  const started = useRef(false);
  const a = state.assessment;

  const run = async () => {
    setError('');
    try {
      const assessment =
        state.assessment ||
        (await withLoading('相手キャラクターと英語教師が\nあなたの発話を評価しています…', () =>
          generateAssessment({
            target: state.target,
            topic: state.topic,
            cards,
            keywords: state.keywords,
            conversation: state.conversation,
            englishLevel: state.englishLevel,
          }),
        ));
      update({ assessment });

      if (!state.assessmentSaved) {
        const learner = state.conversation.filter((m) => m.role === 'learner');
        await withLoading('評価結果を保存しています…', () =>
          callGas('saveFinalAssessment', {
            sessionId: state.sessionId,
            participantId: state.participantId,
            attempt: state.attempt,
            keywords: state.keywords,
            audioUrls: state.audioUrls,
            transcript: learner.map((m, i) => `[T${i + 1}] ${m.text}`).join('\n'),
            conversation: state.conversation.map(({ role, text, verdict, audioUrl, preview, durationSec }) => ({
              role, text, verdict, audioUrl, preview, durationSec,
            })),
            caf: {
              total: assessment.caf.total,
              content: assessment.caf.content.score,
              organization: assessment.caf.organization.score,
              language: assessment.caf.language.score,
              detail: assessment.caf,
            },
            character: assessment.character,
          }),
        );
        update({ assessmentSaved: true });
      }
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 再挑戦
   *   mode = 'cards'    : 同じ4枚のカードから選び直す（画面③へ）
   *   mode = 'keywords' : 同じカードセットでキーワード作成から（画面⑦へ）
   */
  const retry = async (mode) => {
    setConfirm(null);
    setError('');
    const nextSession = newSessionId();
    const nextAttempt = state.attempt + 1;
    try {
      await withLoading('再挑戦の準備をしています…', () =>
        callGas('duplicateForRetry', {
          sessionId: state.sessionId,
          newSessionId: nextSession,
          participantId: state.participantId,
          attempt: nextAttempt,
          scope: mode,
        }),
      );
      const common = {
        sessionId: nextSession,
        attempt: nextAttempt,
        keywords: [''],
        conversation: [],
        retellingDone: false,
        audioUrls: [],
        assessment: null,
        assessmentSaved: false,
      };
      if (mode === 'cards') {
        // カードは維持し、選択・読解・クイズを初期化して画面③から再開
        clearQuizCache();
        update({
          ...common,
          selectedIds: [],
          readingMs: null,
          quiz: null,
          quizKey: '',
          answers: {},
          quizSaved: false,
          screen: 3,
        });
      } else {
        // 同じカードセットで画面⑦から次の試行を開始
        update({ ...common, screen: 7 });
      }
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <ScreenLayout
      wide
      step={8}
      title="総合評価"
      subtitle={`「${state.target}」に「${state.topic}」を伝えよ！ — 試行 ${state.attempt} 回目`}
      onBack={() => goTo(8)}
      footer={
        <>
          <button id="assessment-home" className="btn btn-secondary mr-auto" onClick={() => setConfirm('home')}>
            ⌂ ホームに戻る
          </button>
          <button id="assessment-retry-cards" className="btn btn-secondary" onClick={() => setConfirm('retryCards')} disabled={!state.assessmentSaved}>
            ↻ 再挑戦（カード選択）
          </button>
          <button id="assessment-retry-keywords" className="btn btn-primary" onClick={() => setConfirm('retryKeywords')} disabled={!state.assessmentSaved}>
            ↻ 再挑戦（キーワード選択）
          </button>
        </>
      }
    >
      <ErrorBox message={error} onRetry={run} />

      {a && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <CharacterFeedback name={state.target} data={a.character} />
          <CafAssessment data={a.caf} />
        </div>
      )}

      <ConfirmDialog
        open={confirm === 'home'}
        title="ホームに戻りますか？"
        message={'すべてのデータを初期化し、被験者情報入力画面に戻ります。\n（評価結果は保存済みです）'}
        confirmLabel="ホームに戻る"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          resetAll();
        }}
      />
      <ConfirmDialog
        open={confirm === 'retryCards'}
        title="カード選択から再挑戦しますか？"
        message={`同じお題・同じ4枚のカードから選び直し、${state.attempt + 1}回目のリテリングを行います。`}
        confirmLabel="再挑戦する"
        onCancel={() => setConfirm(null)}
        onConfirm={() => retry('cards')}
      />
      <ConfirmDialog
        open={confirm === 'retryKeywords'}
        title="キーワード選択から再挑戦しますか？"
        message={`同じカードセットでキーワード作成から${state.attempt + 1}回目のリテリングを行います。`}
        confirmLabel="再挑戦する"
        onCancel={() => setConfirm(null)}
        onConfirm={() => retry('keywords')}
      />
    </ScreenLayout>
  );
}

// ============================================================
// 評価軸①：相手キャラクターからのフィードバック
// ============================================================
function CharacterFeedback({ name, data }) {
  const score = Math.max(0, Math.min(100, Number(data?.plausibility?.score) || 0));
  return (
    <section className="card p-8 shadow-[8px_8px_0_0_#000] animate-fade-up">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black text-[36px] font-black text-white">{name.slice(0, 1)}</div>
        <div>
          <p className="text-[18px] font-bold tracking-[0.25em] text-gray-500">CHARACTER FEEDBACK</p>
          <h2 className="text-[31px] font-black">{name}からのひとこと</h2>
        </div>
      </div>
      {data?.summary && (
        <blockquote className="mt-6 rounded-2xl rounded-tl-sm border-2 border-black bg-gray-50 px-6 py-5 text-[26px] font-bold leading-relaxed">
          「{data.summary}」
        </blockquote>
      )}

      <div className="mt-7">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[25px] font-black">① 納得度 <span className="text-[18px] text-gray-500">Plausibility</span></h3>
          <span className="text-[39px] font-black">{score}<span className="text-[21px] text-gray-500"> / 100</span></span>
        </div>
        <div className="mt-2 h-4 overflow-hidden rounded-full border-2 border-black bg-white">
          <div className="h-full bg-black transition-all duration-1000" style={{ width: `${score}%` }} />
        </div>
        <p className="mt-3 text-[23px] leading-relaxed">{data?.plausibility?.comment}</p>
      </div>

      <div className="mt-7 border-t-2 border-dashed border-gray-300 pt-6">
        <h3 className="text-[25px] font-black">② 気持ち・態度の変化 <span className="text-[18px] text-gray-500">Pragmatic Impact</span></h3>
        <p className="mt-2 text-[23px] leading-relaxed">{data?.pragmaticImpact?.comment}</p>
      </div>

      <div className="mt-7 border-t-2 border-dashed border-gray-300 pt-6">
        <h3 className="text-[25px] font-black">③ もっと聞きたかったこと <span className="text-[18px] text-gray-500">Logic Gaps</span></h3>
        <ul className="mt-2 space-y-2">
          {(data?.logicGaps || []).map((g, i) => (
            <li key={i} className="flex gap-3 text-[23px] leading-relaxed">
              <span className="font-black">？</span>
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ============================================================
// 評価軸②：アカデミック CAF 評価（横川, 2026 準拠）
// ============================================================
const CAF_ITEMS = [
  { key: 'content', label: '内容の正確さと網羅性', max: 12 },
  { key: 'organization', label: '構成と論理的な流れ', max: 10 },
  { key: 'language', label: '言語使用の正確さと流暢さ', max: 8 },
];

function CafAssessment({ data }) {
  return (
    <section className="card p-8 shadow-[8px_8px_0_0_#000] animate-fade-up">
      <p className="text-[18px] font-bold tracking-[0.25em] text-gray-500">ACADEMIC CAF ASSESSMENT</p>
      <h2 className="text-[31px] font-black">英語教師からの評価</h2>
      <p className="text-[18px] text-gray-500">横川（2026）準拠ルーブリック</p>

      <div className="mt-6 flex items-end gap-3 rounded-2xl bg-black px-7 py-6 text-white">
        <span className="text-[83px] font-black leading-none">{data.total}</span>
        <span className="mb-2 text-[31px] font-bold text-gray-400">/ 30 点</span>
      </div>

      <div className="mt-6 space-y-6">
        {CAF_ITEMS.map(({ key, label, max }) => {
          const item = data[key] || {};
          return (
            <div key={key} className="rounded-2xl border-2 border-black p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[25px] font-black">{label}</h3>
                <span className="text-[31px] font-black">{item.score}<span className="text-[20px] text-gray-500"> / {max}</span></span>
              </div>
              <div className="mt-2 flex gap-1">
                {Array.from({ length: max }).map((_, i) => (
                  <span key={i} className={`h-2.5 flex-1 rounded-full ${i < item.score ? 'bg-black' : 'bg-gray-200'}`} />
                ))}
              </div>
              <FbList title="良かった点" mark="＋" items={item.good} />
              <FbList title="改善点" mark="－" items={item.improve} />
              {key === 'language' && item.corrections?.length > 0 && (
                <div className="mt-4">
                  <p className="text-[21px] font-black">文法修正例</p>
                  <ul className="mt-2 space-y-3">
                    {item.corrections.map((c, i) => (
                      <li key={i} className="rounded-xl bg-gray-50 p-4 text-[22px] leading-relaxed">
                        <p className="text-gray-500 line-through decoration-2">❌ {c.wrong}</p>
                        <p className="font-bold">⭕ {c.right}</p>
                        {c.note && <p className="mt-1 text-[20px] text-gray-600">{c.note}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border-2 border-dashed border-black p-6">
        <p className="text-[21px] font-black">🎓 先生からのステップアップコメント</p>
        <p className="mt-2 text-[23px] leading-relaxed">{data.teacherComment}</p>
      </div>
    </section>
  );
}

function FbList({ title, mark, items }) {
  if (!items?.length) return null;
  return (
    <div className="mt-4">
      <p className="text-[21px] font-black">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-[22px] leading-relaxed">
            <span className="font-black">{mark}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
