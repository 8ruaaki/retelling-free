import { useMemo, useState } from 'react';
import { selectedCardsOf, useExperiment } from '../context/ExperimentContext.jsx';
import { ErrorBox, ScreenLayout } from '../components/Layout.jsx';
import { callGas } from '../lib/gas.js';

const LETTERS = ['A', 'B', 'C', 'D'];

/** 【画面⑥】クイズ答え合わせ・解説 */
export default function Screen6QuizResult() {
  const { state, update, goTo, withLoading } = useExperiment();
  const cards = selectedCardsOf(state);
  const [error, setError] = useState('');

  const results = useMemo(() => {
    const rows = [];
    (state.quiz || []).forEach((q) =>
      q.questions.forEach((qq, qi) => {
        const picked = state.answers[`${q.cardId}-${qi}`];
        rows.push({
          cardId: q.cardId,
          qIndex: qi,
          question: qq.question,
          options: qq.options,
          picked,
          answerIndex: qq.answerIndex,
          correct: picked === qq.answerIndex,
          explanation: qq.explanation,
        });
      }),
    );
    return rows;
  }, [state.quiz, state.answers]);

  const correct = results.filter((r) => r.correct).length;
  const total = results.length;
  const rate = total ? correct / total : 0;

  const next = async () => {
    setError('');
    try {
      await withLoading('クイズ結果を保存しています…', () =>
        callGas('saveQuiz', {
          sessionId: state.sessionId,
          participantId: state.participantId,
          attempt: state.attempt,
          correct,
          total,
          rate: +rate.toFixed(4),
          details: results.map(({ cardId, qIndex, question, picked, answerIndex, correct }) => ({
            cardId, qIndex, question, picked, answerIndex, correct,
          })),
        }),
      );
      update({ quizSaved: true });
      goTo(7);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <ScreenLayout
      step={5}
      title="答え合わせ"
      footer={
        <button id="quiz-result-next" className="btn btn-primary" onClick={next}>
          次へ →
        </button>
      }
    >
      {/* スコアヒーロー */}
      <section className="card mb-10 flex items-center gap-10 p-10 shadow-[10px_10px_0_0_#000] animate-pop-in">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3.2" />
            <circle
              cx="18" cy="18" r="15.9" fill="none" stroke="#000" strokeWidth="3.2" strokeLinecap="round"
              strokeDasharray={`${rate * 100} 100`}
              style={{ transition: 'stroke-dasharray 1s cubic-bezier(.2,.8,.2,1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-[34px] font-black">{Math.round(rate * 100)}%</div>
        </div>
        <div>
          <p className="text-[20px] font-bold tracking-[0.25em] text-gray-500">YOUR SCORE</p>
          <p className="mt-1 text-[57px] font-black leading-none">
            {correct} <span className="text-[36px] text-gray-400">/ {total} 問正解</span>
          </p>
          <p className="mt-3 text-[23px] text-gray-600">解説を確認して、次のキーワード作成に活かしましょう。</p>
        </div>
      </section>

      <div className="space-y-6 stagger">
        {results.map((r, i) => {
          const card = cards.find((c) => c.id === r.cardId);
          return (
            <article key={`${r.cardId}-${r.qIndex}`} className="card p-8">
              <div className="flex items-center gap-3">
                <span className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full border-2 border-black px-3 text-[23px] font-black
                  ${r.correct ? 'bg-black text-white' : 'bg-white text-black'}`}>
                  {r.correct ? '○' : '×'}
                </span>
                <span className="text-[20px] font-bold tracking-wider text-gray-500">
                  問{i + 1}　|　{card?.title}
                </span>
              </div>
              <p className="mt-4 text-[26px] font-bold leading-relaxed">{r.question}</p>
              <ul className="mt-4 grid gap-2">
                {r.options.map((opt, oi) => {
                  const isAnswer = oi === r.answerIndex;
                  const isPicked = oi === r.picked;
                  return (
                    <li
                      key={oi}
                      className={`flex items-center gap-3 rounded-xl border-2 px-5 py-3 text-[23px]
                        ${isAnswer ? 'border-black bg-black text-white font-bold' : isPicked ? 'border-black border-dashed bg-white line-through decoration-2' : 'border-gray-200 text-gray-500'}`}
                    >
                      <span className="font-black w-6">{LETTERS[oi]}</span>
                      <span className="flex-1">{opt}</span>
                      {isAnswer && <span className="text-[18px] font-bold tracking-wider">正解</span>}
                      {isPicked && !isAnswer && <span className="text-[18px] font-bold tracking-wider no-underline">あなたの回答</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-5 rounded-xl bg-gray-100 px-5 py-4 text-[22px] leading-relaxed">
                <span className="mr-2 font-black">解説</span>
                {r.explanation}
              </div>
            </article>
          );
        })}
      </div>
      <ErrorBox message={error} onRetry={next} />
    </ScreenLayout>
  );
}
