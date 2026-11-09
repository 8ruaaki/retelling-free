// ============================================================
// 実験全体のステート管理
//  - すべての入力・生成データをここで保持するため、
//    「戻る」操作時に各画面の入力内容が完全に復元される
// ============================================================
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { generateQuiz } from '../lib/ai.js';

const newSessionId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const initialState = () => ({
  screen: 1,
  sessionId: newSessionId(),
  participantId: '',
  englishLevel: '',
  attempt: 1,
  // ② お題
  target: '',
  topic: '',
  // ③ カード
  cards: [],
  cardsKey: '',
  selectedIds: [],
  mustIncludePoints: [],
  // ④ 読解時間
  readingMs: null,
  // ⑤⑥ クイズ
  quiz: null,
  quizKey: '',
  answers: {},
  quizSaved: false,
  // ⑦ キーワード
  keywords: [''],
  // ⑧ リテリング
  conversation: [],
  retellingDone: false,
  audioUrls: [],
  // ⑨ 評価
  assessment: null,
  assessmentSaved: false,
});

const Ctx = createContext(null);

export function ExperimentProvider({ children }) {
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState({ active: false, message: '' });
  const quizRef = useRef({ key: '', promise: null });

  const update = useCallback((patch) => {
    setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  }, []);

  const goTo = useCallback((screen) => {
    setState((s) => ({ ...s, screen }));
    window.scrollTo({ top: 0 });
  }, []);

  const resetAll = useCallback(() => {
    quizRef.current = { key: '', promise: null };
    setState(initialState());
    window.scrollTo({ top: 0 });
  }, []);

  /** 事前生成済みクイズのキャッシュを破棄（カード選択からの再挑戦時に使用） */
  const clearQuizCache = useCallback(() => {
    quizRef.current = { key: '', promise: null };
  }, []);

  /** ローディングオーバーレイを表示しながら非同期処理を実行 */
  const withLoading = useCallback(async (message, fn) => {
    setLoading({ active: true, message });
    try {
      return await fn();
    } finally {
      setLoading({ active: false, message: '' });
    }
  }, []);

  /** 画面④表示時：クイズをバックグラウンドで事前生成 */
  const prefetchQuiz = useCallback((cards) => {
    const key = cards.map((c) => c.id + c.title).join('|');
    if (quizRef.current.key === key && quizRef.current.promise) return quizRef.current.promise;
    const promise = generateQuiz(cards)
      .then((quiz) => {
        setState((s) => ({ ...s, quiz, quizKey: key, answers: {}, quizSaved: false }));
        return quiz;
      })
      .catch((e) => {
        // 失敗時は次回 ensureQuiz で再試行できるようリセット
        if (quizRef.current.key === key) quizRef.current = { key: '', promise: null };
        throw e;
      });
    quizRef.current = { key, promise };
    promise.catch(() => {}); // 未処理拒否の警告を抑止
    return promise;
  }, []);

  const value = useMemo(
    () => ({ state, update, goTo, resetAll, loading, withLoading, prefetchQuiz, clearQuizCache }),
    [state, update, goTo, resetAll, loading, withLoading, prefetchQuiz, clearQuizCache],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useExperiment = () => useContext(Ctx);

/** 選択済みカード（表示順は生成順） */
export const selectedCardsOf = (state) => state.cards.filter((c) => state.selectedIds.includes(c.id));

export { newSessionId };
