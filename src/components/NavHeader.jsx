import { useState } from 'react';
import { useExperiment } from '../context/ExperimentContext.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

const STEP_LABELS = {
  2: 'お題作成',
  3: 'カード選択',
  4: 'リーディング',
  5: '読解クイズ',
  6: '答え合わせ',
  7: 'キーワード',
  8: 'リテリング',
  9: '総合評価',
};

/** 画面②〜⑨共通ナビゲーションヘッダー */
export default function NavHeader({ onBack, backDisabled = false }) {
  const { state, goTo, resetAll } = useExperiment();
  const [confirmHome, setConfirmHome] = useState(false);
  const back = onBack || (() => goTo(state.screen - 1));

  return (
    <>
      <header className="sticky top-0 z-40 border-b-2 border-black bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[96%] items-center gap-4 px-8 py-4">
          <button id="nav-back" className="btn btn-ghost" onClick={back} disabled={backDisabled}>
            ← 戻る
          </button>
          <button id="nav-home" className="btn btn-ghost" onClick={() => setConfirmHome(true)}>
            ⌂ ホームに戻る
          </button>

          {/* 進捗インジケーター */}
          <ol className="ml-auto hidden lg:flex items-center gap-1.5" aria-label="進捗">
            {Object.entries(STEP_LABELS).map(([n, label]) => {
              const num = Number(n);
              const active = num === state.screen;
              const done = num < state.screen;
              return (
                <li
                  key={n}
                  title={label}
                  className={`flex h-8 items-center justify-center rounded-full border-2 border-black text-[17px] font-bold transition-all duration-300
                    ${active ? 'bg-black text-white px-3' : done ? 'bg-black/80 text-white w-8' : 'bg-white text-black w-8'}`}
                >
                  {active ? `${num - 1}. ${label}` : num - 1}
                </li>
              );
            })}
          </ol>
          <div className="ml-4 text-right text-[18px] leading-tight text-gray-600">
            <div className="font-bold text-black">ID: {state.participantId}</div>
            <div>試行 {state.attempt}</div>
          </div>
        </div>
      </header>

      <ConfirmDialog
        open={confirmHome}
        title="ホームに戻りますか？"
        message={'現在の入力内容・生成データはすべて破棄され、\n被験者情報入力画面に戻ります。'}
        confirmLabel="ホームに戻る"
        onCancel={() => setConfirmHome(false)}
        onConfirm={() => {
          setConfirmHome(false);
          resetAll();
        }}
      />
    </>
  );
}
