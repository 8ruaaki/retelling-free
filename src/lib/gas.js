// ============================================================
// GAS Web App クライアント
//  - CORS プリフライト回避のため Content-Type: text/plain で POST
//  - spreadsheetId / folderId は毎回ペイロードに含める（GAS へのハードコード禁止）
// ============================================================
import { CONFIG, isGasConfigured } from './config.js';

export async function callGas(action, payload = {}) {
  const body = {
    action,
    spreadsheetId: CONFIG.spreadsheetId,
    folderId: CONFIG.driveFolderId,
    ...payload,
  };

  if (!isGasConfigured()) {
    // モックモード：開発・動作確認用
    console.info(`[GAS mock] ${action}`, body);
    await new Promise((r) => setTimeout(r, 300));
    return { ok: true, mock: true };
  }

  const res = await fetch(CONFIG.gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`GAS 通信エラー (${res.status})`);
  const json = await res.json();
  if (!json.ok) throw new Error(`GAS 処理エラー: ${json.error || 'unknown'}`);
  return json;
}

/** Blob → Base64（data: プレフィックス除去） */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
