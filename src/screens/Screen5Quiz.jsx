import { selectedCardsOf, useExperiment } from '../context/ExperimentContext.jsx';
import { ScreenLayout } from '../components/Layout.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

/** 【画面⑤】選択カード読解確認クイズ */
export default function Screen5Quiz() {
  const { state, update, goTo } = useExperiment();
  const cards = selectedCardsOf(state);
  const quiz = state.quiz || [];

  const total = quiz.reduce((n, q) => n + q.questions.length, 0);
  const answered = Object.keys(state.answers).length;
  const allAnswered = total > 0 && answered >= total;

  const choose = (cardId, qi, oi) =>
    update((s) => ({ answers: { ...s.answers, [`${cardId}-${qi}`]: oi } }));

  return (
    <ScreenLayout
      step={4}
      title="読解確認クイズ"
      subtitle="カードの内容について、すべての問題に答えてください。"
      footer={
        <>
          <div className="mr-auto flex items-center gap-4">
            <div className="h-3 w-56 overflow-hidden rounded-full border-2 border-black bg-white">
              <div className="h-full bg-black transition-all duration-500" style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
            </div>
            <span className="text-[23px] font-bold">{answered} / {total} 問回答</span>
          </div>
          <button id="quiz-next" className="btn btn-primary" disabled={!allAnswered} onClick={() => goTo(6)}>
            答え合わせへ →
          </button>
        </>
      }
    >
      <div className="space-y-12">
        {quiz.map((q, ci) => {
          const card = cards.find((c) => c.id === q.cardId);
          return (
            <section key={q.cardId} className="animate-fade-up">
              <article className="rounded-2xl border-2 border-black bg-black p-8 text-white">
                <span className="text-[18px] font-bold tracking-[0.25em] text-gray-400">CARD {ci + 1}</span>
                <h2 className="mt-1 text-[31px] font-black">{card?.title}</h2>
                <p className="mt-3 text-[25px] leading-relaxed text-gray-100">{card?.body}</p>
              </article>

              {q.questions.map((qq, qi) => {
                const key = `${q.cardId}-${qi}`;
                const picked = state.answers[key];
                return (
                  <fieldset key={key} className="card mt-5 p-8">
                    <legend className="sr-only">Question {qi + 1}</legend>
                    <p className="text-[26px] font-bold leading-relaxed">
                      <span className="mr-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black text-white text-[21px]">Q{qi + 1}</span>
                      {qq.question}
                    </p>
                    <div className="mt-5 grid gap-3">
                      {qq.options.map((opt, oi) => {
                        const active = picked === oi;
                        return (
                          <button
                            key={oi}
                            id={`quiz-${key}-opt-${oi}`}
                            aria-pressed={active}
                            onClick={() => choose(q.cardId, qi, oi)}
                            className={`flex items-center gap-4 rounded-xl border-2 px-5 py-3.5 text-left text-[23px] transition-all duration-150 cursor-pointer
                              ${active ? 'border-black bg-black text-white shadow-[4px_4px_0_0_#9ca3af]' : 'border-gray-300 bg-white hover:border-black'}`}
                          >
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 font-black text-[20px]
                              ${active ? 'border-white' : 'border-black'}`}>{LETTERS[oi]}</span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </section>
          );
        })}
      </div>
    </ScreenLayout>
  );
}
