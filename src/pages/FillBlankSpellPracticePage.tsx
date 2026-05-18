/**
 * 填空题拼写练习页面
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FillBlankGameState, FillBlankItem, FillBlankSessionResult } from '../types';
import {
  checkFillBlankAnswer,
  generateSessionResult,
  nextFillBlankItem,
  showHint,
} from '../services/learning/fillBlankGame';
import { addFillBlankWrongAnswer, addFillBlankWrongAnswersFromItems } from '../services/learning/fillBlankWrongAnswer';
import { isFillBlankFavorited, toggleFillBlankFavorite } from '../services/learning/fillBlankFavorite';
import { saveFillBlankSession } from '../services/storage/indexedDB';

type Mode = 'question' | 'result';

function normalizeAnswer(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export default function FillBlankSpellPracticePage() {
  const navigate = useNavigate();

  const [fillBlankItems, setFillBlankItems] = useState<FillBlankItem[]>([]);
  const [gameState, setGameState] = useState<FillBlankGameState | null>(null);
  const [remainingItems, setRemainingItems] = useState<FillBlankItem[]>([]);
  const [historyItems, setHistoryItems] = useState<FillBlankItem[]>([]);
  const [sessionResult, setSessionResult] = useState<FillBlankSessionResult | null>(null);

  const [mode, setMode] = useState<Mode>('question');

  const [input, setInput] = useState('');
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // 闭环系统管理状态
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('other');
  const [wrongAnswersMap, setWrongAnswersMap] = useState<Map<string, string>>(new Map()); // item.id -> userAnswer
  const [wrongCount, setWrongCount] = useState(0);
  const [savingWrong, setSavingWrong] = useState(false);
  const [wrongSaved, setWrongSaved] = useState(false);
  const [showEarlySubmitConfirm, setShowEarlySubmitConfirm] = useState(false);

  // 进度保存与恢复相关
  const [savedProgressData, setSavedProgressData] = useState<any>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);

  // 错题回顾星标与批量收藏相关
  const [wrongFavoriteMap, setWrongFavoriteMap] = useState<Map<string, boolean>>(new Map());
  const [batchFavLoading, setBatchFavLoading] = useState(false);
  const [batchFavSuccess, setBatchFavSuccess] = useState(false);

  const isAnsweredRef = useRef(false);
  const isResultModeRef = useRef(false);
  const isCorrectRef = useRef(false);
  const isProcessingRef = useRef(false);
  const handleNextRef = useRef<() => void>(() => undefined);
  const handlePrevRef = useRef<() => void>(() => undefined);
  const handleRetryRef = useRef<() => void>(() => undefined);
  const handleSubmitRef = useRef<() => void>(() => undefined);
  const handleToggleFavoriteRef = useRef<() => void>(() => undefined);

  const progress = useMemo(() => {
    if (!fillBlankItems.length) return 0;
    return historyItems.length + 1;
  }, [fillBlankItems.length, historyItems.length]);

  const progressPercent = useMemo(() => {
    if (!fillBlankItems.length) return 0;
    return (progress / fillBlankItems.length) * 100;
  }, [fillBlankItems.length, progress]);

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    isAnsweredRef.current = !!gameState?.isAnswered;
  }, [gameState?.isAnswered]);

  useEffect(() => {
    isResultModeRef.current = mode === 'result';
  }, [mode]);

  useEffect(() => {
    isCorrectRef.current = !!gameState?.isCorrect;
    isProcessingRef.current = false;
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      
      // Ctrl key to favorite
      if ((e.key === 'Control' || e.key === 'Meta') && !e.repeat) {
        e.preventDefault();
        handleToggleFavoriteRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleToggleFavoriteRef.current();
        return;
      }

      if (isResultModeRef.current) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevRef.current();
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextRef.current();
        return;
      }

      if (!isAnsweredRef.current && (e.key === 'Enter' || e.key === ' ' || e.key === 'Shift')) {
        e.preventDefault();
        if (e.repeat) return;
        handleSubmitRef.current();
        return;
      }

      if (isAnsweredRef.current && (e.key === 'Enter' || e.key === ' ' || e.key === 'Shift')) {
        e.preventDefault();
        if (e.repeat) return;
        if (isCorrectRef.current) {
          handleNextRef.current();
        } else {
          handleRetryRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function loadItems() {
    const stored = sessionStorage.getItem('fillBlankPractice');
    const storedArchiveId = sessionStorage.getItem('currentArchiveId');
    const storedCategory = sessionStorage.getItem('currentCategory');

    if (!stored) {
      navigate('/fill-blank-import');
      return;
    }

    try {
      const parsed: FillBlankItem[] = JSON.parse(stored);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        navigate('/fill-blank-import');
        return;
      }
      setFillBlankItems(parsed);

      let actualArchiveId = storedArchiveId || null;
      if (storedArchiveId) setArchiveId(storedArchiveId);
      if (storedCategory) setCategory(storedCategory);
      else setCategory('other');

      // 检查并恢复进度
      const key = `fill-blank-spell-progress-${actualArchiveId || 'temp'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const progressData = JSON.parse(saved);
          if (progressData && progressData.quizId === parsed[0]?.id && typeof progressData.currentIndex === 'number' && progressData.currentIndex < parsed.length) {
            setSavedProgressData(progressData);
            setShowProgressModal(true);
          }
        } catch (e) {
          console.error('解析答题进度失败:', e);
        }
      }

      startGame(parsed);
    } catch {
      navigate('/fill-blank-import');
    }
  }

  const handleResumeProgress = () => {
    if (savedProgressData) {
      setHistoryItems(savedProgressData.historyItems || []);
      setRemainingItems(savedProgressData.remainingItems || []);
      setGameState(savedProgressData.gameState || null);
      setWrongAnswersMap(new Map(savedProgressData.wrongAnswersMap || []));
      setWrongCount(savedProgressData.wrongCount || 0);
      setMode('question');
      if (savedProgressData.gameState?.currentItem) {
        refreshFavoriteState(savedProgressData.gameState.currentItem);
      }
    }
    setShowProgressModal(false);
  };

  const handleRestartProgress = () => {
    const key = `fill-blank-spell-progress-${archiveId || 'temp'}`;
    localStorage.removeItem(key);
    startGame(fillBlankItems);
    setShowProgressModal(false);
  };

  // 实时保存进度
  useEffect(() => {
    if (fillBlankItems.length === 0 || mode === 'result' || showProgressModal || !gameState) return;

    const key = `fill-blank-spell-progress-${archiveId || 'temp'}`;
    const progressData = {
      quizId: fillBlankItems[0]?.id,
      currentIndex: historyItems.length,
      historyItems,
      remainingItems,
      gameState,
      wrongAnswersMap: Array.from(wrongAnswersMap.entries()),
      wrongCount,
    };
    localStorage.setItem(key, JSON.stringify(progressData));
  }, [historyItems, remainingItems, gameState, wrongAnswersMap, wrongCount, mode, fillBlankItems, archiveId, showProgressModal]);

  // 结算页加载错题收藏状态
  useEffect(() => {
    if (mode === 'result') {
      const loadWrongFavStatus = async () => {
        const wrongItems = getWrongQuestions();
        const map = new Map<string, boolean>();
        for (const item of wrongItems) {
          map.set(item.question.id, await isFillBlankFavorited(item.question.id));
        }
        setWrongFavoriteMap(map);
      };
      loadWrongFavStatus();
    }
  }, [mode]);

  const getWrongQuestions = () => {
    const items: Array<{ question: FillBlankItem; userAnswer: string }> = [];
    fillBlankItems.forEach(q => {
      const uAns = wrongAnswersMap.get(q.id);
      if (uAns) {
        items.push({ question: q, userAnswer: uAns });
      }
    });
    return items;
  };

  const handleToggleWrongFavorite = async (question: FillBlankItem) => {
    const result = await toggleFillBlankFavorite(question, category);
    setWrongFavoriteMap(prev => new Map(prev).set(question.id, result.added));
  };

  const handleBatchFavoriteWrong = async () => {
    const wrongItems = getWrongQuestions();
    setBatchFavLoading(true);
    try {
      for (const item of wrongItems) {
        const isFav = wrongFavoriteMap.get(item.question.id);
        if (!isFav) {
          await toggleFillBlankFavorite(item.question, category);
        }
      }
      
      const updatedMap = new Map(wrongFavoriteMap);
      wrongItems.forEach(item => updatedMap.set(item.question.id, true));
      setWrongFavoriteMap(updatedMap);
      setBatchFavSuccess(true);
      setTimeout(() => setBatchFavSuccess(false), 3000);
    } catch (err) {
      console.error('批量收藏失败:', err);
    } finally {
      setBatchFavLoading(false);
    }
  };

  const handleSaveWrongAnswers = async () => {
    const wrongItems = getWrongQuestions();
    if (wrongItems.length === 0) return;
    
    setSavingWrong(true);
    setWrongSaved(false);
    
    try {
      const itemsToSave = wrongItems.map(item => ({
        fillBlankItem: item.question,
        userAnswer: item.userAnswer,
        category: category,
        hints: item.question.hints
      }));
      await addFillBlankWrongAnswersFromItems(itemsToSave);
      setWrongSaved(true);
    } catch (err) {
      console.error('保存错题失败:', err);
      alert(`保存错题失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setSavingWrong(false);
    }
  };

  const handleEarlySubmit = () => {
    if (!gameState) return;
    const categoryName = 'spell';
    const finalResult = generateSessionResult(gameState, fillBlankItems.length, categoryName);
    setSessionResult(finalResult);
    setMode('result');
    localStorage.removeItem(`fill-blank-spell-progress-${archiveId || 'temp'}`);
  };

  async function refreshFavoriteState(item: FillBlankItem | null) {
    if (!item) {
      setIsFavorite(false);
      return;
    }
    try {
      const fav = await isFillBlankFavorited(item.id);
      setIsFavorite(fav);
    } catch {
      setIsFavorite(false);
    }
  }

  function startGame(items: FillBlankItem[]) {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    const initial: FillBlankGameState = {
      currentItem: shuffled[0] || null,
      currentAnswer: '',
      isAnswered: false,
      isCorrect: false,
      hints: [],
      hintsUsed: 0,
      score: 0,
      streak: 0,
      totalAttempts: 0,
      correctAttempts: 0,
      startTime: new Date(),
    };
    const remaining = [...shuffled];
    remaining.shift();
    
    setGameState(initial);
    setRemainingItems(remaining);
    setHistoryItems([]);
    setSessionResult(null);
    setMode('question');
    setInput('');
    setWrongAnswersMap(new Map());
    setWrongCount(0);
    setWrongSaved(false);
    refreshFavoriteState(initial.currentItem);
  }

  async function handleSubmit() {
    if (!gameState?.currentItem || gameState.isAnswered || isProcessingRef.current) return;
    isProcessingRef.current = true;

    const userAnswer = normalizeAnswer(input);
    const newState = checkFillBlankAnswer(gameState, userAnswer);
    setGameState(newState);

    if (!newState.isCorrect && newState.currentItem) {
      setWrongCount(prev => prev + 1);
      setWrongAnswersMap(prev => new Map(prev).set(newState.currentItem!.id, userAnswer));
      try {
        await addFillBlankWrongAnswer(
          newState.currentItem,
          userAnswer,
          newState.currentItem.category || 'general',
          newState.hints
        );
      } catch (err) {
        console.error('写入填空题错题本失败:', err);
      }
    }
  }

  function handleNext() {
    if (!gameState || !gameState.isAnswered || isProcessingRef.current) return;
    isProcessingRef.current = true;

    if (gameState.currentItem) {
      setHistoryItems(prev => [...prev, gameState.currentItem!]);
    }

    const result = nextFillBlankItem(gameState, [...remainingItems]);

    if (result.isCompleted) {
      const categoryName = 'spell';
      const finalResult = generateSessionResult(gameState, fillBlankItems.length, categoryName);
      setSessionResult(finalResult);
      setMode('result');
      saveFillBlankSession(finalResult);
      localStorage.removeItem(`fill-blank-spell-progress-${archiveId || 'temp'}`);
      return;
    }

    setGameState(result.gameState);
    setRemainingItems(result.remainingItems);
    setInput('');
    refreshFavoriteState(result.gameState.currentItem);
  }

  function handlePrev() {
    if (!gameState || historyItems.length === 0 || isProcessingRef.current) return;
    isProcessingRef.current = true;
    
    const newHistory = [...historyItems];
    const prevItem = newHistory.pop()!;
    
    const newRemaining = [gameState.currentItem!, ...remainingItems];
    
    setHistoryItems(newHistory);
    setRemainingItems(newRemaining);
    setGameState({
      ...gameState,
      currentItem: prevItem,
      isAnswered: false,
      isCorrect: false,
      currentAnswer: '',
      hintsUsed: 0,
      hints: [],
    });
    setInput('');
    refreshFavoriteState(prevItem);
  }

  function handleRetry() {
    if (!gameState || !gameState.isAnswered || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setGameState({
      ...gameState,
      isAnswered: false,
      isCorrect: false,
    });
    setInput('');
  }

  useEffect(() => {
    handleNextRef.current = handleNext;
    handlePrevRef.current = handlePrev;
    handleRetryRef.current = handleRetry;
    handleSubmitRef.current = handleSubmit;
    handleToggleFavoriteRef.current = handleToggleFavorite;
  });

  function handleShowHint() {
    if (!gameState || gameState.isAnswered) return;
    const newState = showHint(gameState);
    setGameState(newState);
  }

  async function handleToggleFavorite() {
    if (!gameState?.currentItem || favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      const result = await toggleFillBlankFavorite(gameState.currentItem, 'default');
      setIsFavorite(result.added);
    } catch (err) {
      console.error('切换收藏失败:', err);
    } finally {
      setFavoriteLoading(false);
    }
  }

  function restart() {
    if (fillBlankItems.length === 0) return;
    startGame(fillBlankItems);
  }

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (mode === 'result' && sessionResult) {
    const wrongItems = getWrongQuestions();
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
        <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>🎉 拼写练习完成</h1>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="rounded-2xl p-8 text-center shadow-xl border mb-8" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
            <div className="text-6xl mb-4">
              {sessionResult.accuracy >= 90 ? '🏆' : sessionResult.accuracy >= 70 ? '🎯' : sessionResult.accuracy >= 50 ? '💪' : '📚'}
            </div>

            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>练习完成！</h2>

            <p className="text-4xl font-bold mb-2" style={{ color: 'var(--color-primary)' }}>{Math.round(sessionResult.accuracy)}%</p>

            <p className="mb-6" style={{ color: 'var(--color-secondary)' }}>
              正确率：{sessionResult.correctAnswers} / {sessionResult.totalItems}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{sessionResult.totalItems}</p>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>总题数</p>
              </div>
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--color-success)' }}>{sessionResult.correctAnswers}</p>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>正确数</p>
              </div>
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--color-warning)' }}>{Math.round(sessionResult.averageTimePerItem / 1000)}s</p>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>平均用时</p>
              </div>
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--color-error)' }}>{sessionResult.hintsUsed}</p>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>提示使用</p>
              </div>
            </div>

            {wrongItems.length > 0 && (
              <div className="mb-6 p-5 rounded-2xl text-left shadow-sm border" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-lg text-red-600">
                    📕 {wrongItems.length} 道错题待复习
                  </span>
                  {!wrongSaved ? (
                    <button onClick={handleSaveWrongAnswers} disabled={savingWrong} className="px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95" style={{ backgroundColor: 'var(--color-error)' }}>
                      {savingWrong ? '保存中...' : '加入错题本'}
                    </button>
                  ) : (
                    <span className="text-sm font-bold text-green-600">✓ 已保存至错题本</span>
                  )}
                </div>
                <p className="text-sm text-red-500">错题会自动归类，方便后续定向突破与复习</p>
              </div>
            )}

            <div className="flex gap-4">
              <button onClick={restart} className="flex-1 py-4 rounded-xl text-lg font-bold text-white shadow-md hover:opacity-90 active:scale-95 transition-all" style={{ backgroundColor: 'var(--color-primary)' }}>
                再来一次
              </button>
              <Link to="/fill-blank-import" className="flex-1 py-4 rounded-xl text-lg font-bold text-center border shadow-sm hover:bg-opacity-80 transition-all" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>
                返回管理
              </Link>
            </div>

            {wrongItems.length > 0 && (
              <Link to="/fill-blank-wrong" className="block mt-4 py-3 rounded-xl font-bold text-center shadow-sm border transition-all hover:opacity-90 text-red-600 hover:bg-red-50" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                查看错题本
              </Link>
            )}
          </div>

          {/* 错题详情与回顾列表 */}
          {wrongItems.length > 0 && (
            <div className="mt-12 animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                  <span>🎯</span> 错题深度回顾
                </h3>
                <button
                  onClick={handleBatchFavoriteWrong}
                  disabled={batchFavLoading}
                  className="px-5 py-3 rounded-xl text-base font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 bg-yellow-50 text-yellow-600 border border-yellow-300"
                >
                  ⭐ {batchFavLoading ? '处理中...' : batchFavSuccess ? '全部收藏成功！' : '一键收藏所有错题'}
                </button>
              </div>

              <div className="space-y-6">
                {wrongItems.map((item, index) => {
                  const isFav = wrongFavoriteMap.get(item.question.id);
                  return (
                    <div key={item.question.id} className="p-6 rounded-2xl relative transition-all shadow-md hover:shadow-lg border" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
                      {/* 单题收藏星标按钮 */}
                      <button
                        onClick={() => handleToggleWrongFavorite(item.question)}
                        className="absolute top-6 right-6 p-2 rounded-full hover:bg-opacity-80 transition-all active:scale-90"
                        title={isFav ? '取消收藏' : '收藏此题'}
                      >
                        <svg className="w-8 h-8" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" style={{ color: isFav ? '#fbbf24' : 'var(--color-secondary)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>

                      <p className="font-bold text-xl mb-6 pr-14 text-left leading-relaxed" style={{ color: 'var(--color-text)' }}>{index + 1}. {item.question.question}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mb-4">
                        <div className="p-5 rounded-xl border bg-green-50 border-green-200">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-500 text-white mb-2 inline-block">正确答案</span>
                          <p className="text-xl font-bold tracking-wider text-green-700">{item.question.answer}</p>
                        </div>
                        <div className="p-5 rounded-xl border bg-red-50 border-red-200">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500 text-white mb-2 inline-block">您的错误作答</span>
                          <p className="text-xl font-bold tracking-wider line-through text-red-600">{item.userAnswer || '（未输入 / 空）'}</p>
                        </div>
                      </div>

                      {item.question.hints && item.question.hints.length > 0 && (
                        <div className="mt-4 p-4 rounded-xl text-sm leading-relaxed text-left border" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-secondary)' }}>
                          <strong className="text-base font-bold text-primary mb-1 block">💡 提示信息：</strong>
                          <ul className="list-disc list-inside space-y-1">
                            {item.question.hints.map((hint, hi) => <li key={hi}>{hint}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* 恢复进度选择弹窗 */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="rounded-2xl p-8 max-w-md w-full shadow-2xl border transition-all" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
            <div className="text-center mb-4">
              <span className="text-5xl">🕒</span>
            </div>
            <h3 className="text-2xl font-bold text-center mb-3" style={{ color: 'var(--color-text)' }}>发现上次答题进度</h3>
            <p className="text-base text-center mb-8 leading-relaxed" style={{ color: 'var(--color-secondary)' }}>
              您上次在这个题组答到了第 <strong className="text-xl" style={{ color: 'var(--color-primary)' }}>{(savedProgressData?.currentIndex || 0) + 1}</strong> / {fillBlankItems.length} 题。
              是否继续上次进度，还是重新开始？
            </p>
            <div className="flex gap-4">
              <button 
                onClick={handleRestartProgress} 
                className="flex-1 py-4 rounded-xl text-base font-bold transition-all hover:bg-opacity-10 active:scale-95 border shadow-sm" 
                style={{ backgroundColor: 'transparent', color: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}
              >
                重新开始
              </button>
              <button 
                onClick={handleResumeProgress} 
                className="flex-1 py-4 rounded-xl text-white text-base font-bold shadow-lg transition-all hover:opacity-90 active:scale-95" 
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                继续上次答题
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 提前提交确认弹窗 */}
      {showEarlySubmitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="rounded-2xl p-8 max-w-md w-full shadow-2xl border" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
            <h3 className="text-2xl font-bold mb-3 text-center" style={{ color: 'var(--color-text)' }}>确认提前交卷？</h3>
            <p className="text-base mb-8 text-center leading-relaxed" style={{ color: 'var(--color-secondary)' }}>
              你已完成 {progress - 1}/{fillBlankItems.length} 题，还有 {fillBlankItems.length - (progress - 1)} 题未作答。确定要提前结束练习并进入结算页吗？
            </p>
            <div className="flex gap-4">
              <button onClick={() => setShowEarlySubmitConfirm(false)} className="flex-1 py-4 rounded-xl font-bold border shadow-sm active:scale-95 transition-all" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>继续答题</button>
              <button onClick={() => { setShowEarlySubmitConfirm(false); handleEarlySubmit(); }} className="flex-1 py-4 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-all" style={{ backgroundColor: 'var(--color-primary)' }}>确认交卷</button>
            </div>
          </div>
        </div>
      )}

      <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/fill-blank-import" className="p-2 rounded-full hover:opacity-80">
                <svg className="w-6 h-6" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Link>
              <div>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                  第 {progress} / {fillBlankItems.length} 题
                  {wrongCount > 0 && <span className="ml-2 font-bold" style={{ color: 'var(--color-error)' }}>· 错 {wrongCount}</span>}
                </p>
                <div className="w-48 h-2 rounded-full mt-1" style={{ backgroundColor: 'var(--color-border)' }}>
                  <div className="h-full rounded-full transition-all" style={{ backgroundColor: 'var(--color-primary)', width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>得分</p>
                <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{gameState.score}</p>
              </div>
              <div className="text-center">
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>连击</p>
                <p className="text-lg font-bold" style={{ color: 'var(--color-warning)' }}>{gameState.streak}</p>
              </div>
              <button onClick={() => setShowEarlySubmitConfirm(true)} className="px-4 py-2 rounded-xl text-sm font-bold transition-all ml-4 shadow-sm active:scale-95 border hover:bg-opacity-80" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)', borderColor: 'var(--color-border)' }}>
                提前交卷
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {gameState.currentItem && (
          <>
            <div className="rounded-2xl p-8 mb-8 shadow-xl border border-gray-100 dark:border-gray-800 transition-all" style={{ backgroundColor: 'var(--color-card)' }}>
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={handleShowHint}
                  disabled={gameState.isAnswered || gameState.hintsUsed >= (gameState.currentItem.hints?.length || 0)}
                  className="px-4 py-2 rounded-xl text-base font-medium disabled:opacity-50 transition-all hover:bg-opacity-80 active:scale-95"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-secondary)' }}
                >
                  💡 提示 ({gameState.hintsUsed}/{gameState.currentItem.hints?.length || 0})
                </button>

                <button
                  onClick={handleToggleFavorite}
                  disabled={favoriteLoading}
                  className="px-4 py-2 rounded-xl text-base font-medium disabled:opacity-50 transition-all hover:bg-opacity-80 active:scale-95 shadow-sm"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}
                >
                  {isFavorite ? '取消收藏' : '收藏'}
                </button>
              </div>

              <div className="text-2xl md:text-3xl font-bold leading-relaxed mb-8 tracking-wide" style={{ color: 'var(--color-text)' }}>
                {gameState.currentItem.question}
              </div>

              {gameState.hints.length > 0 && (
                <div className="space-y-3 mb-8">
                  {gameState.hints.map((hint, index) => (
                    <div key={index} className="p-4 rounded-xl text-base font-medium shadow-inner" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-secondary)' }}>
                      💡 {hint}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-6">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  readOnly={gameState.isAnswered}
                  aria-disabled={gameState.isAnswered}
                  className="w-full px-6 py-4 rounded-xl text-xl md:text-2xl font-semibold shadow-inner focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '2px solid var(--color-border)',
                    opacity: gameState.isAnswered ? 0.7 : 1,
                    cursor: gameState.isAnswered ? 'default' : 'text',
                  }}
                  placeholder="请输入答案（回车/空格提交）"
                />

                {!gameState.isAnswered ? (
                  <button
                    onClick={handleSubmit}
                    className="w-full py-4 rounded-xl text-xl font-bold text-white shadow-lg transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    提交 (Enter / Space)
                  </button>
                ) : (
                  <div
                    className={`p-6 rounded-2xl ${gameState.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'} shadow-md`}
                    style={{
                      backgroundColor: gameState.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: `2px solid ${gameState.isCorrect ? 'var(--color-success)' : 'var(--color-error)'}`
                    }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      {gameState.isCorrect ? (
                        <>
                          <svg className="w-8 h-8" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="font-bold text-2xl" style={{ color: 'var(--color-success)' }}>回答正确！</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-8 h-8" style={{ color: 'var(--color-error)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="font-bold text-2xl" style={{ color: 'var(--color-error)' }}>回答错误</span>
                        </>
                      )}
                    </div>

                    {!gameState.isCorrect && (
                      <p className="text-lg mb-4" style={{ color: 'var(--color-secondary)' }}>
                        正确答案：<span className="font-bold text-2xl underline tracking-wider ml-1" style={{ color: 'var(--color-text)' }}>{gameState.currentItem.answer}</span>
                      </p>
                    )}

                    <div className="mt-6">
                      {gameState.isCorrect ? (
                        <>
                          <button
                            onClick={handleNext}
                            className="w-full py-4 rounded-xl text-xl font-bold text-white mb-3 shadow-lg transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                          >
                            {progress < fillBlankItems.length ? '下一题' : '查看结果'}
                          </button>
                          <p className="text-center text-base font-medium" style={{ color: 'var(--color-secondary)' }}>
                            按 <kbd className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border shadow-sm mx-1 font-bold text-sm">Enter</kbd> 或 <kbd className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border shadow-sm mx-1 font-bold text-sm">Space</kbd> 继续
                          </p>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={handleRetry}
                            className="w-full py-4 rounded-xl text-xl font-bold text-white mb-3 shadow-lg transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
                            style={{ backgroundColor: 'var(--color-error)' }}
                          >
                            重试
                          </button>
                          <p className="text-center text-base font-medium" style={{ color: 'var(--color-secondary)' }}>
                            按 <kbd className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border shadow-sm mx-1 font-bold text-sm">Enter</kbd> 或 <kbd className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border shadow-sm mx-1 font-bold text-sm">Space</kbd> 重试
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
