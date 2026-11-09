import { useEffect } from 'react';
import { selectedCardsOf, useExperiment } from '../context/ExperimentContext.jsx';
import NavHeader from '../components/NavHeader.jsx';
import { FooterBar } from '../components/Layout.jsx';

/** 【画面⑦】キーワード抽出・メモ作成（左右独立スクロール） */
export default function Screen7Keywords() {
  const { state, update, goTo } = useExperiment();
  const cards = selectedCardsOf(state);
  const max = cards.length * 3;
  const keywords = state.keywords;
  const filled = keywords.filter((k) => k.trim()).length;

  useEffect(() => {
    if (state.keywords.length === 0) update({ keywords: [''] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAt = (i, v) => update((s) => ({ keywords: s.keywords.map((k, j) => (j === i ? v : k)) }));
  const add = () => keywords.length < max && update((s) => ({ keywords: [...s.keywords, ''] }));
  const remove = (i) =>
    update((s) => {
      const next = s.keywords.filter((_, j) => j !== i);
      return { keywords: next.length ? next : [''] };
    });

  const next = () => {
    update((s) => ({ keywords: s.keywords.map((k) => k.trim()).filter(Boolean) }));
    goTo(8);
  };

  return (
    <div className="flex h-screen flex-col bg-grid">
      <NavHeader backDisabled={state.attempt > 1} />

      <div className="mx-auto w-full max-w-[96%] px-8 pt-6 pb-4">
        <span className="step-badge">Step 6</span>
        <h1 className="page-title mt-2">キーワードを書き出そう</h1>
        <p className="text-[23px] text-gray-600">
          リテリングで使いたいキーワードを最大 <b className="text-black">{max}</b> 個まで（1つにつき3語程度）メモしてください。
          {state.attempt > 1 && <b className="ml-2 text-black">［再挑戦 {state.attempt} 回目］</b>}
        </p>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-[96%] flex-1 gap-8 px-8 pb-28">
        {/* 左ペイン：カード本文参照 */}
        <section className="scroll-thin min-h-0 flex-1 overflow-y-auto rounded-2xl border-2 border-black bg-white p-8" aria-label="カード本文">
          <div className="space-y-8">
            {cards.map((c, i) => (
              <article key={c.id} className={i > 0 ? 'border-t-2 border-dashed border-gray-300 pt-8' : ''}>
                <span className="text-[18px] font-bold tracking-[0.25em] text-gray-500">CARD {i + 1}</span>
                <h2 className="mt-1 text-[30px] font-black">{c.title}</h2>
                <p className="mt-3 text-[25px] leading-[1.9]">{c.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 右ペイン：キーワード入力 */}
        <aside className="scroll-thin flex min-h-0 w-[480px] shrink-0 flex-col overflow-y-auto rounded-2xl border-2 border-black bg-white p-8" aria-label="キーワード入力">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[26px] font-black">キーワード</h2>
            <span className="text-[21px] font-bold text-gray-500">{keywords.length} / {max}</span>
          </div>
          <ol className="space-y-3">
            {keywords.map((k, i) => (
              <li key={i} className="flex items-center gap-2 animate-fade-up">
                <span className="w-6 text-right text-[20px] font-bold text-gray-400">{i + 1}</span>
                <input
                  id={`keyword-${i}`}
                  className="input flex-1 py-2.5 text-[23px]"
                  placeholder="e.g. healthy brain food"
                  value={k}
                  onChange={(e) => setAt(i, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && add()}
                  autoFocus={i === keywords.length - 1 && i > 0}
                />
                <button
                  id={`keyword-remove-${i}`}
                  aria-label={`キーワード${i + 1}を削除`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-black text-[26px] font-black transition hover:bg-black hover:text-white cursor-pointer"
                  onClick={() => remove(i)}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          <button id="keyword-add" className="btn btn-secondary mt-5 w-full" onClick={add} disabled={keywords.length >= max}>
            ＋ キーワードを追加
          </button>
          {keywords.length >= max && <p className="mt-2 text-center text-[20px] text-gray-500">上限に達しました</p>}
        </aside>
      </div>

      <FooterBar>
        <span className="mr-auto text-[23px] font-bold">{filled} 個入力済み</span>
        <button id="keywords-next" className="btn btn-primary" disabled={filled === 0} onClick={next}>
          リテリングへ →
        </button>
      </FooterBar>
    </div>
  );
}
