import { useState } from 'react';
import { useExperiment } from '../context/ExperimentContext.jsx';
import { ScreenLayout } from '../components/Layout.jsx';
import { generateTopic } from '../lib/ai.js';

/** 【画面②】お題作成 */
export default function Screen2Topic() {
  const { state, update, goTo, withLoading } = useExperiment();
  const [notice, setNotice] = useState('');

  const canNext = state.target.trim().length > 0 && state.topic.trim().length > 0;

  const generate = async () => {
    update({ target: '', topic: '' }); // 入力を初期化
    setNotice('');
    const r = await withLoading('AI がお題を考えています…', generateTopic);
    update({ target: r.target, topic: r.topic });
    if (r.source === 'preset') setNotice('AI に接続できなかったため、プリセットからお題を選びました。');
  };

  return (
    <ScreenLayout
      step={1}
      title="お題を決めよう"
      subtitle="誰に・何を伝えるかを自由に入力するか、AI に意外な組み合わせを考えてもらいましょう。"
      onBack={() => goTo(1)}
      footer={
        <button id="topic-next" className="btn btn-primary" disabled={!canNext} onClick={() => goTo(3)}>
          次へ →
        </button>
      }
    >
      <section className="card p-10 shadow-[10px_10px_0_0_#000] animate-fade-up">
        <p className="text-[20px] font-bold tracking-[0.25em] text-gray-500 mb-6">MISSION</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-4 text-[34px] font-black leading-snug">
          <span className="text-gray-400">［</span>
          <input
            id="topic-target"
            aria-label="相手"
            className="input w-[260px] text-[29px] font-bold"
            placeholder="相手（例: ゾンビ）"
            value={state.target}
            onChange={(e) => update({ target: e.target.value })}
          />
          <span className="text-gray-400">］</span>
          <span>に</span>
          <span className="text-gray-400">［</span>
          <input
            id="topic-theme"
            aria-label="テーマ"
            className="input w-[340px] text-[29px] font-bold"
            placeholder="テーマ（例: 菜食主義の素晴らしさ）"
            value={state.topic}
            onChange={(e) => update({ topic: e.target.value })}
          />
          <span className="text-gray-400">］</span>
          <span>を伝えよ！</span>
        </div>

        <div className="mt-10 flex items-center gap-4 border-t-2 border-dashed border-gray-300 pt-8">
          <button id="topic-ai-generate" className="btn btn-secondary" onClick={generate}>
            ✦ AIで生成
          </button>
          <p className="text-[21px] text-gray-500">意外性・ギャップのある組み合わせを自動で提案します</p>
        </div>
        {notice && <p className="mt-4 text-[21px] font-bold">ℹ {notice}</p>}
      </section>

      {canNext && (
        <div className="mt-10 rounded-2xl bg-black px-8 py-7 text-white animate-pop-in">
          <p className="text-[18px] font-bold tracking-[0.25em] text-gray-400">PREVIEW</p>
          <p className="mt-2 text-[36px] font-black leading-snug">
            「{state.target}」に「{state.topic}」を伝えよ！
          </p>
        </div>
      )}
    </ScreenLayout>
  );
}
