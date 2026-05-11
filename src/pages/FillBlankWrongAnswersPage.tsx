/**
 * 填空题错题本页面
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FillBlankWrongAnswer } from '../types';
import {
  getAllFillBlankWrongAnswers,
  getFillBlankWrongAnswersByCategory,
} from '../services/storage/indexedDB';
import {
  getFillBlankWrongAnswerStats,
  getFillBlankWrongAnswersForReview,
  markFillBlankWrongAsMastered,
  unmarkFillBlankWrongAsMastered,
  removeFillBlankWrongAnswer,
  addFillBlankWrongAnswerNote,
} from '../services/learning/fillBlankWrongAnswer';
import { addFillBlankFavoritesFromItems } from '../services/learning/fillBlankFavorite';

type ViewMode = 'stats' | 'list' | 'review';

export default function FillBlankWrongAnswersPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('stats');
  const [stats, setStats] = useState<Array<{ category: string; totalCount: number; masteredCount: number; unmasteredCount: number }>>([]);
  const [wrongAnswers, setWrongAnswers] = useState<FillBlankWrongAnswer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Map<string, string>>(new Map());
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');

  // 练习入口
  const navigate = useNavigate();
  function handlePracticeAll(mode: 'practice' | 'spell') {
    if (wrongAnswers.length === 0) {
      alert('暂无错题可练习');
      return;
    }
    const items = wrongAnswers.map(w => w.fillBlankItem);
    sessionStorage.setItem('fillBlankPractice', JSON.stringify(items));
    navigate(mode === 'spell' ? '/fill-blank-spell-practice' : '/fill-blank-practice');
  }

  function handlePracticeSingle(wrong: FillBlankWrongAnswer, mode: 'practice' | 'spell') {
    sessionStorage.setItem('fillBlankPractice', JSON.stringify([wrong.fillBlankItem]));
    navigate(mode === 'spell' ? '/fill-blank-spell-practice' : '/fill-blank-practice');
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statsData, allWrong] = await Promise.all([
        getFillBlankWrongAnswerStats(),
        getAllFillBlankWrongAnswers(),
      ]);
      setStats(statsData);
      setWrongAnswers(
        allWrong.sort((a, b) => new Date(b.lastWrongAt || b.firstWrongAt).getTime() - new Date(a.lastWrongAt || a.firstWrongAt).getTime())
      );

      const notes = new Map<string, string>();
      allWrong.forEach(wrong => {
        if (wrong.notes) notes.set(wrong.id, wrong.notes);
      });
      setNotesMap(notes);
    } catch (err) {
      console.error('加载填空题错题数据失败:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFilterByCategory(category: string | null) {
    setSelectedCategory(category);
    setLoading(true);
    try {
      if (category) {
        const filtered = await getFillBlankWrongAnswersByCategory(category);
        setWrongAnswers(
          filtered.sort((a, b) => new Date(b.lastWrongAt || b.firstWrongAt).getTime() - new Date(a.lastWrongAt || a.firstWrongAt).getTime())
        );
      } else {
        const all = await getAllFillBlankWrongAnswers();
        setWrongAnswers(all.sort((a, b) => new Date(b.lastWrongAt || b.firstWrongAt).getTime() - new Date(a.lastWrongAt || a.firstWrongAt).getTime()));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReviewMode() {
    setLoading(true);
    try {
      const reviewQuestions = await getFillBlankWrongAnswersForReview(selectedCategory || undefined);
      setWrongAnswers(reviewQuestions);
      setViewMode('review');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleMastered(wrong: FillBlankWrongAnswer) {
    if (wrong.mastered) {
      await unmarkFillBlankWrongAsMastered(wrong.id);
    } else {
      await markFillBlankWrongAsMastered(wrong.id);
    }
    await loadData();
    if (selectedCategory) {
      await handleFilterByCategory(selectedCategory);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这道错题吗？')) return;
    await removeFillBlankWrongAnswer(id);
    await loadData();
    if (selectedCategory) {
      await handleFilterByCategory(selectedCategory);
    }
  }

  async function handleSaveNotes(id: string) {
    await addFillBlankWrongAnswerNote(id, notesText);
    setNotesMap(prev => new Map(prev).set(id, notesText));
    setEditingNotes(null);
    setNotesText('');
  }

  async function handleAddToFavorites(items: FillBlankWrongAnswer[]) {
    if (items.length === 0) return;

    try {
      const fillBlankItems = items.map(w => w.fillBlankItem);
      const added = await addFillBlankFavoritesFromItems(fillBlankItems, 'default');
      alert(`已将 ${added.length} 道错题添加到收藏夹`);
    } catch (err) {
      console.error('添加到收藏夹失败:', err);
      alert('添加到收藏夹失败，请重试');
    }
  }

  const totalWrong = wrongAnswers.length;
  const masteredCount = wrongAnswers.filter(w => w.mastered).length;
  const unmasteredCount = totalWrong - masteredCount;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link to="/fill-blank-import" className="mr-4 p-2 rounded-full hover:opacity-80">
                <svg className="w-6 h-6" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>📕 填空题错题本</h1>
            </div>
            {viewMode === 'list' && (
              <button onClick={handleReviewMode} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                开始复习
              </button>
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

            {totalWrong > 0 && (
              <div className="flex gap-2 mb-6">
                <button onClick={() => handlePracticeAll('practice')} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-success)' }}>
                  全部练习
                </button>
                <button onClick={() => handlePracticeAll('spell')} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-warning)' }}>
                  拼写练习
                </button>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-lg font-medium mb-3" style={{ color: 'var(--color-text)' }}>分类统计</h2>
              <div className="space-y-2">
                <div
                  className="p-4 rounded-lg flex justify-between items-center cursor-pointer"
                  style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                  onClick={() => { handleFilterByCategory(null); setViewMode('list'); }}
                >
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>全部错题</h3>
                    <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                      {totalWrong} 题 · {masteredCount} 已掌握
                    </p>
                  </div>
                  <svg className="w-5 h-5" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {stats.map(stat => (
                  <div
                    key={stat.category}
                    className="p-4 rounded-lg flex justify-between items-center cursor-pointer"
                    style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                    onClick={() => { handleFilterByCategory(stat.category); setViewMode('list'); }}
                  >
                    <div>
                      <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>{stat.category}</h3>
                      <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                        {stat.totalCount} 题 · {stat.masteredCount} 已掌握 · {stat.unmasteredCount} 未掌握
                      </p>
                    </div>
                    <svg className="w-5 h-5" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                ))}
              </div>
            </div>

            {unmasteredCount > 0 && (
              <div className="text-center">
                <button onClick={handleReviewMode} className="px-6 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
                  开始复习 {unmasteredCount} 道未掌握错题
                </button>
              </div>
            )}
          </>
        )}

        {(viewMode === 'list' || viewMode === 'review') && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => { setViewMode('stats'); setSelectedCategory(null); }} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)' }}>← 返回</button>
                <span className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                  {selectedCategory ? selectedCategory : '全部'} ({wrongAnswers.length} 题)
                </span>
                {viewMode === 'review' && <span className="text-sm" style={{ color: 'var(--color-warning)' }}>· 复习模式</span>}
              </div>
              {wrongAnswers.length > 0 && (
                <button onClick={() => handleAddToFavorites(wrongAnswers)} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}>
                  全部收藏
                </button>
              )}
            </div>

            <div className="space-y-4">
              {wrongAnswers.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--color-secondary)' }}>暂无错题</div>
              ) : (
                wrongAnswers.map(wrong => (
                  <div key={wrong.id} className="rounded-lg" style={{ backgroundColor: 'var(--color-card)', border: wrong.mastered ? '1px solid var(--color-success)' : '1px solid var(--color-border)' }}>
                    <div className="p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === wrong.id ? null : wrong.id)}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>{wrong.fillBlankItem.question}</p>
                          <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                            {wrong.category} · 错误 {wrong.wrongCount} 次
                            {wrong.mastered && ' · 已掌握'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {wrong.mastered && (
                            <span className="text-sm" style={{ color: 'var(--color-success)' }}>✓</span>
                          )}
                          <svg className={`w-5 h-5 transition-transform ${expandedId === wrong.id ? 'rotate-180' : ''}`} style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {expandedId === wrong.id && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="pt-4 space-y-2">
                          <div className="px-3 py-2 rounded text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', border: '1px solid var(--color-error)' }}>
                            你的答案：{wrong.userAnswer || '（空）'}
                          </div>
                          <div className="px-3 py-2 rounded text-sm" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', border: '1px solid var(--color-success)' }}>
                            正确答案：{wrong.correctAnswer}
                          </div>
                        </div>

                        {wrong.hints && wrong.hints.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>💡 提示：</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {wrong.hints.map((h, idx) => (
                                <span key={idx} className="px-2 py-1 rounded text-xs" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-secondary)' }}>{h}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 笔记部分 */}
                        <div className="mt-4">
                          {editingNotes === wrong.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={notesText}
                                onChange={e => setNotesText(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg text-sm"
                                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                                placeholder="添加笔记..."
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <button onClick={() => handleSaveNotes(wrong.id)} className="px-3 py-1 rounded text-sm text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                                  保存
                                </button>
                                <button onClick={() => { setEditingNotes(null); setNotesText(''); }} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
                                  取消
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              {notesMap.get(wrong.id) && (
                                <p className="text-sm mb-2" style={{ color: 'var(--color-secondary)' }}>
                                  📝 {notesMap.get(wrong.id)}
                                </p>
                              )}
                              <button
                                onClick={() => { setEditingNotes(wrong.id); setNotesText(notesMap.get(wrong.id) || ''); }}
                                className="px-3 py-1 rounded text-sm"
                                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}
                              >
                                {notesMap.get(wrong.id) ? '编辑笔记' : '添加笔记'}
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button onClick={() => handleToggleMastered(wrong)} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: wrong.mastered ? 'var(--color-bg)' : 'var(--color-success)', color: wrong.mastered ? 'var(--color-text)' : 'white' }}>
                            {wrong.mastered ? '取消掌握' : '标记掌握'}
                          </button>
                          <button onClick={() => handleAddToFavorites([wrong])} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}>
                            收藏
                          </button>
                          <button onClick={() => handleDelete(wrong.id)} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-error)' }}>
                            删除
                          </button>
                          <button onClick={() => handlePracticeSingle(wrong, 'practice')} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-success)' }}>
                            练习
                          </button>
                          <button onClick={() => handlePracticeSingle(wrong, 'spell')} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-warning)' }}>
                            拼写练习
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
      </main>
    </div>
  );
}
