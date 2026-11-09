import { useEffect, useRef, useState } from 'react';
import { selectedCardsOf, useExperiment } from '../context/ExperimentContext.jsx';
import { ErrorBox, ScreenLayout } from '../components/Layout.jsx';
import { callGas } from '../lib/gas.js';

/** 【画面④】リーディング（読解時間は不可視で内部計測） */
export default function Screen4Reading() {
  const { state, update, goTo, withLoading, prefetchQuiz } = useExperiment();
  const cards = selectedCardsOf(state);
  const startRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // 入室時刻を記録（画面上には一切表示しない）
    startRef.current = performance.now();
    // 画面⑤⑥のクイズ・解説を非同期で事前生成
    prefetchQuiz(cards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = async () => {
    const readingMs = Math.round(performance.now() - startRef.current);
    setError('');
    try {
      await withLoading('読解データを保存しています…', () =>
        callGas('logReading', {
          sessionId: state.sessionId,
          participantId: state.participantId,
          attempt: state.attempt,
          fullPrompt: `${state.target}に${state.topic}を伝えよ！`,
          cards: cards.map((c) => ({ id: c.id, title: c.title, body: c.body, relevance_level: c.relevance_level })),
          readingMs,
          readingSec: +(readingMs / 1000).toFixed(3),
        }),
      );
      update({ readingMs });

      // 事前生成の完了を待つ（未完了ならローディング表示）
      await withLoading('クイズを準備しています…', () => prefetchQuiz(cards));
      goTo(5);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <ScreenLayout
      step={3}
      title="カードを読もう"
      subtitle="選んだカードの内容をしっかり読んで理解しましょう。読み終わったら「次へ」を押してください。"
      footer={
        <button id="reading-next" className="btn btn-primary" onClick={next}>
          読み終わった　次へ →
        </button>
      }
    >
      <div className="space-y-7 stagger">
        {cards.map((c, i) => (
          <article key={c.id} className="card p-9 shadow-[6px_6px_0_0_#000] select-text">
            <span className="text-[18px] font-bold tracking-[0.25em] text-gray-500">CARD {i + 1}</span>
            <h2 className="mt-2 text-[34px] font-black leading-snug">{c.title}</h2>
            <p className="mt-4 text-[26px] leading-[1.95]">{c.body}</p>
          </article>
        ))}
      </div>
      <ErrorBox message={error} onRetry={next} />
    </ScreenLayout>
  );
}
