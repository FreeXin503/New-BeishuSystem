/**
 * 填空题拼写练习页面
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FillBlankGameState, FillBlankItem, FillBlankSessionResult } from '../types';
import {
  checkFillBlankAnswer,
  generateSessionResult,
  initializeFillBlankGame,
  nextFillBlankItem,
  showHint,
} from '../services/learning/fillBlankGame';
import { addFillBlankWrongAnswer } from '../services/learning/fillBlankWrongAnswer';
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
  const [sessionResult, setSessionResult] = useState<FillBlankSessionResult | null>(null);

  const [mode, setMode] = useState<Mode>('question');

  const [input, setInput] = useState('');
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const isAnsweredRef = useRef(false);
  const isResultModeRef = useRef(false);
  const handleNextRef = useRef<() => void>(() => undefined);

  const progress = useMemo(() => {
    if (!fillBlankItems.length) return 0;
    return fillBlankItems.length - remainingItems.length;
  }, [fillBlankItems.length, remainingItems.length]);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Enter' && isAnsweredRef.current && !isResultModeRef.current) {
        e.preventDefault();
        handleNextRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function loadItems() {
    const stored = sessionStorage.getItem('fillBlankPractice');
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
      startGame(parsed);
    } catch {
      navigate('/fill-blank-import');
    }
  }

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
    const initial = initializeFillBlankGame(items);
    const remaining = [...items];
    remaining.shift();
    setGameState(initial);
    setRemainingItems(remaining);
    setSessionResult(null);
    setMode('question');
    setInput('');
    refreshFavoriteState(initial.currentItem);
  }

  async function handleSubmit() {
    if (!gameState?.currentItem || gameState.isAnswered) return;

    const userAnswer = normalizeAnswer(input);
    const newState = checkFillBlankAnswer(gameState, userAnswer);
    setGameState(newState);

    if (!newState.isCorrect && newState.currentItem) {
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
    if (!gameState) return;

    const result = nextFillBlankItem(gameState, [...remainingItems]);

    if (result.isCompleted) {
      const category = 'spell';
      const finalResult = generateSessionResult(gameState, fillBlankItems.length, category);
      setSessionResult(finalResult);
      setMode('result');
      saveFillBlankSession(finalResult);
      return;
    }

    setGameState(result.gameState);
    setRemainingItems(result.remainingItems);
    setInput('');
    refreshFavoriteState(result.gameState.currentItem);
  }

  useEffect(() => {
    handleNextRef.current = handleNext;
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
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
        <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>🎉 拼写练习完成</h1>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="rounded-lg p-8 text-center" style={{ backgroundColor: 'var(--color-card)' }}>
            <div className="text-6xl mb-4">
              {sessionResult.accuracy >= 90 ? '🏆' : sessionResult.accuracy >= 70 ? '🎯' : sessionResult.accuracy >= 50 ? '💪' : '📚'}
            </div>

            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>练习完成！</h2>

            <p className="text-4xl font-bold mb-2" style={{ color: 'var(--color-primary)' }}>{Math.round(sessionResult.accuracy)}%</p>

            <p className="mb-6" style={{ color: 'var(--color-secondary)' }}>
              正确率：{sessionResult.correctAnswers} / {sessionResult.totalItems}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{sessionResult.totalItems}</p>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>总题数</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--color-success)' }}>{sessionResult.correctAnswers}</p>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>正确数</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--color-warning)' }}>{Math.round(sessionResult.averageTimePerItem / 1000)}s</p>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>平均用时</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--color-error)' }}>{sessionResult.hintsUsed}</p>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>提示使用</p>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={restart} className="flex-1 py-3 rounded-lg font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                再来一次
              </button>
              <Link to="/fill-blank-import" className="flex-1 py-3 rounded-lg font-medium text-center" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
                返回管理
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
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
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {gameState.currentItem && (
          <>
            <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: 'var(--color-card)' }}>
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={handleShowHint}
                  disabled={gameState.isAnswered || gameState.hintsUsed >= (gameState.currentItem.hints?.length || 0)}
                  className="px-3 py-1 rounded text-sm disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-secondary)' }}
                >
                  💡 提示 ({gameState.hintsUsed}/{gameState.currentItem.hints?.length || 0})
                </button>

                <button
                  onClick={handleToggleFavorite}
                  disabled={favoriteLoading}
                  className="px-3 py-1 rounded text-sm disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}
                >
                  {isFavorite ? '取消收藏' : '收藏'}
                </button>
              </div>

              <div className="text-lg leading-relaxed mb-4" style={{ color: 'var(--color-text)' }}>
                {gameState.currentItem.question}
              </div>

              {gameState.hints.length > 0 && (
                <div className="space-y-2 mb-4">
                  {gameState.hints.map((hint, index) => (
                    <div key={index} className="p-3 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-secondary)' }}>
                      💡 {hint}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!gameState.isAnswered) {
                        handleSubmit();
                      } else {
                        handleNext();
                      }
                    }
                  }}
                  readOnly={gameState.isAnswered}
                  aria-disabled={gameState.isAnswered}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    opacity: gameState.isAnswered ? 0.7 : 1,
                    cursor: gameState.isAnswered ? 'default' : 'text',
                  }}
                  placeholder="请输入答案（回车提交/下一题）"
                />

                {!gameState.isAnswered ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!input.trim()}
                    className="w-full py-3 rounded-lg font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    提交
                  </button>
                ) : (
                  <div
                    className={`p-4 rounded-lg ${gameState.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
                    style={{
                      backgroundColor: gameState.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${gameState.isCorrect ? 'var(--color-success)' : 'var(--color-error)'}`
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {gameState.isCorrect ? (
                        <>
                          <svg className="w-5 h-5" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="font-medium" style={{ color: 'var(--color-success)' }}>回答正确！</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" style={{ color: 'var(--color-error)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="font-medium" style={{ color: 'var(--color-error)' }}>回答错误</span>
                        </>
                      )}
                    </div>

                    {!gameState.isCorrect && (
                      <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                        正确答案：<span className="font-medium" style={{ color: 'var(--color-text)' }}>{gameState.currentItem.answer}</span>
                      </p>
                    )}

                    <div className="mt-3">
                      <button
                        onClick={handleNext}
                        className="w-full py-3 rounded-lg font-medium text-white mb-2"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        {progress < fillBlankItems.length ? '下一题' : '查看结果'}
                      </button>
                      <p className="text-center text-sm" style={{ color: 'var(--color-secondary)' }}>
                        按 Enter 键继续下一题
                      </p>
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
