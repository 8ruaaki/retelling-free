import { useEffect, useRef, useState } from 'react';
import { useExperiment } from '../context/ExperimentContext.jsx';
import { ErrorBox, ScreenLayout } from '../components/Layout.jsx';
import { generateCards } from '../lib/ai.js';

/** 【画面③】インプット情報（カード）提示・選択 */
export default function Screen3Cards() {
  const { state, update, goTo, withLoading } = useExperiment();
  const [error, setError] = useState('');
  const started = useRef(false);
  const key = `${state.target}|${state.topic}`;

  const load = async () => {
    setError('');
    try {
      const cards = await withLoading('説得に役立つカードを\n英語で生成しています…', () =>
        generateCards(state.target, state.topic, state.englishLevel),
      );
      // カードが変わったら下流データ（選択・クイズ・回答）を初期化
      update({ cards, cardsKey: key, selectedIds: [], quiz: null, quizKey: '', answers: {}, readingMs: null, quizSaved: false });
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (state.cardsKey !== key || state.cards.length === 0) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id) =>
    update((s) => ({
      selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
    }));

  const count = state.selectedIds.length;

  return (
    <ScreenLayout
      wide
      step={2}
      title="伝えたい情報を選ぼう"
      subtitle={`「${state.target}」に「${state.topic}」を伝えるために使うカードを1枚以上選んでください。`}
      footer={
        <>
          <span className="mr-auto text-[23px] font-bold">{count} / 4 枚選択中</span>
          <button id="cards-next" className="btn btn-primary" disabled={count === 0} onClick={() => goTo(4)}>
            次へ →
          </button>
        </>
      }
    >
      <ErrorBox message={error} onRetry={load} />

      {state.cards.length > 0 && (
        <div className="grid grid-cols-2 gap-6 stagger">
          {state.cards.map((c, i) => {
            const selected = state.selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                id={`card-${c.id}`}
                aria-pressed={selected}
                onClick={() => toggle(c.id)}
                className={`group relative text-left rounded-2xl bg-white p-7 transition-all duration-200 cursor-pointer
                  ${selected
                    ? 'border-[5px] border-black shadow-[8px_8px_0_0_#000] -translate-y-1'
                    : 'border-2 border-gray-300 hover:border-black hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#000]'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="text-[18px] font-bold tracking-[0.25em] text-gray-500">CARD {i + 1}</span>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-black text-[26px] font-black transition-all
                      ${selected ? 'bg-black text-white scale-110' : 'bg-white text-transparent group-hover:text-gray-300'}`}
                  >
                    ✓
                  </span>
                </div>
                <h2 className="mt-2 text-[30px] font-black leading-snug">{c.title}</h2>
                <p className="mt-3 text-[23px] leading-relaxed text-gray-800">{c.body}</p>
              </button>
            );
          })}
        </div>
      )}

      {state.cards.length > 0 && (
        <div className="mt-8 flex justify-center">
          <button id="cards-regenerate" className="btn btn-ghost text-gray-600" onClick={load}>
            ↻ カードを作り直す
          </button>
        </div>
      )}
    </ScreenLayout>
  );
}
