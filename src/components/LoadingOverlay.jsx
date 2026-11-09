import { useExperiment } from '../context/ExperimentContext.jsx';

/** 全画面ローディング：API呼び出し・GAS保存中の多重クリックを完全抑止 */
export default function LoadingOverlay() {
  const { loading } = useExperiment();
  if (!loading.active) return null;
  return (
    <div
      id="loading-overlay"
      role="alertdialog"
      aria-busy="true"
      aria-live="assertive"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/75 backdrop-blur-sm animate-pop-in"
      onClickCapture={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col items-center gap-6 rounded-3xl border-2 border-black bg-white px-14 py-10 shadow-[8px_8px_0_0_#000]">
        <div className="h-16 w-16 animate-spin rounded-full border-[6px] border-gray-200 border-t-black" />
        <p className="text-[29px] font-black tracking-wide text-center whitespace-pre-line">
          {loading.message || '処理中です…'}
        </p>
      </div>
    </div>
  );
}
