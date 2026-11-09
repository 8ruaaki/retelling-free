// ============================================================
// 環境変数の集約
// ============================================================
export const CONFIG = {
  gasUrl: import.meta.env.VITE_GAS_WEBAPP_URL || '',
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  geminiModel: import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.8-flash',
  spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID || '',
  driveFolderId: import.meta.env.VITE_DRIVE_FOLDER_ID || '',
};

const isPlaceholder = (v) => !v || /x{5,}|y{5,}/i.test(v);

/** GAS が正しく設定されているか（未設定時はモックモード） */
export const isGasConfigured = () => !isPlaceholder(CONFIG.gasUrl) && !isPlaceholder(CONFIG.spreadsheetId);

/** Gemini API キーが設定されているか */
export const isGeminiConfigured = () => !isPlaceholder(CONFIG.geminiApiKey);
