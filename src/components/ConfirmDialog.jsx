/** 確認ダイアログ（ホームに戻る等） */
export default function ConfirmDialog({ open, title, message, confirmLabel = 'OK', cancelLabel = 'キャンセル', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-pop-in" role="dialog" aria-modal="true">
      <div className="w-[min(92vw,520px)] rounded-3xl border-2 border-black bg-white p-9 shadow-[10px_10px_0_0_#000]">
        <h2 className="text-[34px] font-black mb-3">{title}</h2>
        <p className="text-[23px] leading-relaxed text-gray-700 whitespace-pre-line">{message}</p>
        <div className="mt-8 flex justify-end gap-3">
          <button id="confirm-cancel" className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button id="confirm-ok" className="btn btn-primary" onClick={onConfirm} autoFocus>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
