/**
 * 填空题背诵页面
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Question, FillBlankItem, FillBlankGameState, FillBlankOption, FillBlankSessionResult } from '../types';
import { 
  generateFillBlankFromQuestion,
  initializeFillBlankGame,
  generateFillBlankOptions,
  checkFillBlankAnswer,
  showHint,
  nextFillBlankItem,
  generateSessionResult
} from '../services/learning/fillBlankGame';

type GameMode = 'setup' | 'playing' | 'result';

export default function FillBlankPage() {
  const navigate = useNavigate();
  const [gameMode, setGameMode] = useState<GameMode>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [fillBlankItems, setFillBlankItems] = useState<FillBlankItem[]>([]);
  const [gameState, setGameState] = useState<FillBlankGameState | null>(null);
  const [remainingItems, setRemainingItems] = useState<FillBlankItem[]>([]);
  const [options, setOptions] = useState<FillBlankOption[]>([]);
  const [sessionResult, setSessionResult] = useState<FillBlankSessionResult | null>(null);

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    const stored = sessionStorage.getItem('importedQuiz');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setQuestions(parsed);
        generateFillBlankItems(parsed);
      } catch {
        navigate('/quiz-import');
      }
    } else {
      navigate('/quiz-import');
    }
  }

  function generateFillBlankItems(qs: Question[]) {
    const allFillBlankItems: FillBlankItem[] = [];
    
    qs.forEach(question => {
      const items = generateFillBlankFromQuestion(question);
      allFillBlankItems.push(...items);
    });
    
    // 打乱顺序
    const shuffled = allFillBlankItems.sort(() => Math.random() - 0.5);
    setFillBlankItems(shuffled);
  }

  function startGame() {
    if (fillBlankItems.length === 0) return;
    
    const initialState = initializeFillBlankGame(fillBlankItems);
    const remaining = [...fillBlankItems];
    remaining.shift(); // 移除第一个项目，因为它已经在游戏中
    
    setGameState(initialState);
    setRemainingItems(remaining);
    
    // 生成第一题的选项
    if (initialState.currentItem) {
      const allAnswers = fillBlankItems.map(item => item.answer);
      const gameOptions = generateFillBlankOptions(initialState.currentItem.answer, allAnswers);
      setOptions(gameOptions);
    }
    
    setGameMode('playing');
  }

  function handleOptionSelect(optionId: string) {
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
      const category = sessionStorage.getItem('currentCategory') || 'general';
      const finalResult = generateSessionResult(gameState, fillBlankItems.length, category);
      setSessionResult(finalResult);
      setGameMode('result');
    } else {
      // 继续下一题
      setGameState(result.gameState);
      setRemainingItems(result.remainingItems);
      
      // 生成新题的选项
      if (result.gameState.currentItem) {
        const allAnswers = fillBlankItems.map(item => item.answer);
        const newOptions = generateFillBlankOptions(result.gameState.currentItem.answer, allAnswers);
        setOptions(newOptions);
      }
    }
  }

  function restartGame() {
    setGameMode('setup');
    setGameState(null);
    setRemainingItems([]);
    setOptions([]);
    setSessionResult(null);
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

  if (gameMode === 'setup') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
        <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <Link to="/quiz-import" className="mr-4 p-2 rounded-full hover:opacity-80">
                <svg className="w-6 h-6" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>📝 填空题背诵</h1>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-lg p-8 text-center" style={{ backgroundColor: 'var(--color-card)' }}>
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
              填空题背诵挑战
            </h2>
            <p className="mb-6" style={{ color: 'var(--color-secondary)' }}>
              从导入的选择题中自动生成填空题，通过匹配游戏的方式提升背诵效率
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--color-bg)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{questions.length}</p>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>原始题目</p>
              </div>
              <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--color-bg)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{fillBlankItems.length}</p>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>填空题目</p>
              </div>
              <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--color-bg)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>4</p>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>选项数量</p>
              </div>
            </div>

            <div className="space-y-3 text-left max-w-md mx-auto mb-6" style={{ color: 'var(--color-secondary)' }}>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>智能生成填空题，覆盖题目和解释</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>匹配游戏模式，选择正确答案</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>智能提示系统，逐步引导</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>难度自适应，个性化学习</span>
              </div>
            </div>

            <button 
              onClick={startGame} 
              disabled={fillBlankItems.length === 0}
              className="px-8 py-3 rounded-lg font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              开始挑战
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (gameMode === 'playing' && gameState) {
    const progress = fillBlankItems.length - remainingItems.length;
    const progressPercent = (progress / fillBlankItems.length) * 100;

    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
        <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to="/fill-blank" className="p-2 rounded-full hover:opacity-80">
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
                <button 
                  onClick={handleNext}
                  className="w-full py-3 rounded-lg font-medium text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {progress < fillBlankItems.length ? '下一题' : '查看结果'}
                </button>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  if (gameMode === 'result' && sessionResult) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
        <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>🎉 挑战完成</h1>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="rounded-lg p-8 text-center" style={{ backgroundColor: 'var(--color-card)' }}>
            <div className="text-6xl mb-4">
              {sessionResult.accuracy >= 90 ? '🏆' : sessionResult.accuracy >= 70 ? '🎯' : sessionResult.accuracy >= 50 ? '💪' : '📚'}
            </div>
            
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
              挑战完成！
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
              <Link to="/quiz-import" className="flex-1 py-3 rounded-lg font-medium text-center" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
                返回题库
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return null;
}
