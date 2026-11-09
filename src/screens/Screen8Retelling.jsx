import { useEffect, useRef, useState } from 'react';
import { selectedCardsOf, useExperiment } from '../context/ExperimentContext.jsx';
import NavHeader from '../components/NavHeader.jsx';
import { ErrorBox } from '../components/Layout.jsx';
import { fmtTime, useRecorder } from '../hooks/useRecorder.js';
import { buildTurnPrompt, evaluateTurnDirect, generateOpening } from '../lib/ai.js';
import { blobToBase64, callGas } from '../lib/gas.js';
import { CONFIG, isGasConfigured } from '../lib/config.js';

const uid = () => Math.random().toString(36).slice(2, 10);

/** 【画面⑧】リテリング本番（SNSチャットUI・ターン制対話） */
export default function Screen8Retelling() {
  const { state, update, goTo } = useExperiment();
  const cards = selectedCardsOf(state);
  const rec = useRecorder();
  const [busy, setBusy] = useState(null); // 'opening' | 'processing' | null
  const [error, setError] = useState('');
  const started = useRef(false);
  const chatEndRef = useRef(null);

  const conversation = state.conversation;
  const learnerTurns = conversation.filter((m) => m.role === 'learner' && !m.pending).length;
  const hasOpening = conversation.some((m) => m.role === 'partner');
  const recording = rec.status !== 'idle';
  const locked = !!busy || state.retellingDone;

  // ---------- 相手キャラの第一声 ----------
  const loadOpening = async () => {
    setError('');
    setBusy('opening');
    try {
      const cards = selectedCardsOf(state);
      const { message, mustIncludePoints } = await generateOpening(state.target, state.topic, cards);
      update((s) => ({
        mustIncludePoints,
        conversation: [...s.conversation, { id: uid(), role: 'partner', text: message }]
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!hasOpening) loadOpening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自動スクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation.length, rec.previewText, busy]);

  // ---------- 録音停止 → 送信・判定 ----------
  const stopAndSend = async () => {
    const preview = rec.previewText;
    const durationSec = rec.elapsed;
    const blob = await rec.stop();
    if (!blob || blob.size === 0) {
      setError('音声が録音されていませんでした。もう一度録音してください。');
      return;
    }
    setError('');
    setBusy('processing');
    const pendingId = uid();
    const history = state.conversation.filter((m) => !m.pending);
    update((s) => ({
      conversation: [...s.conversation, { id: pendingId, role: 'learner', text: preview || '（音声を送信中…）', pending: true }],
    }));

    try {
      const audioBase64 = await blobToBase64(blob);
      const mimeType = (blob.type || 'audio/webm').split(';')[0];
      const turn = learnerTurns + 1;
      const evaluationPrompt = buildTurnPrompt({
        target: state.target,
        topic: state.topic,
        cards,
        keywords: state.keywords,
        history,
        turn,
        mustIncludePoints: state.mustIncludePoints,
      });

      let result = await callGas('uploadAudio', {
        sessionId: state.sessionId,
        participantId: state.participantId,
        attempt: state.attempt,
        turn,
        mimeType,
        audioBase64,
        fileName: `P${state.participantId}_A${state.attempt}_T${turn}_${new Date().toISOString().replace(/[:.]/g, '-')}.${mimeType.split('/')[1] || 'webm'}`,
        durationSec,
        previewTranscript: preview,
        evaluationPrompt,
        model: CONFIG.geminiModel,
        keywords: state.keywords,
      });

      // GAS 未設定（モック）時はフロントから直接 Gemini で判定
      if (!isGasConfigured() || result.mock) {
        const r = await evaluateTurnDirect(evaluationPrompt, audioBase64, mimeType);
        result = { ...r, fileUrl: '' };
      }

      const convinced = result.verdict === 'convinced';
      update((s) => ({
        conversation: [
          ...s.conversation.map((m) =>
            m.id === pendingId
              ? { ...m, text: result.transcript || preview, preview, audioUrl: result.fileUrl, durationSec, pending: false }
              : m,
          ),
          { id: uid(), role: 'partner', text: result.reply, verdict: result.verdict, reason: result.reason_ja },
        ],
        audioUrls: result.fileUrl ? [...s.audioUrls, result.fileUrl] : s.audioUrls,
        retellingDone: convinced,
      }));
    } catch (e) {
      // 失敗時は保留中の吹き出しを取り除き、再録音できるようにする
      update((s) => ({ conversation: s.conversation.filter((m) => m.id !== pendingId) }));
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const canRecord = hasOpening && !locked;

  return (
    <div className="flex h-screen flex-col bg-mist">
      <NavHeader backDisabled={!!busy || recording} />

      {/* ---------- 上部操作バー ---------- */}
      <div className="border-b-2 border-black bg-white">
        <div className="mx-auto flex w-full max-w-[96%] items-center gap-4 px-8 py-4">
          {!recording ? (
            <button id="rec-start" className="btn btn-primary" onClick={rec.start} disabled={!canRecord}>
              <span className="h-3.5 w-3.5 rounded-full bg-white" /> 録音開始
            </button>
          ) : (
            <button id="rec-stop" className="btn btn-secondary" onClick={stopAndSend} disabled={!!busy}>
              <span className="h-3.5 w-3.5 rounded-[3px] bg-current" /> 録音停止
            </button>
          )}
          <button id="rec-pause" className="btn btn-secondary px-5" onClick={rec.pause} disabled={!recording || !!busy}>
            {rec.status === 'paused' ? '▶ 再開' : '❚❚ 一時停止'}
          </button>
          <button id="rec-reset" className="btn btn-secondary px-5" onClick={rec.reset} disabled={!recording || !!busy}>
            ↺ リセット
          </button>

          <div className="ml-auto flex items-center gap-3">
            <span className={`h-3.5 w-3.5 rounded-full ${rec.status === 'recording' ? 'bg-black rec-pulse' : 'bg-gray-300'}`} />
            <span id="rec-timer" className="font-mono text-[34px] font-bold tabular-nums">{fmtTime(rec.elapsed)}</span>
          </div>
        </div>
        {!rec.speechSupported && (
          <p className="mx-auto w-full max-w-[96%] px-8 pb-2 text-[18px] text-gray-500">
            ※ このブラウザはリアルタイム文字起こしに未対応です（Google Chrome を推奨）。録音は可能です。
          </p>
        )}
      </div>

      {/* ---------- チャットエリア ---------- */}
      <main className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[85%] space-y-6 px-8 py-10">
          <div className="mx-auto w-fit rounded-full border-2 border-black bg-white px-5 py-1.5 text-[21px] font-bold">
            「{state.target}」に「{state.topic}」を伝えよ！
          </div>

          {conversation.map((m) =>
            m.role === 'partner' ? (
              <PartnerBubble key={m.id} name={state.target} text={m.text} verdict={m.verdict} />
            ) : (
              <LearnerBubble key={m.id} text={m.text} pending={m.pending} audioUrl={m.audioUrl} />
            ),
          )}

          {/* 録音中のリアルタイムプレビュー */}
          {recording && (
            <LearnerBubble live text={rec.previewText || (rec.status === 'paused' ? '（一時停止中）' : 'Listening…')} />
          )}

          {busy && <TypingBubble name={state.target} />}

          <ErrorBox message={error || rec.error} onRetry={!hasOpening ? loadOpening : undefined} />

          {state.retellingDone && (
            <div className="animate-pop-in mt-6 rounded-2xl bg-black p-8 text-center text-white">
              <p className="text-[20px] font-bold tracking-[0.3em] text-gray-400">MISSION COMPLETE</p>
              <p className="mt-2 text-[34px] font-black">「{state.target}」を説得できました！</p>
              <button id="go-assessment" className="btn mt-6 bg-white text-black border-2 border-white hover:-translate-y-0.5" onClick={() => goTo(9)}>
                総合評価へ →
              </button>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </main>

      {/* ---------- 下部キーワードトレイ ---------- */}
      <footer className="border-t-2 border-black bg-white">
        <div className="mx-auto flex w-full max-w-[96%] items-center gap-5 px-8 py-4">
          <span className="shrink-0 text-[20px] font-bold tracking-[0.2em] text-gray-500">KEYWORDS</span>
          <div className="scroll-thin flex flex-1 items-center gap-3 overflow-x-auto py-1">
            {state.keywords.map((k, i) => (
              <span
                key={i}
                className="shrink-0 rounded-full border-2 border-black bg-white px-5 py-2 text-[23px] font-bold shadow-[2px_2px_0_0_#000]"
              >
                {k}
              </span>
            ))}
          </div>
          <button
            id="go-assessment-footer"
            className="btn btn-primary shrink-0"
            disabled={!state.retellingDone}
            onClick={() => goTo(9)}
          >
            総合評価へ →
          </button>
        </div>
      </footer>
    </div>
  );
}

// ---------- 吹き出しコンポーネント ----------
function Avatar({ name }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-[26px] font-black">
      {name?.slice(0, 1)}
    </div>
  );
}

function PartnerBubble({ name, text, verdict }) {
  return (
    <div className="flex items-end gap-3 animate-fade-up">
      <Avatar name={name} />
      <div className="max-w-[72%]">
        <p className="mb-1 ml-1 text-[18px] font-bold text-gray-500">
          {name}
          {verdict === 'convinced' && <span className="ml-2 rounded-full bg-black px-2 py-0.5 text-[16px] text-white">納得</span>}
        </p>
        <div className="rounded-3xl rounded-bl-md border-2 border-black bg-white px-6 py-4 text-[25px] leading-relaxed shadow-[3px_3px_0_0_#000]">
          {text}
        </div>
      </div>
    </div>
  );
}

function LearnerBubble({ text, pending, live, audioUrl }) {
  return (
    <div className="flex justify-end animate-fade-up">
      <div className="max-w-[72%]">
        <div
          className={`rounded-3xl rounded-br-md px-6 py-4 text-[25px] leading-relaxed
            ${live ? 'border-2 border-dashed border-black bg-white text-gray-700' : 'bg-black text-white'}
            ${pending ? 'opacity-60' : ''}`}
        >
          {text}
        </div>
        <p className="mt-1 mr-1 text-right text-[17px] text-gray-500">
          {live ? '● 録音中（プレビュー）' : pending ? '送信中…' : audioUrl ? (
            <a href={audioUrl} target="_blank" rel="noreferrer" className="underline">音声ファイル</a>
          ) : 'You'}
        </p>
      </div>
    </div>
  );
}

function TypingBubble({ name }) {
  return (
    <div className="flex items-end gap-3 animate-fade-up">
      <Avatar name={name} />
      <div className="flex items-center gap-3 rounded-3xl rounded-bl-md border-2 border-black bg-white px-6 py-4">
        <span className="flex gap-1.5">
          <span className="typing-dot h-2.5 w-2.5 rounded-full bg-black" />
          <span className="typing-dot h-2.5 w-2.5 rounded-full bg-black" />
          <span className="typing-dot h-2.5 w-2.5 rounded-full bg-black" />
        </span>
        <span className="text-[22px] italic text-gray-600">{name} is typing</span>
      </div>
    </div>
  );
}
