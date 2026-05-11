/**
 * 閿欓鏈〉闈?
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { WrongAnswer, WrongAnswerStats } from '../types';
import {
  getAllWrongAnswers,
  getWrongAnswersByCategory,
} from '../services/storage/indexedDB';
import {
  getWrongAnswerStats,
  getWrongAnswersForReview,
  markAsMastered,
  unmarkMastered,
  removeWrongAnswer,
  addNote,
  getCategoryLabel,
} from '../services/learning/wrongAnswer';
import { getOptionLabel } from '../services/learning/quiz';
import { addFavoritesFromWrongAnswers } from '../services/learning/favorite';
import { useToast } from '../components/ui';

type ViewMode = 'stats' | 'list' | 'review';

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
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');

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
      setWrongAnswers(allWrong.sort((a, b) => 
        new Date(b.lastWrongAt || b.createdAt).getTime() - new Date(a.lastWrongAt || a.createdAt).getTime()
      ));
      
      const notes = new Map<string, string>();
      allWrong.forEach(wrong => {
        if (wrong.notes) {
          notes.set(wrong.id, wrong.notes);
        }
      });
      setNotesMap(notes);
    } catch (err) {
      console.error('鍔犺浇閿欓鏁版嵁澶辫触:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFilterByCategory(category: string | null) {
    setSelectedCategory(category);
    setLoading(true);
    try {
      if (category) {
        const filtered = await getWrongAnswersByCategory(category);
        setWrongAnswers(filtered.sort((a, b) => 
          new Date(b.lastWrongAt || b.createdAt).getTime() - new Date(a.lastWrongAt || a.createdAt).getTime()
        ));
      } else {
        const all = await getAllWrongAnswers();
        setWrongAnswers(all.sort((a, b) => 
          new Date(b.lastWrongAt || b.createdAt).getTime() - new Date(a.lastWrongAt || a.createdAt).getTime()
        ));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReviewMode() {
    setLoading(true);
    try {
      const reviewQuestions = await getWrongAnswersForReview(selectedCategory || undefined);
      setWrongAnswers(reviewQuestions);
      setViewMode('review');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleMastered(wrong: WrongAnswer) {
    if (wrong.mastered) {
      await unmarkMastered(wrong.id);
    } else {
      await markAsMastered(wrong.id);
    }
    await loadData();
    if (selectedCategory) {
      await handleFilterByCategory(selectedCategory);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('纭畾瑕佸垹闄よ繖閬撻敊棰樺悧锛?)) return;
    await removeWrongAnswer(id);
    await loadData();
    if (selectedCategory) {
      await handleFilterByCategory(selectedCategory);
    }
  }

  async function handleSaveNotes(id: string) {
    await addNote(id, notesText);
    setNotesMap(prev => new Map(prev).set(id, notesText));
    setEditingNotes(null);
    setNotesText('');
  }

  async function handleAddToFavorites(wrongAnswers: WrongAnswer[]) {
    if (wrongAnswers.length === 0) return;
    
    try {
      await addFavoritesFromWrongAnswers(wrongAnswers, 'default');
      toast.success(`宸插皢 ${wrongAnswers.length} 閬撻敊棰樻坊鍔犲埌鏀惰棌澶筦);
    } catch (err) {
      console.error('娣诲姞鍒版敹钘忓す澶辫触:', err);
      toast.error('添加到收藏夹失败，请重试');
    }
  }

  async function handleFavoriteAndReview() {
    const pending = wrongAnswers.filter(w => !w.mastered);
    if (pending.length === 0) {
      toast.warning('当前没有未掌握错题);
      return;
    }

    setLoading(true);
    try {
      await addFavoritesFromWrongAnswers(pending, 'default');
      const reviewQuestions = await getWrongAnswersForReview(selectedCategory || undefined);
      setWrongAnswers(reviewQuestions);
      setViewMode('review');
      toast.success(`宸叉敹钘?${pending.length} 閬撴湭鎺屾彙閿欓锛屽苟杩涘叆澶嶄範妯″紡`);
    } catch (err) {
      console.error('鏀惰棌骞跺涔犲け璐?', err);
      toast.error('收藏并复习失败，请重试);
    } finally {
      setLoading(false);
    }
  }

  async function handleFavoriteAndOpenFavorites() {
    const pending = wrongAnswers.filter(w => !w.mastered);
    if (pending.length === 0) {
      toast.warning('当前没有未掌握错题);
      return;
    }

    setLoading(true);
    try {
      await addFavoritesFromWrongAnswers(pending, 'default');
      navigate('/favorites', {
        state: {
          openCategory: 'default',
          openList: true,
          fromWrongAnswers: true,
          addedCount: pending.length,
        },
      });
    } catch (err) {
      console.error('鏀惰棌鍚庢墦寮€鏀惰棌澶瑰け璐?', err);
      toast.error('收藏失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  function getCategoryName(category: string): string {
    return getCategoryLabel(category);
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
              <Link to="/quiz-import" className="mr-4 p-2 rounded-full hover:opacity-80">
                <svg className="w-6 h-6" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>错题本</h1>
            </div>
            {viewMode === 'list' && (
              <div className="flex items-center gap-2">
                <button onClick={handleFavoriteAndOpenFavorites} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-warning)' }}>
                  收藏后查看                </button>
                <button onClick={handleFavoriteAndReview} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-success)' }}>
                  收藏并复习                </button>
                <button onClick={handleReviewMode} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                  开始复习                </button>
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
              <h2 className="text-lg font-medium mb-3" style={{ color: 'var(--color-text)' }}>鍒嗙被缁熻</h2>
              <div className="space-y-2">
                {/* 鍏ㄩ儴 */}
                <div className="p-4 rounded-lg flex justify-between items-center cursor-pointer" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }} onClick={() => { handleFilterByCategory(null); setViewMode('list'); }}>
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>鍏ㄩ儴閿欓</h3>
                    <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                      {totalWrong} 棰?路 {masteredCount} 已掌握
                    </p>
                  </div>
                  <svg className="w-5 h-5" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                
                {/* 鍒嗙被缁熻 */}
                {stats.map(stat => (
                  <div key={stat.category} className="p-4 rounded-lg flex justify-between items-center cursor-pointer" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }} onClick={() => { handleFilterByCategory(stat.category); setViewMode('list'); }}>
                    <div>
                      <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>{getCategoryName(stat.category)}</h3>
                      <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                        {stat.totalCount} 棰?路 {stat.masteredCount} 已掌握路 {stat.unmasteredCount} 未掌握
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
              <div className="text-center flex flex-col sm:flex-row sm:justify-center gap-3">
                <button onClick={handleFavoriteAndOpenFavorites} className="px-6 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: 'var(--color-warning)' }}>
                  收藏后查看{unmasteredCount} 閬撻敊棰?                </button>
                <button onClick={handleFavoriteAndReview} className="px-6 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: 'var(--color-success)' }}>
                  收藏并复习{unmasteredCount} 閬撴湭鎺屾彙閿欓
                </button>
                <button onClick={handleReviewMode} className="px-6 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
                  开始复习{unmasteredCount} 閬撴湭鎺屾彙閿欓
                </button>
                <Link to="/favorites" className="px-6 py-3 rounded-lg font-medium" style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                  打开收藏夹                </Link>
              </div>
            )}
          </>
        )}

        {(viewMode === 'list' || viewMode === 'review') && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => { setViewMode('stats'); setSelectedCategory(null); }} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)' }}>鈫?杩斿洖</button>
                <span className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                  {selectedCategory ? getCategoryName(selectedCategory) : '鍏ㄩ儴'} ({wrongAnswers.length} 棰?
                </span>
                {viewMode === 'review' && <span className="text-sm" style={{ color: 'var(--color-warning)' }}>路 澶嶄範妯″紡</span>}
              </div>
              {wrongAnswers.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={handleFavoriteAndOpenFavorites} className="px-3 py-1 rounded text-sm text-white" style={{ backgroundColor: 'var(--color-warning)' }}>
                    收藏后查看                  </button>
                  <button onClick={() => handleAddToFavorites(wrongAnswers.filter(w => !w.mastered))} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}>
                    鏀惰棌未掌握                  </button>
                  <button onClick={handleFavoriteAndReview} className="px-3 py-1 rounded text-sm text-white" style={{ backgroundColor: 'var(--color-success)' }}>
                    收藏并复习                  </button>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              {wrongAnswers.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--color-secondary)' }}>鏆傛棤閿欓</div>
              ) : (
                wrongAnswers.map(wrong => (
                  <div key={wrong.id} className="rounded-lg" style={{ backgroundColor: 'var(--color-card)', border: wrong.mastered ? '1px solid var(--color-success)' : '1px solid var(--color-border)' }}>
                    <div className="p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === wrong.id ? null : wrong.id)}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>{wrong.question.question}</p>
                          <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                            {getCategoryName(wrong.category)} 路 閿欒 {wrong.wrongCount} 娆?
                            {wrong.mastered && ' 路 已掌握}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {wrong.mastered && (
                            <span className="text-sm" style={{ color: 'var(--color-success)' }}>鉁?</span>
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
                          {wrong.question.options.map((opt, idx) => {
                            const isCorrect = opt === wrong.question.correctAnswer;
                            const isUserAnswer = opt === wrong.userAnswer;
                            return (
                              <div key={idx} className="px-3 py-2 rounded text-sm" style={{
                                backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.1)' : isUserAnswer ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-bg)',
                                color: isCorrect ? 'var(--color-success)' : isUserAnswer ? 'var(--color-error)' : 'var(--color-text)',
                                border: `1px solid ${isCorrect ? 'var(--color-success)' : isUserAnswer ? 'var(--color-error)' : 'var(--color-border)'}`
                              }}>
                                {getOptionLabel(idx)}. {opt}
                                {isCorrect && ' 鉁?姝ｇ‘绛旀'}
                                {isUserAnswer && !isCorrect && ' 鉁?浣犵殑绛旀'}
                              </div>
                            );
                          })}
                        </div>
                        {wrong.question.explanation && (
                          <p className="mt-3 text-sm" style={{ color: 'var(--color-secondary)' }}>馃挕 {wrong.question.explanation}</p>
                        )}
                        
                        {/* 绗旇閮ㄥ垎 */}
                        <div className="mt-4">
                          {editingNotes === wrong.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={notesText}
                                onChange={e => setNotesText(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg text-sm"
                                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                                placeholder="娣诲姞绗旇..."
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <button onClick={() => handleSaveNotes(wrong.id)} className="px-3 py-1 rounded text-sm text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                                  淇濆瓨
                                </button>
                                <button onClick={() => { setEditingNotes(null); setNotesText(''); }} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
                                  鍙栨秷
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              {notesMap.get(wrong.id) && (
                                <p className="text-sm mb-2" style={{ color: 'var(--color-secondary)' }}>
                                  馃摑 {notesMap.get(wrong.id)}
                                </p>
                              )}
                              <button 
                                onClick={() => { setEditingNotes(wrong.id); setNotesText(notesMap.get(wrong.id) || ''); }} 
                                className="px-3 py-1 rounded text-sm" 
                                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}
                              >
                                {notesMap.get(wrong.id) ? '缂栬緫绗旇' : '娣诲姞绗旇'}
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button onClick={() => handleToggleMastered(wrong)} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: wrong.mastered ? 'var(--color-bg)' : 'var(--color-success)', color: wrong.mastered ? 'var(--color-text)' : 'white' }}>
                            {wrong.mastered ? '鍙栨秷鎺屾彙' : '鏍囪鎺屾彙'}
                          </button>
                          <button onClick={() => handleAddToFavorites([wrong])} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}>
                            鏀惰棌
                          </button>
                          <button onClick={() => handleDelete(wrong.id)} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-error)' }}>
                            鍒犻櫎
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
            <p className="text-4xl mb-4">馃摃</p>
            <p style={{ color: 'var(--color-text)' }}>鏆傛棤閿欓</p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-secondary)' }}>鍋氶鏃剁瓟閿欑殑棰樼洰浼氳嚜鍔ㄥ姞鍏ラ敊棰樻湰</p>
            <Link to="/quiz-import" className="inline-block mt-4 px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-primary)' }}>鍘诲仛棰?</Link>
          </div>
        )}
      </main>
    </div>
  );
}


