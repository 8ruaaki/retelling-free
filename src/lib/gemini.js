// ============================================================
// Gemini API クライアント（REST / generateContent）
// ============================================================
import { CONFIG, isGeminiConfigured } from './config.js';

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/**
 * Gemini に JSON 出力を要求して呼び出す
 * @param {Array|string} parts  テキスト or parts 配列
 * @param {object} opts { temperature, systemInstruction }
 */
export async function generateJson(parts, opts = {}) {
  if (!isGeminiConfigured()) throw new Error('Gemini API キーが未設定です（.env の VITE_GEMINI_API_KEY）');

  const body = {
    contents: [{ role: 'user', parts: typeof parts === 'string' ? [{ text: parts }] : parts }],
    generationConfig: {
      temperature: opts.temperature ?? 0.9,
      responseMimeType: 'application/json',
    },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  const res = await fetch(ENDPOINT(CONFIG.geminiModel), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': CONFIG.geminiApiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini API エラー (${res.status}): ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return parseJsonLoose(text);
}

/** ```json ... ``` 等で囲まれていても JSON を取り出す */
export function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/[\[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Gemini の応答を JSON として解析できませんでした');
  }
}
