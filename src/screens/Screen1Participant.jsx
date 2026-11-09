import { useState } from 'react';
import { useExperiment } from '../context/ExperimentContext.jsx';
import { callGas } from '../lib/gas.js';
import { isGasConfigured, isGeminiConfigured } from '../lib/config.js';
import { ErrorBox } from '../components/Layout.jsx';

/** 【画面①】被験者情報入力 */
export default function Screen1Participant() {
  const { state, update, goTo, withLoading } = useExperiment();
  const [pid, setPid] = useState(state.participantId);
  const [level, setLevel] = useState(state.englishLevel);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');

  const pidValid = /^[0-9]+$/.test(pid);
  const canStart = pidValid && level.trim().length > 0;

  const start = async () => {
    setTouched(true);
    if (!canStart) return;
    setError('');
    try {
      await withLoading('被験者情報を登録しています…', () =>
        callGas('saveInitial', {
          sessionId: state.sessionId,
          participantId: pid,
          englishLevel: level.trim(),
          attempt: 1,
        }),
      );
      update({ participantId: pid, englishLevel: level.trim() });
      goTo(2);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-grid flex items-center justify-center px-6 py-24">
      <main className="w-full max-w-4xl animate-fade-up">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-3xl bg-black text-white text-[47px] font-black shadow-[6px_6px_0_0_#9ca3af]">
            R
          </div>
          <p className="text-[18px] font-bold tracking-[0.3em] text-gray-500">RETELLING RESEARCH</p>
          <h1 className="mt-2 text-[42px] font-black leading-tight">リテリング実験システム</h1>
          <p className="page-sub">被験者情報を入力して実験を開始してください。</p>
        </div>

        <form
          className="card p-9 shadow-[10px_10px_0_0_#000] space-y-7"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <div>
            <label htmlFor="participant-id" className="label">被験者番号</label>
            <input
              id="participant-id"
              className="input font-mono tracking-widest"
              inputMode="numeric"
              autoComplete="off"
              placeholder="例: 1024"
              value={pid}
              onChange={(e) => setPid(e.target.value.trim())}
              onBlur={() => setTouched(true)}
              autoFocus
            />
            {touched && pid && !pidValid && (
              <p className="mt-2 text-[21px] font-bold">✕ 半角数字のみで入力してください</p>
            )}
          </div>

          <div>
            <label htmlFor="english-level" className="label">英語レベル (CEFR)</label>
            <select
              id="english-level"
              className="input"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="" disabled>レベルを選択してください</option>
              <option value="A1">A1 (Beginner)</option>
              <option value="A2">A2 (Elementary)</option>
              <option value="B1">B1 (Intermediate)</option>
              <option value="B2">B2 (Upper Intermediate)</option>
              <option value="C1">C1 (Advanced)</option>
              <option value="C2">C2 (Proficient)</option>
            </select>
          </div>

          <button id="start-button" type="submit" className="btn btn-primary w-full text-[27px] py-4" disabled={!canStart}>
            開始 →
          </button>
        </form>

        <ErrorBox message={error} />

        {(!isGasConfigured() || !isGeminiConfigured()) && (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-gray-400 bg-white/80 p-4 text-[20px] text-gray-600">
            {!isGasConfigured() && <p>● GAS 未設定：<b>モックモード</b>で動作中（データは保存されず console に出力されます）</p>}
            {!isGeminiConfigured() && <p>● Gemini API キー未設定：AI 生成機能は利用できません</p>}
          </div>
        )}
      </main>
    </div>
  );
}
