# リテリング実験支援・自動評価Webアプリケーション

英語読解・要約（リテリング）における発話変容および認知プロセスを検証するための実験システムです。

## 構成

```
retelling-app-for-research/
├─ gas/                     # Google Apps Script バックエンド
│  ├─ Code.js               #   doPost アクション振り分け・シート/ドライブ/Gemini 処理
│  └─ appsscript.json       #   マニフェスト（実行ユーザー: 自分 / アクセス: 全員）
├─ src/
│  ├─ lib/                  # config / gemini / gas クライアント・AI プロンプト・プリセット
│  ├─ context/              # 実験ステート（戻る操作時の完全復元）
│  ├─ hooks/useRecorder.js  # MediaRecorder + webkitSpeechRecognition
│  ├─ components/           # ヘッダー・ローディング・確認ダイアログ・レイアウト
│  └─ screens/              # 画面①〜⑨
├─ .env.example
└─ index.html
```

技術スタック: React + Vite / Tailwind CSS v4（白黒モノトーン） / GAS / Google スプレッドシート / Google ドライブ / Gemini API

## セットアップ

### 1. フロントエンド

```powershell
npm install
Copy-Item .env.example .env   # 値を編集
npm run dev                   # http://localhost:5173 （Google Chrome 推奨）
```

> `VITE_GAS_WEBAPP_URL` / `VITE_SPREADSHEET_ID` が未設定（プレースホルダのまま）の場合は **モックモード** で動作し、
> GAS への保存は console 出力のみ、音声判定はフロントから直接 Gemini を呼び出します。

### 2. GAS（実験専用の Gmail アカウントで作業）

1. 実験用アカウントでスプレッドシートと音声保存用ドライブフォルダを作成し、それぞれの ID を `.env` に設定
2. [script.google.com](https://script.google.com) で新規プロジェクトを作成し、`gas/Code.js` と `gas/appsscript.json` の内容を貼り付け
   （`appsscript.json` は [プロジェクトの設定] →「appsscript.json マニフェスト ファイルをエディタで表示する」をON）
3. [プロジェクトの設定] → [スクリプト プロパティ] に以下を追加
   | プロパティ | 必須 | 内容 |
   |---|---|---|
   | `GEMINI_API_KEY` | ✔ | 音声文字起こし・判定用 Gemini API キー |
   | `GEMINI_MODEL` | | 既定 `gemini-3.8-flash` |
   | `SPREADSHEET_ID` / `DRIVE_FOLDER_ID` | | ペイロードに無い場合のフォールバック |
4. エディタで `authorize` 関数を一度実行して権限を承認
5. [デプロイ] → [新しいデプロイ] → 種類「ウェブアプリ」／実行ユーザー「自分」／アクセス「全員」
6. 発行された `/exec` URL を `VITE_GAS_WEBAPP_URL` に設定

> スプレッドシートID・フォルダIDは GAS コードにハードコードせず、フロントから毎回 POST ペイロード
> （`spreadsheetId` / `folderId`）で送信します。

## アクション一覧（doPost）

| action | 画面 | 内容 |
|---|---|---|
| `saveInitial` | ① | セッション行の新規作成（被験者ID・英語レベル・attempt=1） |
| `logReading` | ④ | お題・選択カードID/本文・読解所要時間（秒） |
| `saveQuiz` | ⑥ | クイズ正答数・正答率・詳細JSON |
| `uploadAudio` | ⑧ | 音声をドライブ保存 → Gemini で逐語文字起こし＋納得/反論判定＋相手返信 |
| `duplicateForRetry` | ⑨ | 前半データを複製した新規行（attempt+1, 新セッションID）。`scope: 'keywords'`（既定）はクイズ結果まで、`scope: 'cards'` はお題まで（カード選択以前の列）を複製 |
| `saveFinalAssessment` | ⑨ | キーワード・文字起こし・対話ログ・CAF各得点・キャラクター評価 |

各行は `セッションID` 列で一意に識別され、再挑戦（プリ/ポスト）は独立した行として記録されます。

## 計測・評価の仕様メモ

- 読解時間：画面④入室〜「次へ」押下を `performance.now()` で計測（画面非表示、戻って再入室した場合は最後の入室から再計測）
- クイズ：画面④表示と同時にバックグラウンド生成、未完了時のみローディング表示
- リテリング：Web Speech API の文字起こしはプレビュー専用。確定文字起こしは Gemini（フィラー・誤りを保持した逐語）
- 対話：4ターン目以降は妥当な努力があれば納得寄りに判定（無限ループ防止）
- CAF：内容 12 + 構成 10 + 言語 8 = 30 点（合計はフロントで再計算し整合性を保証）
