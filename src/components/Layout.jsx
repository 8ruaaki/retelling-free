import NavHeader from './NavHeader.jsx';

/** 画面②〜⑨の共通レイアウト：ヘッダー＋本文＋下部アクションバー */
export function ScreenLayout({ step, title, subtitle, children, footer, onBack, backDisabled, wide = false }) {
  return (
    <div className="min-h-screen bg-grid">
      <NavHeader onBack={onBack} backDisabled={backDisabled} />
      <main className={`mx-auto px-8 pt-10 pb-36 w-full max-w-[96%]`}>
        {(title || step) && (
          <div className="mb-10 animate-fade-up">
            {step && <span className="step-badge">Step {step}</span>}
            {title && <h1 className="page-title mt-4">{title}</h1>}
            {subtitle && <p className="page-sub">{subtitle}</p>}
          </div>
        )}
        {children}
      </main>
      {footer && <FooterBar>{footer}</FooterBar>}
    </div>
  );
}

export function FooterBar({ children }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-black bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[96%] items-center justify-end gap-6 px-8 py-5">{children}</div>
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div role="alert" className="my-6 rounded-2xl border-2 border-dashed border-black bg-white p-6 animate-fade-up">
      <p className="font-bold">⚠ エラーが発生しました</p>
      <p className="mt-1 text-[21px] text-gray-600 break-all">{message}</p>
      {onRetry && (
        <button id="error-retry" className="btn btn-secondary mt-4" onClick={onRetry}>
          ↻ もう一度試す
        </button>
      )}
    </div>
  );
}
