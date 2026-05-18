/**
 * 选择题练习页面
 * 支持随时提交和错题本功能
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Question, ModeProgress, FavoriteCategory } from '../types';
import { getOptionLabel, getScoreRating } from '../services/learning/quiz';
import { updatePracticeRecord, getArchive } from '../services/learning/quizArchive';
import { addWrongAnswers } from '../services/learning/wrongAnswer';
import { toggleFavorite, isFavorited, getFavoriteCategoryById, getFavoriteCategories, addFavorite } from '../services/learning/favorite';
import FavoriteCategoryPicker from '../components/learning/FavoriteCategoryPicker';
import { saveQuizSession } from '../services/storage/indexedDB';

export default function QuizPracticePage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [wrongAnswers, setWrongAnswers] = useState<Map<string, string>>(new Map());
  const [isComplete, setIsComplete] = useState(false);
  const [startTime] = useState(Date.now());
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('other');
  const [wrongCount, setWrongCount] = useState(0);
  const [savingWrong, setSavingWrong] = useState(false);
  const [wrongSaved, setWrongSaved] = useState(false);
  const [showEarlySubmitConfirm, setShowEarlySubmitConfirm] = useState(false);
  const [favoriteMap, setFavoriteMap] = useState<Map<string, boolean>>(new Map());

  // 进度保存与恢复相关
  const [savedProgressData, setSavedProgressData] = useState<any>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);

  // 错题回顾星标与批量收藏相关
  const [wrongFavoriteMap, setWrongFavoriteMap] = useState<Map<string, boolean>>(new Map());
  const [batchFavLoading, setBatchFavLoading] = useState(false);
  const [batchFavSuccess, setBatchFavSuccess] = useState(false);
  const [selectedWrongIds, setSelectedWrongIds] = useState<Set<string>>(new Set());
  
  // 收藏夹分类相关
  const [activeFavCatId, setActiveFavCatId] = useState<string>('default');
  const [activeFavCatName, setActiveFavCatName] = useState<string>('默认分类');
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [targetQuestionForCat, setTargetQuestionForCat] = useState<Question | null>(null);

  // 在 isComplete 发生变化且为 true 时，初始化错题的收藏状态
  useEffect(() => {
    if (isComplete) {
      const loadWrongFavStatus = async () => {
        const wrongItems = getWrongQuestions();
        const map = new Map<string, boolean>();
        for (const item of wrongItems) {
          map.set(item.question.id, await isFavorited(item.question.id));
        }
        setWrongFavoriteMap(map);
      };
      loadWrongFavStatus();
    }
  }, [isComplete]);

  const handleToggleWrongFavorite = async (question: Question) => {
    const newStatus = await toggleFavorite(question, activeFavCatId, 'quiz', archiveId || undefined);
    setWrongFavoriteMap(prev => new Map(prev).set(question.id, newStatus));
  };

  const handleBatchFavoriteWrong = async () => {
    const wrongItems = getWrongQuestions().filter(item => selectedWrongIds.has(item.question.id));
    if (wrongItems.length === 0) return;

    setBatchFavLoading(true);
    try {
      // 串行执行以避免潜在的竞态问题，并确保收藏夹已创建
      for (const item of wrongItems) {
        await addFavorite(item.question, activeFavCatId, 'quiz', archiveId || undefined);
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

  const toggleSelectWrong = (id: string) => {
    setSelectedWrongIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllWrongs = () => {
    const wrongItems = getWrongQuestions();
    if (selectedWrongIds.size === wrongItems.length) {
      setSelectedWrongIds(new Set());
    } else {
      setSelectedWrongIds(new Set(wrongItems.map(i => i.question.id)));
    }
  };

  const handleSelectCategory = async (catId: string) => {
    setActiveFavCatId(catId);
    await loadCategoryName(catId);
    setShowCatPicker(false);
    
    // 如果有目标题目，直接为该题目收藏
    if (targetQuestionForCat) {
      const newStatus = await toggleFavorite(targetQuestionForCat, catId, 'quiz', archiveId || undefined);
      setFavoriteMap(prev => new Map(prev).set(targetQuestionForCat.id, newStatus));
      setWrongFavoriteMap(prev => new Map(prev).set(targetQuestionForCat.id, newStatus));
      setTargetQuestionForCat(null);
    }
  };

  useEffect(() => {
    const stored = sessionStorage.getItem('importedQuiz');
    const storedArchiveId = sessionStorage.getItem('currentArchiveId');
    const storedCategory = sessionStorage.getItem('currentCategory');
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setQuestions(parsed);
        
        let actualArchiveId = storedArchiveId || null;
        if (storedArchiveId) {
          setArchiveId(storedArchiveId);
          // 默认收藏夹设置为当前题库ID（对应题库名的收藏夹）
          setActiveFavCatId(storedArchiveId);
          loadCategoryName(storedArchiveId);
        }
        
        if (storedCategory) setCategory(storedCategory);
        else setCategory('other');
        
        // 加载收藏状态
        loadFavoriteStatus(parsed);

        // 检查并恢复答题进度
        const key = `quiz-progress-${actualArchiveId || 'temp'}`;
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
      } catch {
        navigate('/quiz-import');
      }
    } else {
      navigate('/quiz-import');
    }
  }, [navigate]);

  async function loadCategoryName(id: string) {
    try {
      const cat = await getFavoriteCategoryById(id);
      if (cat) {
        setActiveFavCatName(cat.name);
      } else if (id === 'default') {
        setActiveFavCatName('默认分类');
      } else if (id === 'favorites') {
        setActiveFavCatName('收藏练习');
      } else {
        // 尝试从题库中获取标题
        const archive = await getArchive(id);
        if (archive) {
          setActiveFavCatName(archive.title);
        } else {
          setActiveFavCatName('未命名分类');
        }
      }
    } catch (err) {
      console.error('加载分类名称失败:', err);
      setActiveFavCatName('默认分类');
    }
  }

  const handleResumeProgress = () => {
    if (savedProgressData) {
      setCurrentIndex(savedProgressData.currentIndex);
      setAnswers(new Map(savedProgressData.answers));
      setWrongAnswers(new Map(savedProgressData.wrongAnswers || []));
      setWrongCount(savedProgressData.wrongCount || 0);
      setShowResult(savedProgressData.showResult || false);
      setSelectedAnswer(savedProgressData.selectedAnswer || null);
    }
    setShowProgressModal(false);
  };

  const handleRestartProgress = () => {
    const key = `quiz-progress-${archiveId || 'temp'}`;
    localStorage.removeItem(key);
    setCurrentIndex(0);
    setAnswers(new Map());
    setWrongAnswers(new Map());
    setWrongCount(0);
    setShowResult(false);
    setSelectedAnswer(null);
    setShowProgressModal(false);
  };

  // 实时保存进度
  useEffect(() => {
    if (questions.length === 0 || isComplete || showProgressModal) return;
    
    const key = `quiz-progress-${archiveId || 'temp'}`;
    const progressData = {
      quizId: questions[0]?.id,
      currentIndex,
      answers: Array.from(answers.entries()),
      wrongAnswers: Array.from(wrongAnswers.entries()),
      wrongCount,
      showResult,
      selectedAnswer,
    };
    localStorage.setItem(key, JSON.stringify(progressData));
  }, [currentIndex, answers, wrongAnswers, wrongCount, showResult, selectedAnswer, isComplete, questions, archiveId, showProgressModal]);

  async function loadFavoriteStatus(qs: Question[]) {
    const map = new Map<string, boolean>();
    for (const q of qs) {
      map.set(q.id, await isFavorited(q.id));
    }
    setFavoriteMap(map);
  }

  async function handleToggleFavorite(question: Question) {
    const newStatus = await toggleFavorite(question, activeFavCatId, 'quiz', archiveId || undefined);
    setFavoriteMap(prev => new Map(prev).set(question.id, newStatus));
  }

  const currentQuestion = questions[currentIndex];


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
      const newWrongAnswers = new Map(wrongAnswers);
      newWrongAnswers.set(currentQuestion.id, selectedAnswer);
      setWrongAnswers(newWrongAnswers);
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
      const isCorrectAnswer = selectedAnswer === currentQuestion.correctAnswer;
      if (isCorrectAnswer) {
        const newAnswers = new Map(answers);
        newAnswers.set(currentQuestion.id, selectedAnswer);
        setAnswers(newAnswers);
      } else {
        setWrongCount(prev => prev + 1);
        const newWrongAnswers = new Map(wrongAnswers);
        newWrongAnswers.set(currentQuestion.id, selectedAnswer);
        setWrongAnswers(newWrongAnswers);
      }
    }
    finishQuiz();
  };

  const finishQuiz = async () => {
    setIsComplete(true);
    localStorage.removeItem(`quiz-progress-${archiveId || 'temp'}`);
    
    const results = calculateResults();
    const score = results.total > 0 ? Math.round((results.correct / results.total) * 100) : 0;
    
    if (archiveId) {
      updatePracticeRecord(archiveId, score);
    }

    // 保存练习记录
    try {
      const wrongItems = getWrongQuestions();
      const archive = archiveId ? await getArchive(archiveId) : null;
      
      await saveQuizSession({
        id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        archiveId,
        title: archive?.title || '临时练习',
        totalQuestions: questions.length,
        correctAnswers: results.correct,
        score,
        completedAt: new Date(),
        wrongItems,
      });
      console.log('练习记录已保存');
    } catch (err) {
      console.error('保存练习记录失败:', err);
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
      const userAnswer = wrongAnswers.get(q.id);
      if (userAnswer) {
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

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl+F to toggle favorite (existing behavior)
      if (e.ctrlKey && !e.repeat && currentQuestion) {
        e.preventDefault();
        const newStatus = await toggleFavorite(currentQuestion, category, 'quiz', archiveId || undefined);
        setFavoriteMap(prev => new Map(prev).set(currentQuestion.id, newStatus));
      }
      // Arrow Left: previous question
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
          setSelectedAnswer(null);
          setShowResult(false);
        }
      }
      // Arrow Right: next question
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setSelectedAnswer(null);
          setShowResult(false);
        } else {
          finishQuiz();
        }
      }
      // Space, Enter or Shift: confirm or next/retry
      if (e.code === 'Space' || e.key === 'Enter' || e.key === 'Shift') {
        e.preventDefault(); // Prevent page scrolling
        if (e.repeat) return;
        if (!showResult) {
          handleSubmit();
        } else {
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentQuestion, category, archiveId, currentIndex, selectedAnswer, showResult,
    handleSubmit, handleNext, finishQuiz
  ]);

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
        <div className="max-w-4xl mx-auto px-4 py-12">
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


          {wrongItems.length > 0 && (
            <div className="mt-8">
              <div className="flex flex-col gap-6 mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>错题回顾</h3>
                  
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => setShowCatPicker(true)}
                      className="px-4 py-2 rounded-lg text-sm font-medium border flex items-center gap-2 bg-white hover:bg-gray-50 transition-all flex-1 sm:flex-initial"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    >
                      📁 目标收藏夹: <span style={{ color: 'var(--color-primary)' }}>{activeFavCatName}</span>
                    </button>
                    
                    <button
                      onClick={handleBatchFavoriteWrong}
                      disabled={batchFavLoading || selectedWrongIds.size === 0}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:grayscale flex-1 sm:flex-initial"
                      style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', border: '1px solid #fbbf24' }}
                    >
                      ⭐ {batchFavLoading ? '处理中...' : batchFavSuccess ? '收藏成功！' : `收藏选中的 ${selectedWrongIds.size} 题`}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={selectedWrongIds.size === wrongItems.length && wrongItems.length > 0}
                      onChange={toggleSelectAllWrongs}
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>全选所有错题</span>
                  </label>
                  <span className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                    已选择 {selectedWrongIds.size} / {wrongItems.length}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {wrongItems.map((item, index) => {
                  const isFav = wrongFavoriteMap.get(item.question.id);
                  const isSelected = selectedWrongIds.has(item.question.id);
                  return (
                    <div key={item.question.id} className="p-6 rounded-xl relative transition-all shadow-sm hover:shadow-md flex gap-4" style={{ backgroundColor: 'var(--color-card)', border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
                      <div className="pt-1">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelectWrong(item.question.id)}
                        />
                      </div>
                      
                      <div className="flex-1">
                        {/* 单题收藏星标按钮 */}
                        <button
                          onClick={() => handleToggleWrongFavorite(item.question)}
                          className="absolute top-5 right-5 p-2 rounded-full hover:bg-opacity-80 transition-all"
                          title={isFav ? '取消收藏' : '收藏此题'}
                        >
                          <svg className="w-6 h-6" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" style={{ color: isFav ? '#fbbf24' : 'var(--color-secondary)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>

                        <p className="font-bold text-lg mb-4 pr-12 text-left" style={{ color: 'var(--color-text)' }}>{index + 1}. {item.question.question}</p>
                        <div className="space-y-2 text-left">
                          {item.question.options.map((opt, optIndex) => {
                            const isUserAnswer = opt === item.userAnswer;
                            const isCorrect = opt === item.question.correctAnswer;
                            let bgColor = 'var(--color-bg)';
                            let textColor = 'var(--color-text)';
                            let borderColor = 'var(--color-border)';
                            if (isCorrect) { bgColor = 'rgba(16, 185, 129, 0.1)'; textColor = 'var(--color-success)'; borderColor = 'var(--color-success)'; }
                            else if (isUserAnswer) { bgColor = 'rgba(239, 68, 68, 0.1)'; textColor = 'var(--color-error)'; borderColor = 'var(--color-error)'; }
                            return (
                              <div key={optIndex} className="px-4 py-3 rounded-lg text-md font-medium" style={{ backgroundColor: bgColor, color: textColor, border: `1px solid ${borderColor}` }}>
                                {getOptionLabel(optIndex)}. {opt}
                                {isCorrect && ' ✓ 正确答案'}
                                {isUserAnswer && !isCorrect && ' ✗ 你的答案'}
                              </div>
                            );
                          })}
                        </div>
                        {item.question.explanation && <p className="mt-4 text-sm leading-relaxed text-left" style={{ color: 'var(--color-secondary)' }}>💡 <strong>解析：</strong>{item.question.explanation}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <FavoriteCategoryPicker
            isOpen={showCatPicker}
            onClose={() => { setShowCatPicker(false); setTargetQuestionForCat(null); }}
            onSelect={handleSelectCategory}
            initialCategoryId={activeFavCatId}
          />
        </div>
      </div>
    );
  }

  const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
  const answeredCount = answers.size + (showResult ? 0 : (selectedAnswer ? 1 : 0));

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* 恢复进度选择弹窗 */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="rounded-xl p-8 max-w-md w-full shadow-2xl border transition-all transform scale-100" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
            <div className="text-center mb-4">
              <span className="text-5xl">🕒</span>
            </div>
            <h3 className="text-2xl font-bold text-center mb-3" style={{ color: 'var(--color-text)' }}>发现上次答题进度</h3>
            <p className="text-md text-center mb-8 leading-relaxed" style={{ color: 'var(--color-secondary)' }}>
              您上次在这个题组答到了第 <strong className="text-xl" style={{ color: 'var(--color-primary)' }}>{savedProgressData?.currentIndex + 1}</strong> / {questions.length} 题（已答 {savedProgressData?.answers?.length || 0} 题）。
              是否继续上次进度，还是重新开始？
            </p>
            <div className="flex gap-4">
              <button 
                onClick={handleRestartProgress} 
                className="flex-1 py-3.5 rounded-lg text-md font-medium transition-all hover:bg-opacity-10 active:scale-95" 
                style={{ backgroundColor: 'transparent', color: 'var(--color-secondary)', border: '1px solid var(--color-border)' }}
              >
                重新开始
              </button>
              <button 
                onClick={handleResumeProgress} 
                className="flex-1 py-3.5 rounded-lg text-white text-md font-medium shadow-md transition-all hover:opacity-90 active:scale-95" 
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
            <button onClick={() => setShowEarlySubmitConfirm(true)} className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}>
              提交
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="rounded-xl p-10 mb-8 relative transition-all shadow-md hover:shadow-lg" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
          <div className="absolute top-5 right-5 flex flex-col items-end gap-2">
            <button
              onClick={() => handleToggleFavorite(currentQuestion)}
              className="p-2 rounded-full hover:opacity-85 transition-all shadow-sm bg-white"
              title={favoriteMap.get(currentQuestion.id) ? '取消收藏' : '收藏题目'}
            >
              <svg className="w-7 h-7" fill={favoriteMap.get(currentQuestion.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" style={{ color: favoriteMap.get(currentQuestion.id) ? '#fbbf24' : 'var(--color-secondary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
            <button 
              onClick={() => { setTargetQuestionForCat(currentQuestion); setShowCatPicker(true); }}
              className="text-[10px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
              style={{ color: 'var(--color-secondary)' }}
            >
              📂 {activeFavCatName}
            </button>
          </div>
          <p className="text-2xl leading-relaxed pr-12 font-bold" style={{ color: 'var(--color-text)' }}>{currentQuestion.question}</p>
        </div>

        <div className="flex flex-col gap-5 mb-8">
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
                  <button key={option} onClick={() => handleSelectAnswer(option)} disabled={showResult} className="w-full text-left p-6 rounded-xl transition-all flex items-center gap-5 hover:shadow-md" style={{ backgroundColor: bgColor, border: `2px solid ${borderColor}`, color: textColor }}>
                    <span className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-2xl font-bold" style={{ backgroundColor: isSelected || (showResult && isCorrectOption) ? borderColor : 'var(--color-bg)', color: isSelected || (showResult && isCorrectOption) ? 'white' : 'var(--color-text)' }}>
                      {option === '对' ? '✓' : '✗'}
                    </span>
                    <span className="text-xl font-bold">{option}</span>
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
                <button key={index} onClick={() => handleSelectAnswer(option)} disabled={showResult} className="w-full text-left p-6 rounded-xl transition-all flex items-start gap-5 hover:shadow-md" style={{ backgroundColor: bgColor, border: `2px solid ${borderColor}`, color: textColor }}>
                  <span className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold" style={{ backgroundColor: isSelected || (showResult && isCorrectOption) ? borderColor : 'var(--color-bg)', color: isSelected || (showResult && isCorrectOption) ? 'white' : 'var(--color-text)' }}>
                    {getOptionLabel(index)}
                  </span>
                  <span className="pt-2 text-lg font-semibold leading-relaxed">{option}</span>
                </button>
              );
            })
          )}
        </div>

        {showResult && (
          <div className="rounded-xl p-6 mb-8 shadow-sm transition-all animate-fade-in" style={{ backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)', border: `1.5px solid ${isCorrect ? 'var(--color-success)' : 'var(--color-error)'}` }}>
            <div className="flex items-center gap-2.5 mb-3">
              {isCorrect ? (
                <svg className="w-6 h-6" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-6 h-6" style={{ color: 'var(--color-error)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              )}
              <span className="text-lg font-bold" style={{ color: isCorrect ? 'var(--color-success)' : 'var(--color-error)' }}>{isCorrect ? '回答正确！' : '回答错误'}</span>
            </div>
            {currentQuestion.explanation && <p className="text-md leading-relaxed" style={{ color: 'var(--color-secondary)' }}><strong>解析：</strong>{currentQuestion.explanation}</p>}
          </div>
        )}

        {!showResult ? (
          <button onClick={handleSubmit} disabled={!selectedAnswer} className="w-full py-4 rounded-xl text-lg font-bold text-white transition-all active:scale-[0.99] disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
            确认答案
          </button>
        ) : (
          <button onClick={handleNext} className="w-full py-4 rounded-xl text-lg font-bold text-white transition-all active:scale-[0.99]" style={{ backgroundColor: 'var(--color-primary)' }}>
            {!isCorrect ? '重新作答' : (currentIndex < questions.length - 1 ? '下一题' : '查看结果')}
          </button>
        )}
      </main>
      <FavoriteCategoryPicker
        isOpen={showCatPicker}
        onClose={() => { setShowCatPicker(false); setTargetQuestionForCat(null); }}
        onSelect={handleSelectCategory}
        initialCategoryId={activeFavCatId}
      />
    </div>
  );
}
