import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { WrongAnswer, WrongAnswerStats } from '../types';
import {
  getAllWrongAnswers,
  getWrongAnswersByCategory,
} from '../services/storage/indexedDB';
import {
  addNote,
  getCategoryLabel,
  getWrongAnswerStats,
  getWrongAnswersForReview,
  markAsMastered,
  removeWrongAnswer,
  unmarkMastered,
} from '../services/learning/wrongAnswer';
import { addFavoritesFromWrongAnswers } from '../services/learning/favorite';
import { getOptionLabel } from '../services/learning/quiz';
import { useToast } from '../components/ui';
import { trackEvent } from '../services/statistics/eventTracker';

type ViewMode = 'stats' | 'list' | 'review';

const sortWrongAnswers = (items: WrongAnswer[]) =>
  [...items].sort(
    (a, b) =>
      new Date(b.lastWrongAt || b.createdAt).getTime() -
      new Date(a.lastWrongAt || a.createdAt).getTime()
  );

export default function WrongAnswersPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('stats');
  const [stats, setStats] = useState<WrongAnswerStats[]>([]);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Map<string, string>>(new Map());
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');

  const totalWrong = wrongAnswers.length;
  const masteredCount = wrongAnswers.filter((item) => item.mastered).length;
  const unmasteredCount = totalWrong - masteredCount;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statsData, allWrong] = await Promise.all([
        getWrongAnswerStats(),
        getAllWrongAnswers(),
      ]);
      setStats(statsData);
      setWrongAnswers(sortWrongAnswers(allWrong));

      const notes = new Map<string, string>();
      allWrong.forEach((item) => {
        if (item.notes) notes.set(item.id, item.notes);
      });
      setNotesMap(notes);
    } catch (error) {
      console.error('加载错题数据失败:', error);
      toast.error('加载错题失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleFilterByCategory(category: string | null) {
    setSelectedCategory(category);
    setLoading(true);
    try {
      if (!category) {
        const all = await getAllWrongAnswers();
        setWrongAnswers(sortWrongAnswers(all));
      } else {
        const filtered = await getWrongAnswersByCategory(category);
        setWrongAnswers(sortWrongAnswers(filtered));
      }
      setViewMode('list');
    } finally {
      setLoading(false);
    }
  }

  async function handleReviewMode() {
    setLoading(true);
    trackEvent('wronganswer_review_start', { category: selectedCategory || 'all' });
    try {
      const reviewQuestions = await getWrongAnswersForReview(selectedCategory || undefined);
      setWrongAnswers(reviewQuestions);
      setViewMode('review');
      trackEvent('wronganswer_review_success', { count: reviewQuestions.length });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleMastered(item: WrongAnswer) {
    if (item.mastered) {
      await unmarkMastered(item.id);
    } else {
      await markAsMastered(item.id);
    }

    await loadData();
    if (selectedCategory) {
      await handleFilterByCategory(selectedCategory);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这道错题吗？')) return;

    await removeWrongAnswer(id);
    toast.success('错题已删除');
    trackEvent('wronganswer_delete_success', { id });

    await loadData();
    if (selectedCategory) {
      await handleFilterByCategory(selectedCategory);
    }
  }

  async function handleSaveNotes(id: string) {
    await addNote(id, notesText.trim());
    setNotesMap((prev) => new Map(prev).set(id, notesText.trim()));
    setEditingNotesId(null);
    setNotesText('');
    toast.success('笔记已保存');
  }

  async function handleAddToFavorites(items: WrongAnswer[]) {
    if (items.length === 0) {
      toast.warning('没有可收藏的题目');
      return;
    }

    try {
      await addFavoritesFromWrongAnswers(items, 'default');
      toast.success(`已加入收藏 ${items.length} 题`);
      trackEvent('wronganswer_favorite_success', { count: items.length });
    } catch (error) {
      console.error('添加收藏失败:', error);
      toast.error('添加收藏失败，请重试');
      trackEvent('wronganswer_favorite_fail', { reason: 'exception' });
    }
  }

  async function handleFavoriteAndReview() {
    const pending = wrongAnswers.filter((item) => !item.mastered);
    if (pending.length === 0) {
      toast.warning('当前没有未掌握错题');
      return;
    }

    setLoading(true);
    try {
      await addFavoritesFromWrongAnswers(pending, 'default');
      const reviewQuestions = await getWrongAnswersForReview(selectedCategory || undefined);
      setWrongAnswers(reviewQuestions);
      setViewMode('review');
      toast.success(`已收藏 ${pending.length} 题，并进入复习模式`);
      trackEvent('wronganswer_convert_success', { action: 'favorite_review', count: pending.length });
    } catch (error) {
      console.error('收藏并复习失败:', error);
      toast.error('收藏并复习失败，请重试');
      trackEvent('wronganswer_convert_fail', { action: 'favorite_review' });
    } finally {
      setLoading(false);
    }
  }

  async function handleFavoriteAndOpenFavorites() {
    const pending = wrongAnswers.filter((item) => !item.mastered);
    if (pending.length === 0) {
      toast.warning('当前没有未掌握错题');
      return;
    }

    setLoading(true);
    try {
      await addFavoritesFromWrongAnswers(pending, 'default');
      trackEvent('wronganswer_convert_success', { action: 'favorite_open', count: pending.length });
      navigate('/favorites', {
        state: {
          openCategory: 'default',
          openList: true,
          fromWrongAnswers: true,
          addedCount: pending.length,
        },
      });
    } catch (error) {
      console.error('收藏并打开收藏夹失败:', error);
      toast.error('收藏失败，请重试');
      trackEvent('wronganswer_convert_fail', { action: 'favorite_open' });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div
          className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2"
          style={{ borderColor: 'var(--color-primary)' }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link to="/quiz-import" className="mr-4 p-2 rounded-full hover:opacity-80">
                <svg className="w-6 h-6" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                错题本
              </h1>
            </div>

            {viewMode !== 'stats' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFavoriteAndOpenFavorites}
                  className="px-4 py-2 rounded-lg text-white"
                  style={{ backgroundColor: 'var(--color-warning)' }}
                >
                  收藏后查看
                </button>
                <button
                  onClick={handleFavoriteAndReview}
                  className="px-4 py-2 rounded-lg text-white"
                  style={{ backgroundColor: 'var(--color-success)' }}
                >
                  收藏并复习
                </button>
                <button
                  onClick={handleReviewMode}
                  className="px-4 py-2 rounded-lg text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  开始复习
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {viewMode === 'stats' && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--color-card)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-error)' }}>{totalWrong}</p>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>总错题</p>
              </div>
              <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--color-card)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{unmasteredCount}</p>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>未掌握</p>
              </div>
              <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--color-card)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{masteredCount}</p>
                <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>已掌握</p>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-medium mb-3" style={{ color: 'var(--color-text)' }}>
                分类统计
              </h2>
              <div className="space-y-2">
                <button
                  className="w-full p-4 rounded-lg flex justify-between items-center text-left"
                  style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                  onClick={() => handleFilterByCategory(null)}
                >
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>全部错题</h3>
                    <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                      {totalWrong} 题 · {masteredCount} 已掌握
                    </p>
                  </div>
                  <span style={{ color: 'var(--color-secondary)' }}>›</span>
                </button>

                {stats.map((stat) => (
                  <button
                    key={stat.category}
                    className="w-full p-4 rounded-lg flex justify-between items-center text-left"
                    style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                    onClick={() => handleFilterByCategory(stat.category)}
                  >
                    <div>
                      <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {getCategoryLabel(stat.category)}
                      </h3>
                      <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                        {stat.totalCount} 题 · {stat.unmasteredCount} 未掌握
                      </p>
                    </div>
                    <span style={{ color: 'var(--color-secondary)' }}>›</span>
                  </button>
                ))}
              </div>
            </div>

            {unmasteredCount > 0 && (
              <div className="text-center flex flex-col sm:flex-row sm:justify-center gap-3">
                <button
                  onClick={handleFavoriteAndOpenFavorites}
                  className="px-6 py-3 rounded-lg text-white font-medium"
                  style={{ backgroundColor: 'var(--color-warning)' }}
                >
                  收藏后查看 {unmasteredCount} 题
                </button>
                <button
                  onClick={handleFavoriteAndReview}
                  className="px-6 py-3 rounded-lg text-white font-medium"
                  style={{ backgroundColor: 'var(--color-success)' }}
                >
                  收藏并复习 {unmasteredCount} 题
                </button>
                <button
                  onClick={handleReviewMode}
                  className="px-6 py-3 rounded-lg text-white font-medium"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  开始复习 {unmasteredCount} 题
                </button>
                <Link
                  to="/favorites"
                  className="px-6 py-3 rounded-lg font-medium"
                  style={{
                    backgroundColor: 'var(--color-card)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  打开收藏夹
                </Link>
              </div>
            )}
          </>
        )}

        {(viewMode === 'list' || viewMode === 'review') && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setViewMode('stats');
                    setSelectedCategory(null);
                  }}
                  className="px-3 py-1 rounded text-sm"
                  style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)' }}
                >
                  ← 返回
                </button>
                <span className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                  {selectedCategory ? getCategoryLabel(selectedCategory) : '全部'} ({wrongAnswers.length} 题)
                </span>
                {viewMode === 'review' && (
                  <span className="text-sm" style={{ color: 'var(--color-warning)' }}>· 复习模式</span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {wrongAnswers.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--color-secondary)' }}>
                  暂无错题
                </div>
              ) : (
                wrongAnswers.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg"
                    style={{
                      backgroundColor: 'var(--color-card)',
                      border: item.mastered
                        ? '1px solid var(--color-success)'
                        : '1px solid var(--color-border)',
                    }}
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                            {item.question.question}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                            {getCategoryLabel(item.category)} · 错误 {item.wrongCount} 次
                            {item.mastered ? ' · 已掌握' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.mastered && (
                            <span className="text-sm" style={{ color: 'var(--color-success)' }}>已掌握</span>
                          )}
                          <svg
                            className={`w-5 h-5 transition-transform ${expandedId === item.id ? 'rotate-180' : ''}`}
                            style={{ color: 'var(--color-secondary)' }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {expandedId === item.id && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="pt-4 space-y-2">
                          {item.question.options.map((option, idx) => {
                            const isCorrect = option === item.question.correctAnswer;
                            const isUserAnswer = option === item.userAnswer;
                            return (
                              <div
                                key={idx}
                                className="px-3 py-2 rounded text-sm"
                                style={{
                                  backgroundColor: isCorrect
                                    ? 'rgba(16, 185, 129, 0.1)'
                                    : isUserAnswer
                                      ? 'rgba(239, 68, 68, 0.1)'
                                      : 'var(--color-bg)',
                                  color: isCorrect
                                    ? 'var(--color-success)'
                                    : isUserAnswer
                                      ? 'var(--color-error)'
                                      : 'var(--color-text)',
                                  border: `1px solid ${
                                    isCorrect
                                      ? 'var(--color-success)'
                                      : isUserAnswer
                                        ? 'var(--color-error)'
                                        : 'var(--color-border)'
                                  }`,
                                }}
                              >
                                {getOptionLabel(idx)}. {option}
                                {isCorrect ? '（正确）' : ''}
                                {isUserAnswer && !isCorrect ? '（你的答案）' : ''}
                              </div>
                            );
                          })}
                        </div>

                        {item.question.explanation && (
                          <p className="mt-3 text-sm" style={{ color: 'var(--color-secondary)' }}>
                            解析：{item.question.explanation}
                          </p>
                        )}

                        <div className="mt-4">
                          {editingNotesId === item.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={notesText}
                                onChange={(event) => setNotesText(event.target.value)}
                                className="w-full px-3 py-2 rounded-lg text-sm"
                                style={{
                                  backgroundColor: 'var(--color-bg)',
                                  color: 'var(--color-text)',
                                  border: '1px solid var(--color-border)',
                                }}
                                placeholder="添加笔记..."
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveNotes(item.id)}
                                  className="px-3 py-1 rounded text-sm text-white"
                                  style={{ backgroundColor: 'var(--color-primary)' }}
                                >
                                  保存
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingNotesId(null);
                                    setNotesText('');
                                  }}
                                  className="px-3 py-1 rounded text-sm"
                                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              {notesMap.get(item.id) && (
                                <p className="text-sm mb-2" style={{ color: 'var(--color-secondary)' }}>
                                  笔记：{notesMap.get(item.id)}
                                </p>
                              )}
                              <button
                                onClick={() => {
                                  setEditingNotesId(item.id);
                                  setNotesText(notesMap.get(item.id) || '');
                                }}
                                className="px-3 py-1 rounded text-sm"
                                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}
                              >
                                {notesMap.get(item.id) ? '编辑笔记' : '添加笔记'}
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => handleToggleMastered(item)}
                            className="px-3 py-1 rounded text-sm"
                            style={{
                              backgroundColor: item.mastered ? 'var(--color-bg)' : 'var(--color-success)',
                              color: item.mastered ? 'var(--color-text)' : '#ffffff',
                            }}
                          >
                            {item.mastered ? '取消掌握' : '标记掌握'}
                          </button>
                          <button
                            onClick={() => handleAddToFavorites([item])}
                            className="px-3 py-1 rounded text-sm"
                            style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}
                          >
                            收藏
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="px-3 py-1 rounded text-sm"
                            style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-error)' }}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {totalWrong === 0 && viewMode === 'stats' && (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">📘</p>
            <p style={{ color: 'var(--color-text)' }}>暂无错题</p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-secondary)' }}>
              做题时答错的题目会自动进入错题本
            </p>
            <Link
              to="/quiz-import"
              className="inline-block mt-4 px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              去做题
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
