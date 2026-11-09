// ============================================================
// 録音フック：MediaRecorder（音声Blob） + webkitSpeechRecognition（プレビュー文字起こし）
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';

const pickMime = () => {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return cands.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
};

export function useRecorder() {
  const [status, setStatus] = useState('idle'); // idle | recording | paused
  const [elapsed, setElapsed] = useState(0); // 秒
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState('');

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recogRef = useRef(null);
  const wantRecogRef = useRef(false);
  const timerRef = useRef(null);
  const stopResolverRef = useRef(null);

  const speechSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // ---------- タイマー ----------
  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };
  const stopTimer = () => clearInterval(timerRef.current);

  // ---------- 音声認識（プレビュー専用） ----------
  const startRecognition = useCallback(() => {
    if (!speechSupported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let interim = '';
      let fin = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t;
        else interim += t;
      }
      if (fin) setFinalText((p) => (p ? `${p} ${fin.trim()}` : fin.trim()));
      setInterimText(interim);
    };
    r.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') console.warn('SpeechRecognition error', e.error);
    };
    // Chrome は無音で自動終了するため、録音中であれば再開
    r.onend = () => {
      setInterimText('');
      if (wantRecogRef.current) {
        try { r.start(); } catch { /* noop */ }
      }
    };
    wantRecogRef.current = true;
    recogRef.current = r;
    try { r.start(); } catch { /* noop */ }
  }, [speechSupported]);

  const stopRecognition = useCallback(() => {
    wantRecogRef.current = false;
    try { recogRef.current?.stop(); } catch { /* noop */ }
    recogRef.current = null;
    setInterimText('');
  }, []);

  // ---------- 操作 ----------
  const start = useCallback(async () => {
    setError('');
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      }
      const mimeType = pickMime();
      const rec = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        stopResolverRef.current?.(blob);
        stopResolverRef.current = null;
      };
      rec.start(1000);
      recorderRef.current = rec;
      setFinalText('');
      setInterimText('');
      setElapsed(0);
      setStatus('recording');
      startTimer();
      startRecognition();
    } catch (e) {
      setError(`マイクにアクセスできません: ${e.message}`);
    }
  }, [startRecognition]);

  const pause = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording') {
      rec.pause();
      stopRecognition();
      stopTimer();
      setStatus('paused');
    } else if (rec.state === 'paused') {
      rec.resume();
      startRecognition();
      startTimer();
      setStatus('recording');
    }
  }, [startRecognition, stopRecognition]);

  /** 録音停止 → Blob を返す */
  const stop = useCallback(
    () =>
      new Promise((resolve) => {
        const rec = recorderRef.current;
        stopRecognition();
        stopTimer();
        setStatus('idle');
        if (!rec || rec.state === 'inactive') return resolve(null);
        stopResolverRef.current = resolve;
        rec.stop();
        recorderRef.current = null;
      }),
    [stopRecognition],
  );

  /** 現在の録音を破棄 */
  const reset = useCallback(() => {
    const rec = recorderRef.current;
    stopResolverRef.current = null;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      rec.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];
    stopRecognition();
    stopTimer();
    setElapsed(0);
    setFinalText('');
    setInterimText('');
    setStatus('idle');
  }, [stopRecognition]);

  // アンマウント時にマイク解放
  useEffect(
    () => () => {
      wantRecogRef.current = false;
      try { recogRef.current?.abort(); } catch { /* noop */ }
      try { recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop(); } catch { /* noop */ }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(timerRef.current);
    },
    [],
  );

  return {
    status, elapsed, error, speechSupported,
    previewText: [finalText, interimText].filter(Boolean).join(' '),
    start, pause, stop, reset,
  };
}

export const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
