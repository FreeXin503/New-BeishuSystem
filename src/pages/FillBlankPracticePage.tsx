/**
 * 填空题练习页面
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FillBlankItem, FillBlankGameState, FillBlankOption, FillBlankSessionResult } from '../types';
import {
  initializeFillBlankGame,
  checkFillBlankAnswer,
  nextFillBlankItem,
  showHint,
  generateFillBlankOptions,
  generateSessionResult,
} from '../services/learning/fillBlankGame';
import {
  isFillBlankFavorited,
  toggleFillBlankFavorite,
} from '../services/learning/fillBlankFavorite';
import {
  addFillBlankWrongAnswer,
} from '../services/learning/fillBlankWrongAnswer';
import { saveFillBlankSession } from '../services/storage/indexedDB';

export default function FillBlankPracticePage() {
  const navigate = useNavigate();
  const [fillBlankItems, setFillBlankItems] = useState<FillBlankItem[]>([]);
  const [gameState, setGameState] = useState<FillBlankGameState | null>(null);
  const [remainingItems, setRemainingItems] = useState<FillBlankItem[]>([]);
  const [options, setOptions] = useState<FillBlankOption[]>([]);
  const [sessionResult, setSessionResult] = useState<FillBlankSessionResult | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const isAnsweredRef = useRef(false);
  const hasResultRef = useRef(false);
  const handleNextRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    loadFillBlankItems();
  }, []);

  useEffect(() => {
    isAnsweredRef.current = !!gameState?.isAnswered;
  }, [gameState?.isAnswered]);

  useEffect(() => {
    hasResultRef.current = !!sessionResult;
  }, [sessionResult]);

  // 添加键盘事件监听，回车键下一题
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Enter' && isAnsweredRef.current && !hasResultRef.current) {
        e.preventDefault();
        handleNextRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function loadFillBlankItems() {
    const stored = sessionStorage.getItem('fillBlankPractice');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setFillBlankItems(parsed);
        startGame(parsed);
      } catch {
        navigate('/fill-blank-import');
      }
    } else {
      navigate('/fill-blank-import');
    }
  }

  function startGame(items: FillBlankItem[]) {
    if (items.length === 0) return;
    
    const initialState = initializeFillBlankGame(items);
    const remaining = [...items];
    remaining.shift(); // 移除第一个项目，因为它已经在游戏中
    
    setGameState(initialState);
    setRemainingItems(remaining);
    
    // 生成第一题的选项
    if (initialState.currentItem) {
      const allAnswers = items.map(item => item.answer);
      const gameOptions = generateFillBlankOptions(initialState.currentItem.answer, allAnswers);
      setOptions(gameOptions);
      isFillBlankFavorited(initialState.currentItem.id)
        .then(setIsFavorite)
        .catch(() => setIsFavorite(false));
    }
  }

  async function handleOptionSelect(optionId: string) {
    if (gameState?.isAnswered || !gameState?.currentItem) return;
    
    const selected = options.find(opt => opt.id === optionId);
    
    if (selected) {
      const newGameState = checkFillBlankAnswer(gameState, selected.text);
      setGameState(newGameState);
      
      // 更新选项状态
      const updatedOptions = options.map(opt => ({
        ...opt,
        isSelected: opt.id === optionId,
      }));
      setOptions(updatedOptions);

      if (!newGameState.isCorrect && newGameState.currentItem) {
        try {
          await addFillBlankWrongAnswer(
            newGameState.currentItem,
            selected.text,
            newGameState.currentItem.category || 'general',
            newGameState.hints
          );
        } catch (err) {
          console.error('写入填空题错题本失败:', err);
        }
      }
    }
  }

  function handleShowHint() {
    if (!gameState || gameState.isAnswered) return;
    
    const newGameState = showHint(gameState);
    setGameState(newGameState);
  }

  function handleNext() {
    if (!gameState) return;
    
    const result = nextFillBlankItem(gameState, remainingItems);
    
    if (result.isCompleted) {
      // 游戏结束
      const category = 'practice';
      const finalResult = generateSessionResult(gameState, fillBlankItems.length, category);
      setSessionResult(finalResult);
      saveFillBlankSession(finalResult);
    } else {
      // 继续下一题
      setGameState(result.gameState);
      setRemainingItems(result.remainingItems);
      
      // 生成新题的选项
      if (result.gameState.currentItem) {
        const allAnswers = fillBlankItems.map(item => item.answer);
        const newOptions = generateFillBlankOptions(result.gameState.currentItem.answer, allAnswers);
        setOptions(newOptions);
        isFillBlankFavorited(result.gameState.currentItem.id)
          .then(setIsFavorite)
          .catch(() => setIsFavorite(false));
      }
    }
  }

  useEffect(() => {
    handleNextRef.current = handleNext;
  });

  async function handleToggleFavorite() {
    if (!gameState?.currentItem || favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      const result = await toggleFillBlankFavorite(gameState.currentItem, gameState.currentItem.category || 'general');
      setIsFavorite(result.added);
    } catch (err) {
      console.error('切换收藏失败:', err);
    } finally {
      setFavoriteLoading(false);
    }
  }

  function restartGame() {
    startGame(fillBlankItems);
    setSessionResult(null);
  }

  function backToImport() {
    navigate('/fill-blank-import');
  }

  function getDifficultyColor(difficulty: string): string {
    switch (difficulty) {
      case 'easy': return 'var(--color-success)';
      case 'medium': return 'var(--color-warning)';
      case 'hard': return 'var(--color-error)';
      default: return 'var(--color-secondary)';
    }
  }

  function getDifficultyLabel(difficulty: string): string {
    switch (difficulty) {
      case 'easy': return '简单';
      case 'medium': return '中等';
      case 'hard': return '困难';
      default: return '未知';
    }
  }

  if (sessionResult) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
        <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>🎉 练习完成</h1>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="rounded-lg p-8 text-center" style={{ backgroundColor: 'var(--color-card)' }}>
            <div className="text-6xl mb-4">
              {sessionResult.accuracy >= 90 ? '🏆' : sessionResult.accuracy >= 70 ? '🎯' : sessionResult.accuracy >= 50 ? '💪' : '📚'}
            </div>
            
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
              练习完成！
            </h2>
            
            <p className="text-4xl font-bold mb-2" style={{ color: 'var(--color-primary)' }}>
              {Math.round(sessionResult.accuracy)}%
            </p>
            
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
              <button onClick={restartGame} className="flex-1 py-3 rounded-lg font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                再来一次
              </button>
              <button onClick={backToImport} className="flex-1 py-3 rounded-lg font-medium" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
                返回管理
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  const progress = fillBlankItems.length - remainingItems.length;
  const progressPercent = (progress / fillBlankItems.length) * 100;

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
                <span 
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{ backgroundColor: getDifficultyColor(gameState.currentItem.difficulty), color: 'white' }}
                >
                  {getDifficultyLabel(gameState.currentItem.difficulty)}
                </span>
                <button 
                  onClick={handleShowHint}
                  disabled={gameState.isAnswered || gameState.hintsUsed >= (gameState.currentItem.hints?.length || 0)}
                  className="px-3 py-1 rounded text-sm disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-secondary)' }}
                >
                  💡 提示 ({gameState.hintsUsed}/{gameState.currentItem.hints?.length || 0})
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

              {gameState.isAnswered && (
                <div className={`p-4 rounded-lg mb-4 ${
                  gameState.isCorrect 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`} style={{
                  backgroundColor: gameState.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${gameState.isCorrect ? 'var(--color-success)' : 'var(--color-error)'}`
                }}>
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
                      onClick={handleToggleFavorite}
                      disabled={favoriteLoading}
                      className="px-3 py-1 rounded text-sm disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}
                    >
                      {isFavorite ? '取消收藏' : '收藏'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleOptionSelect(option.id)}
                  disabled={gameState.isAnswered}
                  className={`p-4 rounded-lg text-left transition-all ${
                    option.isSelected
                      ? 'border-2'
                      : 'border-2'
                  }`}
                  style={{
                    backgroundColor: option.isSelected 
                      ? (option.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)')
                      : 'var(--color-card)',
                    borderColor: option.isSelected
                      ? (option.isCorrect ? 'var(--color-success)' : 'var(--color-error)')
                      : 'var(--color-border)',
                    color: option.isSelected
                      ? (option.isCorrect ? 'var(--color-success)' : 'var(--color-error)')
                      : 'var(--color-text)',
                    cursor: gameState.isAnswered ? 'default' : 'pointer',
                    opacity: gameState.isAnswered && !option.isSelected ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium" style={{
                      backgroundColor: option.isSelected 
                        ? (option.isCorrect ? 'var(--color-success)' : 'var(--color-error)')
                        : 'var(--color-bg)',
                      color: option.isSelected ? 'white' : 'var(--color-text)'
                    }}>
                      {options.indexOf(option) + 1}
                    </span>
                    <span>{option.text}</span>
                  </div>
                </button>
              ))}
            </div>

            {gameState.isAnswered && (
              <div>
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
            )}
          </>
        )}
      </main>
    </div>
  );
}
