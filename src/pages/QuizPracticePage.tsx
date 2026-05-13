/**
 * 选择题练习页面
 * 支持随时提交和错题本功能
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Question, ModeProgress } from '../types';
import { getOptionLabel, getScoreRating } from '../services/learning/quiz';
import { updatePracticeRecord } from '../services/learning/quizArchive';
import { addWrongAnswers } from '../services/learning/wrongAnswer';
import { toggleFavorite, isFavorited } from '../services/learning/favorite';

export default function QuizPracticePage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [isComplete, setIsComplete] = useState(false);
  const [startTime] = useState(Date.now());
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('other');
  const [wrongCount, setWrongCount] = useState(0);
  const [savingWrong, setSavingWrong] = useState(false);
  const [wrongSaved, setWrongSaved] = useState(false);
  const [showEarlySubmitConfirm, setShowEarlySubmitConfirm] = useState(false);
  const [favoriteMap, setFavoriteMap] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    const stored = sessionStorage.getItem('importedQuiz');
    const storedArchiveId = sessionStorage.getItem('currentArchiveId');
    const storedCategory = sessionStorage.getItem('currentCategory');
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setQuestions(parsed);
        if (storedArchiveId) setArchiveId(storedArchiveId);
        if (storedCategory) setCategory(storedCategory);
        else setCategory('other');
        // 加载收藏状态
        loadFavoriteStatus(parsed);
      } catch {
        navigate('/quiz-import');
      }
    } else {
      navigate('/quiz-import');
    }
  }, [navigate]);

  async function loadFavoriteStatus(qs: Question[]) {
    const map = new Map<string, boolean>();
    for (const q of qs) {
      map.set(q.id, await isFavorited(q.id));
    }
    setFavoriteMap(map);
  }

  async function handleToggleFavorite(question: Question) {
    const newStatus = await toggleFavorite(question, category, 'quiz', archiveId || undefined);
    setFavoriteMap(prev => new Map(prev).set(question.id, newStatus));
  }

  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.repeat && currentQuestion) {
        e.preventDefault();
        const newStatus = await toggleFavorite(currentQuestion, category, 'quiz', archiveId || undefined);
        setFavoriteMap(prev => new Map(prev).set(currentQuestion.id, newStatus));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, category, archiveId]);

  const handleSelectAnswer = (answer: string) => {
    if (showResult) return;
    setSelectedAnswer(answer);
  };

  const handleSubmit = () => {
    if (!selectedAnswer || !currentQuestion) return;
    
    const isCorrectAnswer = selectedAnswer === currentQuestion.correctAnswer;
    
    if (isCorrectAnswer) {
      const newAnswers = new Map(answers);
      newAnswers.set(currentQuestion.id, selectedAnswer);
      setAnswers(newAnswers);
    } else {
      setWrongCount(prev => prev + 1);
    }
    
    setShowResult(true);
  };

  const handleNext = () => {
    // 只有答对才能进入下一题
    if (selectedAnswer !== currentQuestion.correctAnswer) {
      // 答错了，重置选择状态，让用户重新选择
      setSelectedAnswer(null);
      setShowResult(false);
      return;
    }
    
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      finishQuiz();
    }
  };

  // 提前结束练习
  const handleEarlySubmit = () => {
    // 如果当前题目已选择但未提交，先提交
    if (selectedAnswer && !showResult && currentQuestion) {
      const newAnswers = new Map(answers);
      newAnswers.set(currentQuestion.id, selectedAnswer);
      setAnswers(newAnswers);
      if (selectedAnswer !== currentQuestion.correctAnswer) {
        setWrongCount(prev => prev + 1);
      }
    }
    finishQuiz();
  };

  const finishQuiz = () => {
    setIsComplete(true);
    if (archiveId) {
      const results = calculateResults();
      const score = results.total > 0 ? Math.round((results.correct / results.total) * 100) : 0;
      updatePracticeRecord(archiveId, score);
    }
  };

  const calculateResults = (): ModeProgress => {
    let correct = 0;
    const answeredQuestions = questions.filter(q => answers.has(q.id));
    answeredQuestions.forEach(q => {
      if (answers.get(q.id) === q.correctAnswer) {
        correct++;
      }
    });
    
    return {
      total: answeredQuestions.length,
      completed: answeredQuestions.length,
      correct,
      timeSpent: Math.round((Date.now() - startTime) / 1000),
    };
  };

  const getWrongQuestions = () => {
    const wrongItems: Array<{ question: Question; userAnswer: string }> = [];
    
    questions.forEach(q => {
      const userAnswer = answers.get(q.id);
      if (userAnswer && userAnswer !== q.correctAnswer) {
        wrongItems.push({ question: q, userAnswer });
      }
    });
    
    return wrongItems;
  };

  const handleSaveWrongAnswers = async () => {
    const wrongItems = getWrongQuestions();
    if (wrongItems.length === 0) return;
    
    setSavingWrong(true);
    setWrongSaved(false);
    
    try {
      console.log('开始保存错题，数量:', wrongItems.length);
      await addWrongAnswers(wrongItems, archiveId || `temp-${Date.now()}`, category);
      console.log('错题保存完成');
      setWrongSaved(true);
    } catch (err) {
      console.error('保存错题失败:', err);
      alert(`保存错题失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setSavingWrong(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (isComplete) {
    const results = calculateResults();
    const score = results.total > 0 ? Math.round((results.correct / results.total) * 100) : 0;
    const rating = getScoreRating(score);
    const wrongItems = getWrongQuestions();
    const unansweredCount = questions.length - results.total;

    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: 'var(--color-card)' }}>
            <div className="text-6xl mb-4">
              {score >= 90 ? '🎉' : score >= 70 ? '👍' : score >= 60 ? '💪' : '📚'}
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
              练习完成！
            </h2>
            <p className="text-4xl font-bold mb-2" style={{ color: 'var(--color-primary)' }}>
              {score}分
            </p>
            <p className="mb-6" style={{ color: 'var(--color-secondary)' }}>
              {rating.message}
            </p>
            
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{results.total}</p>
                <p className="text-xs" style={{ color: 'var(--color-secondary)' }}>已答</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--color-success)' }}>{results.correct}</p>
                <p className="text-xs" style={{ color: 'var(--color-secondary)' }}>正确</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--color-error)' }}>{wrongItems.length}</p>
                <p className="text-xs" style={{ color: 'var(--color-secondary)' }}>错误</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--color-secondary)' }}>{unansweredCount}</p>
                <p className="text-xs" style={{ color: 'var(--color-secondary)' }}>未答</p>
              </div>
            </div>

            {wrongItems.length > 0 && (
              <div className="mb-6 p-4 rounded-lg text-left" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-error)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium" style={{ color: 'var(--color-error)' }}>
                    📕 {wrongItems.length} 道错题
                  </span>
                  {!wrongSaved ? (
                    <button onClick={handleSaveWrongAnswers} disabled={savingWrong} className="px-3 py-1 rounded text-sm text-white" style={{ backgroundColor: 'var(--color-error)' }}>
                      {savingWrong ? '保存中...' : '加入错题本'}
                    </button>
                  ) : (
                    <span className="text-sm" style={{ color: 'var(--color-success)' }}>✓ 已保存</span>
                  )}
                </div>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>错题会自动归类，方便后续复习</p>
              </div>
            )}

            <div className="flex gap-4">
              <Link to="/quiz-import" className="flex-1 py-3 rounded-lg font-medium text-center" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
                返回题库
              </Link>
              <button onClick={() => { setCurrentIndex(0); setSelectedAnswer(null); setShowResult(false); setAnswers(new Map()); setIsComplete(false); setWrongCount(0); setWrongSaved(false); }} className="flex-1 py-3 rounded-lg font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                重新练习
              </button>
            </div>
            
            {wrongItems.length > 0 && (
              <Link to="/wrong-answers" className="block mt-4 py-3 rounded-lg font-medium" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-error)' }}>
                查看错题本
              </Link>
            )}
          </div>


          {/* 错题详情 */}
          {wrongItems.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text)' }}>错题回顾</h3>
              <div className="space-y-4">
                {wrongItems.map((item, index) => (
                  <div key={item.question.id} className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
                    <p className="font-medium mb-3" style={{ color: 'var(--color-text)' }}>{index + 1}. {item.question.question}</p>
                    <div className="space-y-2">
                      {item.question.options.map((opt, optIndex) => {
                        const isUserAnswer = opt === item.userAnswer;
                        const isCorrect = opt === item.question.correctAnswer;
                        let bgColor = 'var(--color-bg)';
                        let textColor = 'var(--color-text)';
                        let borderColor = 'var(--color-border)';
                        if (isCorrect) { bgColor = 'rgba(16, 185, 129, 0.1)'; textColor = 'var(--color-success)'; borderColor = 'var(--color-success)'; }
                        else if (isUserAnswer) { bgColor = 'rgba(239, 68, 68, 0.1)'; textColor = 'var(--color-error)'; borderColor = 'var(--color-error)'; }
                        return (
                          <div key={optIndex} className="px-3 py-2 rounded text-sm" style={{ backgroundColor: bgColor, color: textColor, border: `1px solid ${borderColor}` }}>
                            {getOptionLabel(optIndex)}. {opt}
                            {isCorrect && ' ✓ 正确答案'}
                            {isUserAnswer && !isCorrect && ' ✗ 你的答案'}
                          </div>
                        );
                      })}
                    </div>
                    {item.question.explanation && <p className="mt-3 text-sm" style={{ color: 'var(--color-secondary)' }}>💡 {item.question.explanation}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
  const answeredCount = answers.size + (showResult ? 0 : (selectedAnswer ? 1 : 0));

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* 提前提交确认弹窗 */}
      {showEarlySubmitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg p-6 max-w-sm w-full" style={{ backgroundColor: 'var(--color-card)' }}>
            <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text)' }}>确认提交？</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-secondary)' }}>
              你已完成 {answeredCount}/{questions.length} 题，还有 {questions.length - answeredCount} 题未作答。确定要提交吗？
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowEarlySubmitConfirm(false)} className="flex-1 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>继续答题</button>
              <button onClick={() => { setShowEarlySubmitConfirm(false); handleEarlySubmit(); }} className="flex-1 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-primary)' }}>确认提交</button>
            </div>
          </div>
        </div>
      )}

      <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link to="/quiz-import" className="p-2 rounded-full hover:opacity-80">
              <svg className="w-6 h-6" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
            <div className="text-center">
              <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                第 {currentIndex + 1} / {questions.length} 题
                {wrongCount > 0 && <span style={{ color: 'var(--color-error)' }}> · 错 {wrongCount}</span>}
              </p>
              <div className="w-48 h-2 rounded-full mt-1" style={{ backgroundColor: 'var(--color-border)' }}>
                <div className="h-full rounded-full transition-all" style={{ backgroundColor: 'var(--color-primary)', width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
              </div>
            </div>
            <button onClick={() => setShowEarlySubmitConfirm(true)} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}>
              提交
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="rounded-xl p-6 mb-6 relative" style={{ backgroundColor: 'var(--color-card)' }}>
          <button
            onClick={() => handleToggleFavorite(currentQuestion)}
            className="absolute top-4 right-4 p-2 rounded-full hover:opacity-80 transition-all"
            title={favoriteMap.get(currentQuestion.id) ? '取消收藏' : '收藏题目'}
          >
            <svg className="w-6 h-6" fill={favoriteMap.get(currentQuestion.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" style={{ color: favoriteMap.get(currentQuestion.id) ? '#fbbf24' : 'var(--color-secondary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
          <p className="text-lg leading-relaxed pr-10" style={{ color: 'var(--color-text)' }}>{currentQuestion.question}</p>
        </div>

        <div className="space-y-3 mb-6">
          {currentQuestion.type === 'judgment' ? (
            // 判断题选项
            <>
              {['对', '错'].map((option) => {
                const isSelected = selectedAnswer === option;
                const isCorrectOption = option === currentQuestion.correctAnswer;
                let bgColor = 'var(--color-card)';
                let borderColor = 'var(--color-border)';
                let textColor = 'var(--color-text)';
                if (showResult) {
                  if (isCorrectOption) { bgColor = 'rgba(16, 185, 129, 0.1)'; borderColor = 'var(--color-success)'; textColor = 'var(--color-success)'; }
                  else if (isSelected && !isCorrect) { bgColor = 'rgba(239, 68, 68, 0.1)'; borderColor = 'var(--color-error)'; textColor = 'var(--color-error)'; }
                } else if (isSelected) { borderColor = 'var(--color-primary)'; bgColor = 'rgba(59, 130, 246, 0.1)'; }
                return (
                  <button key={option} onClick={() => handleSelectAnswer(option)} disabled={showResult} className="w-full text-left p-4 rounded-lg transition-all flex items-center gap-3" style={{ backgroundColor: bgColor, border: `2px solid ${borderColor}`, color: textColor }}>
                    <span className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-2xl" style={{ backgroundColor: isSelected || (showResult && isCorrectOption) ? borderColor : 'var(--color-bg)', color: isSelected || (showResult && isCorrectOption) ? 'white' : 'var(--color-text)' }}>
                      {option === '对' ? '✓' : '✗'}
                    </span>
                    <span className="text-lg font-medium">{option}</span>
                  </button>
                );
              })}
            </>
          ) : (
            // 选择题选项
            currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswer === option;
              const isCorrectOption = option === currentQuestion.correctAnswer;
              let bgColor = 'var(--color-card)';
              let borderColor = 'var(--color-border)';
              let textColor = 'var(--color-text)';
              if (showResult) {
                if (isCorrectOption) { bgColor = 'rgba(16, 185, 129, 0.1)'; borderColor = 'var(--color-success)'; textColor = 'var(--color-success)'; }
                else if (isSelected && !isCorrect) { bgColor = 'rgba(239, 68, 68, 0.1)'; borderColor = 'var(--color-error)'; textColor = 'var(--color-error)'; }
              } else if (isSelected) { borderColor = 'var(--color-primary)'; bgColor = 'rgba(59, 130, 246, 0.1)'; }
              return (
                <button key={index} onClick={() => handleSelectAnswer(option)} disabled={showResult} className="w-full text-left p-4 rounded-lg transition-all flex items-start gap-3" style={{ backgroundColor: bgColor, border: `2px solid ${borderColor}`, color: textColor }}>
                  <span className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-medium" style={{ backgroundColor: isSelected || (showResult && isCorrectOption) ? borderColor : 'var(--color-bg)', color: isSelected || (showResult && isCorrectOption) ? 'white' : 'var(--color-text)' }}>
                    {getOptionLabel(index)}
                  </span>
                  <span className="pt-1">{option}</span>
                </button>
              );
            })
          )}
        </div>

        {showResult && (
          <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${isCorrect ? 'var(--color-success)' : 'var(--color-error)'}` }}>
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? (
                <svg className="w-5 h-5" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-5 h-5" style={{ color: 'var(--color-error)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              )}
              <span className="font-medium" style={{ color: isCorrect ? 'var(--color-success)' : 'var(--color-error)' }}>{isCorrect ? '回答正确！' : '回答错误'}</span>
            </div>
            {currentQuestion.explanation && <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>{currentQuestion.explanation}</p>}
          </div>
        )}

        {!showResult ? (
          <button onClick={handleSubmit} disabled={!selectedAnswer} className="w-full py-3 rounded-lg font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
            确认答案
          </button>
        ) : (
          <button onClick={handleNext} className="w-full py-3 rounded-lg font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
            {!isCorrect ? '重新作答' : (currentIndex < questions.length - 1 ? '下一题' : '查看结果')}
          </button>
        )}
      </main>
    </div>
  );
}
