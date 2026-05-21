/**
 * 智能错题攻坚本 - WrongAnswersPage.tsx
 * 像素级对齐原型 `id="page-wrong-book"` 的极致错题干预中台
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WrongAnswer, WrongAnswerStats } from '../types';
import {
  getAllWrongAnswers,
  getWrongAnswersByCategory,
} from '../services/storage/indexedDB';
import {
  addNote,
  getCategoryLabel,
  getWrongAnswerStats,
  removeWrongAnswer,
} from '../services/learning/wrongAnswer';
import { addFavoritesFromWrongAnswers } from '../services/learning/favorite';
import { getOptionLabel } from '../services/learning/quiz';
import { generateWeaknessAnalysis } from '../services/ai/parser';
import { useToast } from '../components/ui';
import { trackEvent } from '../services/statistics/eventTracker';
import { RecitationRepository } from '../infrastructure/repositories/RecitationRepository';
import { AppLayout } from '../components/layout';

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

  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
  const [weaknessAnalysis, setWeaknessAnalysis] = useState<{ analysis: string; mnemonic: string; customQuestions: any[] } | null>(null);

  const totalWrong = wrongAnswers.length;
  const masteredCount = wrongAnswers.filter((item) => item.mastered).length;
  const unmasteredCount = totalWrong - masteredCount;

  // 均次重复触犯计算
  const avgWrongCount = useMemo(() => {
    if (wrongAnswers.length === 0) return '0.0 次';
    const sum = wrongAnswers.reduce((acc, curr) => acc + (curr.wrongCount || 1), 0);
    return `${(sum / wrongAnswers.length).toFixed(1)} 次`;
  }, [wrongAnswers]);

  useEffect(() => {
    void loadData();
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

  // 错题专项复习
  async function handleReviewMode() {
    const unmastered = wrongAnswers.filter((w) => !w.mastered);
    if (unmastered.length === 0) {
      toast.warning('当前分类中没有未掌握的错题可供复习');
      return;
    }
    
    // 自动桥接到统一复习大厅或者在页面内触发混合会话
    toast.success('已自动激活集中复习引擎，正在为您编排复习项目');
    navigate('/review');
  }

  // 本地-优先脱生转熟突变绑定
  async function handleToggleMastered(item: WrongAnswer) {
    const newMastered = !item.mastered;
    try {
      // 间接向仓储层发起写操作，彻底解耦
      await RecitationRepository.markWrongAnswerMastered(item.id, newMastered, 'quiz');
      toast.success(newMastered ? '标记已掌握！遗忘因子收敛中' : '已归还高危记忆区间');
      
      // 重新加载本地状态保证视图同步
      await loadData();
      if (selectedCategory) {
        const filtered = await getWrongAnswersByCategory(selectedCategory);
        setWrongAnswers(sortWrongAnswers(filtered));
      }
    } catch (error) {
      console.error('更新掌握状态失败:', error);
      toast.error('操作执行失败，请稍后重试');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要彻底删除这道错题记录吗？')) return;

    try {
      await removeWrongAnswer(id);
      toast.success('错题已彻底删除');
      trackEvent('wronganswer_delete_success', { id });
      
      await loadData();
      if (selectedCategory) {
        const filtered = await getWrongAnswersByCategory(selectedCategory);
        setWrongAnswers(sortWrongAnswers(filtered));
      }
    } catch (error) {
      console.error('删除错题失败:', error);
      toast.error('删除失败，请重试');
    }
  }

  async function handleSaveNotes(id: string) {
    await addNote(id, notesText.trim());
    setNotesMap((prev) => new Map(prev).set(id, notesText.trim()));
    setEditingNotesId(null);
    setNotesText('');
    toast.success('学术反思笔记已归档');
  }

  async function handleAddToFavorites(items: WrongAnswer[]) {
    if (items.length === 0) {
      toast.warning('当前分类无可用收藏项');
      return;
    }

    try {
      await addFavoritesFromWrongAnswers(items, 'default');
      toast.success(`已成功收藏 ${items.length} 道高频难点题`);
      trackEvent('wronganswer_favorite_success', { count: items.length });
    } catch (error) {
      console.error('添加收藏失败:', error);
      toast.error('添加收藏失败，请重试');
    }
  }

  async function handleFavoriteAndReview() {
    const pending = wrongAnswers.filter((item) => !item.mastered);
    if (pending.length === 0) {
      toast.warning('当前没有未掌握的错题');
      return;
    }

    setLoading(true);
    try {
      await addFavoritesFromWrongAnswers(pending, 'default');
      toast.success(`已收藏 ${pending.length} 题，并进入复习模式`);
      navigate('/review');
    } catch (error) {
      console.error('收藏并复习失败:', error);
      toast.error('收藏并复习失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleFavoriteAndOpenFavorites() {
    const pending = wrongAnswers.filter((item) => !item.mastered);
    if (pending.length === 0) {
      toast.warning('当前没有未掌握的错题');
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
    } catch (error) {
      console.error('收藏并打开收藏夹失败:', error);
      toast.error('收藏失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateAnalysis() {
    const unmastered = wrongAnswers.filter(w => !w.mastered);
    if (unmastered.length === 0) {
      toast.warning('当前分类下没有未掌握的错题');
      return;
    }
    
    const targetItems = unmastered.slice(0, 10).map(w => ({
      question: w.question,
      userAnswer: w.userAnswer || ''
    }));

    setGeneratingAnalysis(true);
    try {
      const result = await generateWeaknessAnalysis(targetItems);
      setWeaknessAnalysis(result);
      trackEvent('generate_weakness_analysis_success', { count: targetItems.length });
    } catch (error) {
      console.error('生成弱点解析失败:', error);
      toast.error('AI 深度解析失败，请检查网络或 API 密钥');
    } finally {
      setGeneratingAnalysis(false);
    }
  }

  if (loading) {
    return (
      <AppLayout title="智能错题本">
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="智能错题本">
      <div className="page-fade-in p-8 md:p-12 max-w-6xl mx-auto space-y-10">
        
        {/* 通栏标题 */}
        <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200/60 pb-8 gap-4">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">智能错题攻坚本</h2>
            <p className="text-slate-500 mt-2 text-sm">拦截和归档记忆黑洞，提供内存滑动窗口回收洗脑机制</p>
          </div>
          <div className="flex gap-2.5">
            {viewMode !== 'stats' && (
              <button
                onClick={() => {
                  setViewMode('stats');
                  setSelectedCategory(null);
                  setWeaknessAnalysis(null);
                }}
                className="px-5 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-sm font-bold active:scale-[0.98] transition-all"
              >
                返回统计
              </button>
            )}
            <button
              onClick={handleReviewMode}
              className="bg-feedback-error px-6 py-3 rounded-2xl text-white font-bold text-sm shadow-xl shadow-rose-600/20 hover:bg-rose-700 transition-all active:scale-[0.98]"
            >
              开启错题专项复习
            </button>
          </div>
        </header>

        {/* 顶部四维交叉中台看板 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-master border border-workspace-border text-center shadow-panel-flat hover:-translate-y-0.5 transition-all">
            <p className="text-3xl font-bold text-feedback-error">{totalWrong}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">累积难点</p>
          </div>
          <div className="bg-white p-6 rounded-master border border-workspace-border text-center shadow-panel-flat hover:-translate-y-0.5 transition-all">
            <p className="text-3xl font-bold text-feedback-warning">{unmasteredCount}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">未掌握脆弱项</p>
          </div>
          <div className="bg-white p-6 rounded-master border border-workspace-border text-center shadow-panel-flat hover:-translate-y-0.5 transition-all">
            <p className="text-3xl font-bold text-feedback-success">{masteredCount}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">已消灭弱项</p>
          </div>
          <div className="bg-white p-6 rounded-master border border-workspace-border text-center shadow-panel-flat hover:-translate-y-0.5 transition-all">
            <p className="text-3xl font-bold text-brand-primary">{avgWrongCount}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">均次重复触犯</p>
          </div>
        </div>

        {viewMode === 'stats' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">按语料分类筛选</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                className="p-6 rounded-master bg-white border border-workspace-border hover:border-indigo-300 hover:shadow-panel-flat transition-all text-left flex justify-between items-center group active:scale-[0.98]"
                onClick={() => handleFilterByCategory(null)}
              >
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">全部错题库</h4>
                  <p className="text-sm text-slate-400 mt-1">总计 {totalWrong} 道记录 · {masteredCount} 道已攻克</p>
                </div>
                <span className="text-slate-300 text-2xl group-hover:translate-x-1 transition-transform">→</span>
              </button>

              {stats.map((stat) => (
                <button
                  key={stat.category}
                  className="p-6 rounded-master bg-white border border-workspace-border hover:border-indigo-300 hover:shadow-panel-flat transition-all text-left flex justify-between items-center group active:scale-[0.98]"
                  onClick={() => handleFilterByCategory(stat.category)}
                >
                  <div>
                    <h4 className="font-bold text-slate-800 text-lg">{getCategoryLabel(stat.category)}</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      未掌握 {stat.unmasteredCount} / 累计 {stat.totalCount} 题
                    </p>
                  </div>
                  <span className="text-slate-300 text-2xl group-hover:translate-x-1 transition-transform">→</span>
                </button>
              ))}
            </div>

            {unmasteredCount > 0 && (
              <div className="bg-slate-50 border border-slate-100 rounded-master p-8 text-center space-y-4">
                <h4 className="text-lg font-bold text-slate-800">快捷记忆干预</h4>
                <p className="text-sm text-slate-500 max-w-lg mx-auto">
                  有 {unmasteredCount} 道薄弱环节题尚未攻克，建议进行集中复习或直接归档到您的收藏夹内。
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button
                    onClick={handleFavoriteAndReview}
                    className="px-6 py-3 rounded-2xl bg-brand-primary text-white font-bold text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all"
                  >
                    全部收藏并集中复习
                  </button>
                  <button
                    onClick={handleFavoriteAndOpenFavorites}
                    className="px-6 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-sm active:scale-[0.98] transition-all"
                  >
                    一键收藏并打开收藏夹
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {(viewMode === 'list' || viewMode === 'review') && (
          <div className="space-y-6">
            
            {/* 当前分类标头 */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-400">
                当前分类: <span className="text-brand-primary font-black">{selectedCategory ? getCategoryLabel(selectedCategory) : '全部错题'}</span> ({wrongAnswers.length} 题)
              </span>
            </div>

            {/* AI 弱点攻坚 */}
            {wrongAnswers.filter(w => !w.mastered).length > 0 && (
              <div className="bg-white rounded-master border border-workspace-border shadow-panel-flat p-8 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <span className="text-2xl">🤖</span> AI 智能弱点攻坚中台
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">自动识别您的高危错因、混淆选项并实时输出攻坚方案</p>
                  </div>
                  {!weaknessAnalysis && (
                    <button
                      onClick={handleGenerateAnalysis}
                      disabled={generatingAnalysis}
                      className="px-5 py-3 rounded-2xl bg-brand-primary text-white font-bold text-xs flex items-center gap-2 disabled:opacity-50 hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-md shadow-indigo-500/10"
                    >
                      {generatingAnalysis ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          深度提取与收敛解析中...
                        </>
                      ) : (
                        '让 AI 生成薄弱项反思口诀与定制演练'
                      )}
                    </button>
                  )}
                </div>

                {weaknessAnalysis && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                    <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100/50 space-y-3">
                      <h5 className="font-bold text-indigo-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <span>🔍</span> 易混淆核心概念辨析
                      </h5>
                      <div className="text-xs text-slate-600 leading-relaxed space-y-1.5">
                        {weaknessAnalysis.analysis.split('\n').map((line, i) => (
                          <p key={i} className="min-h-[1em]">{line}</p>
                        ))}
                      </div>
                    </div>

                    <div className="bg-emerald-50/40 p-6 rounded-[24px] border border-emerald-100/50 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <h5 className="font-bold text-emerald-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                          <span>🎵</span> 记忆辅助口诀
                        </h5>
                        <div className="text-xs text-emerald-800 leading-relaxed italic font-medium space-y-1.5">
                          {weaknessAnalysis.mnemonic.split('\n').map((line, i) => (
                            <p key={i} className="min-h-[1em]">{line}</p>
                          ))}
                        </div>
                      </div>
                      
                      {weaknessAnalysis.customQuestions.length > 0 && (
                        <button
                          onClick={() => {
                            sessionStorage.setItem('importedQuiz', JSON.stringify(weaknessAnalysis.customQuestions));
                            sessionStorage.setItem('currentArchiveId', 'temp');
                            sessionStorage.setItem('currentCategory', 'AI弱点攻坚练习');
                            navigate('/quiz-practice');
                          }}
                          className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow hover:bg-emerald-700 active:scale-[0.98] transition-all"
                        >
                          立即挑战 AI 智能专项攻坚题 ({weaknessAnalysis.customQuestions.length} 题)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 错题条目列表 */}
            <div className="space-y-6">
              {wrongAnswers.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  当前分类下没有发现任何错题条目。
                </div>
              ) : (
                wrongAnswers.map((item) => {
                  const isExpanded = expandedId === item.id;
                  
                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-master border transition-all ${
                        item.mastered
                          ? 'border-emerald-500 bg-emerald-50/10'
                          : 'border-workspace-border hover:border-slate-300 shadow-panel-flat'
                      }`}
                    >
                      {/* 卡片头部标题区 */}
                      <div
                        className="p-6 cursor-pointer select-none flex justify-between items-center gap-4"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h4 className="text-lg font-bold text-slate-900 tracking-tight">
                              {item.question.question}
                            </h4>
                            {item.wrongCount >= 3 && (
                              <span className="px-2 py-0.5 bg-rose-50 text-feedback-error text-[10px] font-black rounded border border-rose-100">
                                易错难攻 ● 累计错误 {item.wrongCount} 次
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-semibold tracking-wider">
                            语料源: {getCategoryLabel(item.category)} &nbsp;•&nbsp; 录入时间: {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {item.mastered && (
                            <span className="px-2.5 py-1 bg-emerald-100 text-feedback-success text-xs font-bold rounded-lg border border-emerald-200">已掌握</span>
                          )}
                          <span className={`text-slate-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            ▼
                          </span>
                        </div>
                      </div>

                      {/* 展开详细对比 */}
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-2 border-t border-slate-100 space-y-6 page-fade-in">
                          {/* 历史错误对比与选择矩阵 */}
                          <div className="space-y-3">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">答题全景对比评估：</p>
                            
                            {item.question.options.map((option, idx) => {
                              const isCorrect = option === item.question.correctAnswer;
                              const isUserWrong = option === item.userAnswer;
                              
                              let optionStyle = 'border-slate-200 bg-slate-50/50 text-slate-700';
                              
                              if (isCorrect) {
                                optionStyle = 'border-emerald-500 bg-emerald-50/40 text-emerald-900 font-bold';
                              } else if (isUserWrong) {
                                optionStyle = 'border-rose-300 bg-rose-50/50 text-rose-800 line-through text-feedback-error';
                              }

                              return (
                                <div
                                  key={idx}
                                  className={`px-4 py-3 rounded-2xl border text-sm flex justify-between items-center ${optionStyle}`}
                                >
                                  <span>{getOptionLabel(idx)}. {option}</span>
                                  {isCorrect && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">预期正确答案</span>}
                                  {isUserWrong && !isCorrect && <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded">历史所选错项</span>}
                                </div>
                              );
                            })}
                          </div>

                          {/* 深度解析 */}
                          {item.question.explanation && (
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">学术认知全解解析:</span>
                              <p className="text-sm text-slate-600 leading-relaxed">
                                {item.question.explanation}
                              </p>
                            </div>
                          )}

                          {/* 学术反思笔记区 */}
                          <div className="space-y-3 pt-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">个人反思笔记</span>
                            {editingNotesId === item.id ? (
                              <div className="space-y-2">
                                <textarea
                                  value={notesText}
                                  onChange={(event) => setNotesText(event.target.value)}
                                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-brand-primary focus:bg-white transition-all"
                                  placeholder="键入您的薄弱点分析或记忆联想..."
                                  rows={3}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSaveNotes(item.id)}
                                    className="px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold active:scale-[0.98] transition-all"
                                  >
                                    保存笔记
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingNotesId(null);
                                      setNotesText('');
                                    }}
                                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold active:scale-[0.98] transition-all"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <p className="text-sm text-slate-600 italic">
                                  {notesMap.get(item.id) || '尚未记录反思反省笔记...'}
                                </p>
                                <button
                                  onClick={() => {
                                    setEditingNotesId(item.id);
                                    setNotesText(notesMap.get(item.id) || '');
                                  }}
                                  className="text-xs font-bold text-brand-primary hover:underline whitespace-nowrap"
                                >
                                  {notesMap.get(item.id) ? '编辑反思' : '添加反思'}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 动作区 */}
                          <div className="flex gap-2.5 pt-4 border-t border-slate-100 flex-wrap">
                            <button
                              onClick={() => handleToggleMastered(item)}
                              className={`px-4 py-2 rounded-xl text-xs font-bold active:scale-[0.98] transition-all ${
                                item.mastered
                                  ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  : 'bg-emerald-50 text-feedback-success border border-emerald-100 hover:bg-emerald-100'
                              }`}
                            >
                              {item.mastered ? '重新丢回记忆库' : '脱生转熟，归还SM2'}
                            </button>
                            <button
                              onClick={() => handleAddToFavorites([item])}
                              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold active:scale-[0.98] transition-all"
                            >
                              移入收藏夹
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="px-4 py-2 rounded-xl bg-rose-50 text-feedback-error border border-rose-100 hover:bg-rose-100 text-xs font-bold active:scale-[0.98] transition-all"
                            >
                              彻底销毁
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
