/**
 * ============================================================
 * リテリング実験システム — Google Apps Script バックエンド (Code.js)
 * ============================================================
 * デプロイ設定:
 *   種類: ウェブアプリ / 実行ユーザー: 自分 / アクセスできるユーザー: 全員（Anyone）
 *
 * スクリプトプロパティ（[プロジェクトの設定] → [スクリプト プロパティ]）:
 *   GEMINI_API_KEY   : Gemini API キー（uploadAudio での文字起こし・判定に使用）【必須】
 *   GEMINI_MODEL     : 任意（既定: gemini-3.8-flash。payload.model が優先）
 *   SPREADSHEET_ID   : 任意（payload.spreadsheetId が無い場合のフォールバック）
 *   DRIVE_FOLDER_ID  : 任意（payload.folderId が無い場合のフォールバック）
 *
 * ※ スプレッドシートID・フォルダIDはコード内にハードコードしないこと。
 * ============================================================
 */

var SHEET_NAME = 'RetellingData';
var DEFAULT_MODEL = 'gemini-3.8-flash';
var CELL_LIMIT = 49000; // セル文字数上限(50,000)の安全マージン

/** カラム定義 [key, ヘッダー表示名] */
var COLUMNS = [
  ['timestamp', 'タイムスタンプ'],
  ['sessionId', 'セッションID'],
  ['participantId', '被験者ID'],
  ['englishLevel', '英語レベル'],
  ['attempt', '試行回数'],
  ['fullPrompt', 'お題'],
  ['cardIds', '選択カードID'],
  ['cardTexts', '選択カード本文'],
  ['readingSec', '読解所要時間（秒）'],
  ['quizCorrect', 'クイズ正答数'],
  ['quizRate', 'クイズ正答率'],
  ['quizDetail', 'クイズ詳細(JSON)'],
  ['keywords', '抽出キーワード一覧'],
  ['audioUrls', '保存音声のドライブURL'],
  ['transcript', 'リテリング確定文字起こし（Gemini）'],
  ['dialogLog', '対話ログ(JSON)'],
  ['cafTotal', 'CAF総合点(/30)'],
  ['cafContent', '内容の正確さと網羅性(/12)'],
  ['cafOrganization', '構成と論理的な流れ(/10)'],
  ['cafLanguage', '言語使用の正確さと流暢さ(/8)'],
  ['cafDetail', 'CAF詳細(JSON)'],
  ['characterFeedback', 'キャラクター定性評価ログ'],
  ['updatedAt', '最終更新'],
];

/** 再挑戦（キーワード選択から）時に複製する範囲（被験者ID〜クイズ詳細） */
var RETRY_COPY_KEYS = [
  'participantId', 'englishLevel', 'fullPrompt', 'cardIds', 'cardTexts',
  'readingSec', 'quizCorrect', 'quizRate', 'quizDetail',
];

/** 再挑戦（カード選択から）時に複製する範囲（被験者ID〜お題：カード選択より前の列） */
var RETRY_COPY_KEYS_CARDS = [
  'participantId', 'englishLevel', 'fullPrompt',
];

// ============================================================
// エントリーポイント
// ============================================================
function doGet() {
  return json_({ ok: true, service: 'retelling-research-gas', time: new Date().toISOString() });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = req.action;

    // 音声の Gemini 処理は時間がかかるため、ロックは書き込み部分でのみ取得する
    var handlers = {
      saveInitial: saveInitial_,
      logReading: logReading_,
      saveQuiz: saveQuiz_,
      uploadAudio: uploadAudio_,
      duplicateForRetry: duplicateForRetry_,
      saveFinalAssessment: saveFinalAssessment_,
    };
    if (!handlers[action]) throw new Error('Unknown action: ' + action);

    var result = handlers[action](req, lock) || {};
    result.ok = true;
    return json_(result);
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// ============================================================
// アクション
// ============================================================

/** 画面① 初期登録 */
function saveInitial_(req, lock) {
  lock.waitLock(20000);
  var sheet = getSheet_(req);
  var now = new Date();
  appendRow_(sheet, {
    timestamp: now,
    sessionId: req.sessionId,
    participantId: req.participantId,
    englishLevel: req.englishLevel,
    attempt: req.attempt || 1,
    updatedAt: now,
  });
  return { sessionId: req.sessionId };
}

/** 画面④ 読解時間・カード本文 */
function logReading_(req, lock) {
  lock.waitLock(20000);
  var sheet = getSheet_(req);
  var row = findRowOrCreate_(sheet, req);
  var cards = req.cards || [];
  setValues_(sheet, row, {
    fullPrompt: req.fullPrompt,
    cardIds: cards.map(function (c) { return c.id; }).join(', '),
    cardTexts: cards.map(function (c) { 
      var levelInfo = c.relevance_level ? ' [Level: ' + c.relevance_level + ']' : '';
      return '[' + c.id + ']' + levelInfo + ' ' + c.title + '\n' + c.body; 
    }).join('\n\n'),
    readingSec: req.readingSec,
  });
  return {};
}

/** 画面⑥ クイズ結果 */
function saveQuiz_(req, lock) {
  lock.waitLock(20000);
  var sheet = getSheet_(req);
  var row = findRowOrCreate_(sheet, req);
  setValues_(sheet, row, {
    quizCorrect: req.correct + ' / ' + req.total,
    quizRate: req.rate,
    quizDetail: JSON.stringify(req.details || []),
  });
  return {};
}

/** 画面⑧ 音声保存 → Gemini 文字起こし・判定 */
function uploadAudio_(req, lock) {
  // 1) ドライブ保存
  var folderId = req.folderId || prop_('DRIVE_FOLDER_ID');
  if (!folderId) throw new Error('DRIVE_FOLDER_ID が未設定です');
  var folder = DriveApp.getFolderById(folderId);
  var mimeType = req.mimeType || 'audio/webm';
  var bytes = Utilities.base64Decode(req.audioBase64);
  var blob = Utilities.newBlob(bytes, mimeType, req.fileName || ('audio_' + Date.now() + '.webm'));
  var file = folder.createFile(blob);
  file.setDescription('participant=' + req.participantId + ' attempt=' + req.attempt + ' turn=' + req.turn + ' session=' + req.sessionId);
  var fileUrl = file.getUrl();

  // 2) Gemini 文字起こし・判定（ロック外で実行）
  var ai = callGeminiWithAudio_(req.evaluationPrompt, req.audioBase64, mimeType, req.model);

  // 3) シートへ追記
  lock.waitLock(20000);
  var sheet = getSheet_(req);
  var row = findRowOrCreate_(sheet, req);
  appendCell_(sheet, row, 'audioUrls', '[T' + req.turn + '] ' + fileUrl);
  appendCell_(sheet, row, 'transcript', '[T' + req.turn + '] ' + (ai.transcript || ''));
  if (req.keywords && req.keywords.length) {
    setValues_(sheet, row, { keywords: req.keywords.join(', ') });
  }
  return {
    fileId: file.getId(),
    fileUrl: fileUrl,
    transcript: ai.transcript || '',
    verdict: ai.verdict === 'convinced' ? 'convinced' : 'rebuttal',
    reply: ai.reply || '',
    reason_ja: ai.reason_ja || '',
  };
}

/**
 * 画面⑨ 再挑戦：前半データを複製した新規行
 *   req.scope = 'keywords'（既定）: 〜クイズ結果までを複製（キーワード選択から再開）
 *   req.scope = 'cards'            : 〜お題までを複製（カード選択から再開）
 */
function duplicateForRetry_(req, lock) {
  lock.waitLock(20000);
  var sheet = getSheet_(req);
  var src = findRow_(sheet, req.sessionId);
  if (!src) throw new Error('複製元の行が見つかりません: ' + req.sessionId);
  var values = sheet.getRange(src, 1, 1, COLUMNS.length).getValues()[0];
  var obj = {};
  var keys = req.scope === 'cards' ? RETRY_COPY_KEYS_CARDS : RETRY_COPY_KEYS;
  keys.forEach(function (k) { obj[k] = values[colIndex_(k) - 1]; });
  var now = new Date();
  obj.timestamp = now;
  obj.updatedAt = now;
  obj.sessionId = req.newSessionId;
  obj.attempt = req.attempt || (Number(values[colIndex_('attempt') - 1]) + 1);
  appendRow_(sheet, obj);
  return { sessionId: req.newSessionId, attempt: obj.attempt };
}

/** 画面⑨ 最終評価保存 */
function saveFinalAssessment_(req, lock) {
  lock.waitLock(20000);
  var sheet = getSheet_(req);
  var row = findRowOrCreate_(sheet, req);
  var caf = req.caf || {};
  var patch = {
    keywords: (req.keywords || []).join(', '),
    transcript: req.transcript,
    dialogLog: JSON.stringify(req.conversation || []),
    cafTotal: caf.total,
    cafContent: caf.content,
    cafOrganization: caf.organization,
    cafLanguage: caf.language,
    cafDetail: JSON.stringify(caf.detail || {}),
    characterFeedback: formatCharacter_(req.character),
  };
  if (req.audioUrls && req.audioUrls.length) {
    patch.audioUrls = req.audioUrls.map(function (u, i) { return '[T' + (i + 1) + '] ' + u; }).join('\n');
  }
  setValues_(sheet, row, patch);
  return {};
}

// ============================================================
// Gemini
// ============================================================
function callGeminiWithAudio_(promptText, audioBase64, mimeType, model) {
  var apiKey = prop_('GEMINI_API_KEY');
  if (!apiKey) throw new Error('スクリプトプロパティ GEMINI_API_KEY が未設定です');
  var m = model || prop_('GEMINI_MODEL') || DEFAULT_MODEL;
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent';
  var body = {
    contents: [{
      role: 'user',
      parts: [
        { text: promptText },
        { inline_data: { mime_type: mimeType, data: audioBase64 } },
      ],
    }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
  };
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': apiKey },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code >= 300) throw new Error('Gemini API エラー (' + code + '): ' + text.slice(0, 300));
  var data = JSON.parse(text);
  var out = ((data.candidates || [])[0] || {}).content;
  var str = out && out.parts ? out.parts.map(function (p) { return p.text || ''; }).join('') : '';
  return parseJsonLoose_(str);
}

function parseJsonLoose_(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    var m = str.match(/[\[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Gemini 応答の JSON 解析に失敗しました');
  }
}

// ============================================================
// シート操作ユーティリティ
// ============================================================
function getSheet_(req) {
  var id = req.spreadsheetId || prop_('SPREADSHEET_ID');
  if (!id) throw new Error('spreadsheetId が指定されていません');
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  ensureHeader_(sheet);
  return sheet;
}

function ensureHeader_(sheet) {
  var headers = COLUMNS.map(function (c) { return c[1]; });
  var range = sheet.getRange(1, 1, 1, headers.length);
  var current = range.getValues()[0];
  if (current.join('') !== headers.join('')) {
    range.setValues([headers]).setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
}

function colIndex_(key) {
  for (var i = 0; i < COLUMNS.length; i++) if (COLUMNS[i][0] === key) return i + 1;
  throw new Error('Unknown column: ' + key);
}

function findRow_(sheet, sessionId) {
  if (!sessionId) return null;
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var hit = sheet.getRange(2, colIndex_('sessionId'), last - 1, 1)
    .createTextFinder(String(sessionId)).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : null;
}

/** sessionId の行を探し、無ければ新規作成（初期登録の取りこぼし対策） */
function findRowOrCreate_(sheet, req) {
  var row = findRow_(sheet, req.sessionId);
  if (row) return row;
  var now = new Date();
  appendRow_(sheet, {
    timestamp: now,
    sessionId: req.sessionId,
    participantId: req.participantId,
    attempt: req.attempt || 1,
    updatedAt: now,
  });
  return sheet.getLastRow();
}

function appendRow_(sheet, obj) {
  var row = COLUMNS.map(function (c) { return obj[c[0]] !== undefined ? clip_(obj[c[0]]) : ''; });
  sheet.appendRow(row);
}

function setValues_(sheet, row, patch) {
  patch.updatedAt = new Date();
  Object.keys(patch).forEach(function (k) {
    if (patch[k] === undefined) return;
    sheet.getRange(row, colIndex_(k)).setValue(clip_(patch[k]));
  });
}

function appendCell_(sheet, row, key, line) {
  var cell = sheet.getRange(row, colIndex_(key));
  var cur = String(cell.getValue() || '');
  cell.setValue(clip_(cur ? cur + '\n' + line : line));
}

function clip_(v) {
  if (typeof v === 'string' && v.length > CELL_LIMIT) return v.slice(0, CELL_LIMIT) + '…(truncated)';
  return v;
}

function formatCharacter_(c) {
  if (!c) return '';
  var lines = [];
  if (c.summary) lines.push('【ひとこと】' + c.summary);
  if (c.plausibility) lines.push('【納得度】' + c.plausibility.score + '/100 ' + (c.plausibility.comment || ''));
  if (c.pragmaticImpact) lines.push('【感情・態度】' + (c.pragmaticImpact.comment || ''));
  if (c.logicGaps && c.logicGaps.length) lines.push('【論理の欠落】' + c.logicGaps.join(' / '));
  return lines.join('\n');
}

function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 初回のみ手動実行：Drive / Spreadsheet / UrlFetch の権限承認用 */
function authorize() {
  DriveApp.getRootFolder();
  SpreadsheetApp.getActiveSpreadsheet && SpreadsheetApp.getActiveSpreadsheet();
  UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
  console.log('authorized');
}
