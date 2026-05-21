/**
 * 集中复习大厅 - ReviewPage.tsx
 * 像素级对齐原型 `id="page-review"` 的混合复习大厅与双态调度引擎
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/layout';
import { useToast } from '../components/ui';
import { RecitationRepository } from '../infrastructure/repositories/RecitationRepository';
import { trackEvent } from '../services/statistics/eventTracker';
import { getDueCards, updateCardProgress } from '../services/sm2/scheduler';
import {
  getAllReviewCards,
  getAllWrongAnswers,
  getAllFillBlankWrongAnswers,
  saveReviewCard,
} from '../services/storage/indexedDB';
import type { ReviewCard } from '../types';

type FSMState =
  | 'IDLE'
  | 'LOADING_MATERIAL'
  | 'QUESTION_ACTIVE'
  | 'EVALUATING'
  | 'EXPLANATION_ACTIVE'
  | 'SESSION_SUMMARY';

// 混合排队记忆单元类型
interface UnifiedReviewItem {
  id: string;
  sourceType: 'card' | 'quiz_wrong' | 'blank_wrong';
  type: 'quiz' | 'spell' | 'fill-blank';
  title: string;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  originalData: any;
}

export default function ReviewPage() {
  const toast = useToast();

  // 1. 复习排队队列与状态机控制
  const [fsmState, setFsmState] = useState<FSMState>('IDLE');
  const [queue, setQueue] = useState<UnifiedReviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // 答题过程状态
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [spellInput, setSpellInput] = useState('');
  const [isSpellCorrect, setIsSpellCorrect] = useState<boolean | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  // 语音播放状态波形
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // 统计概览
  const [cardStats, setCardStats] = useState({
    dueCards: 0,
    quizWrongs: 0,
    blankWrongs: 0,
  });

  // 2. 加载全场景待复习条目进行混合编排
  const loadReviewQueue = useCallback(async (startSessionDirectly = false) => {
    setLoading(true);
    setFsmState('LOADING_MATERIAL');
    try {
      const [cards, quizWrongs, blankWrongs] = await Promise.all([
        getAllReviewCards(),
        getAllWrongAnswers(),
        getAllFillBlankWrongAnswers(),
      ]);

      // 提取未掌握的错题
      const activeQuizWrongs = quizWrongs.filter((x) => !x.mastered);
      const activeBlankWrongs = blankWrongs.filter((x) => !x.mastered);
      const dueCards = getDueCards(cards);

      setCardStats({
        dueCards: dueCards.length,
        quizWrongs: activeQuizWrongs.length,
        blankWrongs: activeBlankWrongs.length,
      });

      // 混合编排，构建统一复习项
      const unifiedQueue: UnifiedReviewItem[] = [];

      // A. 加入今日 SM2 超期卡片
      dueCards.forEach((c) => {
        if (c.cardType === 'quiz' && c.cardData.type === 'quiz') {
          unifiedQueue.push({
            id: c.id,
            sourceType: 'card',
            type: 'quiz',
            title: 'SM2 复习卡片 - 选择题',
            question: c.cardData.question.question,
            options: c.cardData.question.options,
            correctAnswer: c.cardData.question.correctAnswer,
            explanation: c.cardData.question.explanation,
            originalData: c,
          });
        } else if (c.cardType === 'fill-blank' && c.cardData.type === 'fill-blank') {
          unifiedQueue.push({
            id: c.id,
            sourceType: 'card',
            type: 'fill-blank',
            title: 'SM2 复习卡片 - 长文本填空',
            question: c.cardData.text,
            correctAnswer: c.cardData.blanks.map((b) => b.answer).join(', '),
            explanation: `学术挖空原文复写强化，挖空包含：${c.cardData.blanks.map((b) => b.answer).join(' / ')}`,
            originalData: c,
          });
        }
      });

      // B. 加入未掌握的选择题错题
      activeQuizWrongs.forEach((w) => {
        unifiedQueue.push({
          id: w.id,
          sourceType: 'quiz_wrong',
          type: w.question.options && w.question.options.length > 0 ? 'quiz' : 'spell',
          title: '错题本归档 - 强化攻坚',
          question: w.question.question,
          options: w.question.options,
          correctAnswer: w.question.correctAnswer,
          explanation: w.question.explanation,
          originalData: w,
        });
      });

      // C. 加入未掌握的填空题错题
      activeBlankWrongs.forEach((w) => {
        unifiedQueue.push({
          id: w.id,
          sourceType: 'blank_wrong',
          type: 'spell',
          title: '填空弱项 - 拼写纠错',
          question: `请正确拼写在以下上下文中挖空的单词：\n"${w.fillBlankItem.question}"`,
          correctAnswer: w.correctAnswer,
          explanation: `在填空材料中答错。系统预期正确答案为：${w.correctAnswer}`,
          originalData: w,
        });
      });

      // 打乱混合队列，保障突变间隔合理分布
      setQueue(unifiedQueue.sort(() => Math.random() - 0.5));
      setCurrentIndex(0);
      setCompletedCount(0);
      setWrongCount(0);

      if (startSessionDirectly && unifiedQueue.length > 0) {
        setFsmState('QUESTION_ACTIVE');
        trackEvent('review_session_start', { totalItems: unifiedQueue.length });
      } else {
        setFsmState('IDLE');
      }
    } catch (error) {
      console.error('混合复习队列加载失败:', error);
      toast.error('加载排队队列失败，请稍后刷新重试');
      setFsmState('IDLE');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadReviewQueue();
  }, [loadReviewQueue]);

  // 当前复习项目
  const currentItem = useMemo(() => {
    if (queue.length === 0 || currentIndex >= queue.length) return null;
    return queue[currentIndex];
  }, [queue, currentIndex]);

  // 同音发声
  const playPronunciation = () => {
    if (!currentItem) return;
    setIsPlayingAudio(true);
    const textToSpeak = currentItem.type === 'spell' ? currentItem.correctAnswer : currentItem.question;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'en-US';
    utterance.onend = () => setIsPlayingAudio(false);
    synth.speak(utterance);
  };

  // 处理选择题判定
  const handleSelectOption = (index: number) => {
    if (fsmState !== 'QUESTION_ACTIVE' || !currentItem) return;

    setSelectedOption(index);
    setFsmState('EVALUATING');

    const selectedText = currentItem.options?.[index] || '';
    const isCorrect = selectedText === currentItem.correctAnswer;

    setTimeout(() => {
      setFsmState('EXPLANATION_ACTIVE');
      if (isCorrect) {
        toast.success('契约验证正确！遗忘收敛率提升');
      } else {
        setWrongCount((v) => v + 1);
        toast.error('判定偏离预期！已标记遗忘状态');
        void handleAnswerFailure(currentItem);
      }
    }, 400);
  };

  // 处理拼写题验证
  const handleSpellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fsmState !== 'QUESTION_ACTIVE' || !currentItem) return;

    setFsmState('EVALUATING');
    const inputClean = spellInput.trim().toLowerCase();
    const correctClean = currentItem.correctAnswer.trim().toLowerCase();
    const isCorrect = inputClean === correctClean;

    setTimeout(() => {
      setIsSpellCorrect(isCorrect);
      setFsmState('EXPLANATION_ACTIVE');
      if (isCorrect) {
        toast.success('拼写对齐成功！');
      } else {
        setWrongCount((v) => v + 1);
        toast.error('拼写校对不匹配，已重新锁定');
        void handleAnswerFailure(currentItem);
      }
    }, 300);
  };

  // 处理复习判定失败的突变操作
  const handleAnswerFailure = async (item: UnifiedReviewItem) => {
    if (item.sourceType === 'card') {
      // 错答 SM2 卡片：降低质量评级并更新下次复习时间
      const card = item.originalData as ReviewCard;
      const updated = updateCardProgress(card, {
        cardId: card.id,
        quality: 1, // 错误评分
        responseTime: 1000,
        timestamp: new Date(),
      });
      await saveReviewCard(updated);
    }
    // 错题本项已经存在，保持未掌握状态
  };

  // 处理复习判定成功的突变（脱生转熟 / 彻底消化）
  const handleAnswerSuccess = async (item: UnifiedReviewItem) => {
    if (item.sourceType === 'card') {
      // 答对 SM2 卡片：提高评级并更新下次复习时间
      const card = item.originalData as ReviewCard;
      const updated = updateCardProgress(card, {
        cardId: card.id,
        quality: 5, // 完美回答
        responseTime: 1000,
        timestamp: new Date(),
      });
      await saveReviewCard(updated);
    } else if (item.sourceType === 'quiz_wrong') {
      // 标记错题为已掌握
      await RecitationRepository.markWrongAnswerMastered(item.id, true, 'quiz');
    } else if (item.sourceType === 'blank_wrong') {
      // 标记填空错题为已掌握
      await RecitationRepository.markWrongAnswerMastered(item.id, true, 'fillblank');
    }
  };

  // 熟知，走向下一个卡片单元
  const handleNextReview = async () => {
    if (!currentItem) return;

    setFsmState('LOADING_MATERIAL');

    // 如果在该题没有触发错误，说明用户完美答对，标记该条目已掌握/更新 SM2
    const wasCorrect = currentItem.type === 'quiz' 
      ? (selectedOption !== null && currentItem.options?.[selectedOption] === currentItem.correctAnswer)
      : (spellInput.trim().toLowerCase() === currentItem.correctAnswer.trim().toLowerCase());

    if (wasCorrect) {
      await handleAnswerSuccess(currentItem);
    }

    setCompletedCount((v) => v + 1);
    setSelectedOption(null);
    setSpellInput('');
    setIsSpellCorrect(null);

    if (currentIndex >= queue.length - 1) {
      setFsmState('SESSION_SUMMARY');
      trackEvent('review_session_complete', {
        completed: completedCount + 1,
        total: queue.length,
        wrong: wrongCount,
      });
    } else {
      setCurrentIndex((prev) => prev + 1);
      setFsmState('QUESTION_ACTIVE');
    }
  };

  // 手动归还/脱生转熟
  const handleForceMastered = async () => {
    if (!currentItem) return;
    await handleAnswerSuccess(currentItem);
    toast.success('已强行脱生转熟！本条目已从高危超期排队中移出');
    void handleNextReview();
  };

  // 1:1 还原骨架屏占位组件
  if (loading || fsmState === 'LOADING_MATERIAL') {
    return (
      <AppLayout title="集中复习大厅">
        <div className="p-8 md:p-12 max-w-5xl mx-auto space-y-8 page-fade-in">
          <header className="border-b border-workspace-border pb-6 flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-6 bg-slate-200 rounded w-48 animate-pulse"></div>
              <div className="h-4 bg-slate-100 rounded w-80 animate-pulse"></div>
            </div>
            <div className="h-8 bg-amber-50 rounded-xl w-36 animate-pulse"></div>
          </header>
          {/* 大厂级骨架屏 */}
          <div className="bg-white rounded-[48px] p-10 md:p-16 border border-workspace-border shadow-panel-flat space-y-8 animate-pulse">
            <div className="h-6 bg-slate-100 rounded-md w-1/4"></div>
            <div className="h-24 bg-slate-50 rounded-2xl w-full"></div>
            <div className="space-y-4">
              <div className="h-14 bg-slate-50 rounded-2xl w-full"></div>
              <div className="h-14 bg-slate-50 rounded-2xl w-full"></div>
            </div>
            <div className="pt-4 flex justify-between">
              <div className="h-8 bg-slate-100 rounded-md w-24"></div>
              <div className="h-14 bg-slate-900 rounded-2xl w-40"></div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // 页面空状态 / 就绪控制大厅首屏
  if (fsmState === 'IDLE') {
    const totalDue = cardStats.dueCards + cardStats.quizWrongs + cardStats.blankWrongs;

    return (
      <AppLayout title="集中复习大厅">
        <div className="p-8 md:p-12 max-w-5xl mx-auto space-y-10 page-fade-in">
          <header className="border-b border-workspace-border pb-6 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">集中复习大厅</h2>
              <p className="text-sm text-slate-500 mt-1">混合调度今日已过期的全场景（Quiz / 拼写 / 填空）高危记忆单元</p>
            </div>
            <div
              className={`text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1.5 border ${
                totalDue > 0
                  ? 'bg-amber-50 text-feedback-warning border-amber-200/60'
                  : 'bg-emerald-50 text-feedback-success border-emerald-200/60'
              }`}
            >
              <span>⏰ 今日超期排队总计: {totalDue} 个</span>
            </div>
          </header>

          {/* 三维卡片矩阵 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-master p-6 border border-workspace-border shadow-panel-flat space-y-4 hover:-translate-y-0.5 transition-all">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-brand-primary flex items-center justify-center text-xl font-bold">📂</div>
              <div>
                <h4 className="text-2xl font-bold text-slate-900">{cardStats.dueCards} <span className="text-xs text-slate-400 font-normal">个</span></h4>
                <p className="text-xs text-slate-500 mt-1">今日过期记忆卡片 (SM2 因子调度)</p>
              </div>
            </div>
            <div className="bg-white rounded-master p-6 border border-workspace-border shadow-panel-flat space-y-4 hover:-translate-y-0.5 transition-all">
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-feedback-error flex items-center justify-center text-xl font-bold">📕</div>
              <div>
                <h4 className="text-2xl font-bold text-slate-900">{cardStats.quizWrongs} <span className="text-xs text-slate-400 font-normal">个</span></h4>
                <p className="text-xs text-slate-500 mt-1">未掌握的选择错题</p>
              </div>
            </div>
            <div className="bg-white rounded-master p-6 border border-workspace-border shadow-panel-flat space-y-4 hover:-translate-y-0.5 transition-all">
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-feedback-warning flex items-center justify-center text-xl font-bold">🧩</div>
              <div>
                <h4 className="text-2xl font-bold text-slate-900">{cardStats.blankWrongs} <span className="text-xs text-slate-400 font-normal">个</span></h4>
                <p className="text-xs text-slate-500 mt-1">未掌握的填空拼写错题</p>
              </div>
            </div>
          </div>

          {/* 行动卡片 */}
          <div className="bg-gradient-to-br from-indigo-950 to-brand-dark rounded-master p-10 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="absolute -right-10 -top-10 h-40 w-40 bg-indigo-500/20 rounded-full blur-3xl"></div>
            <div className="space-y-4 relative z-10 max-w-xl">
              <span className="px-3 py-1 bg-brand-primary rounded-full text-[10px] font-bold text-white uppercase tracking-wider">SM2 算法自适应混合编排</span>
              <h2 className="text-3xl font-bold tracking-tight">准备好启动今日超期强化记忆了吗？</h2>
              <p className="text-indigo-200 text-sm leading-relaxed">系统将为你拉取包含今日超期的卡片，以及之前在各环节积压、答错的脆弱高危项。打乱混合排队，彻底击碎遗忘临界区。</p>
            </div>
            {totalDue > 0 ? (
              <button
                onClick={() => void loadReviewQueue(true)}
                className="px-8 py-5 rounded-[24px] bg-white text-slate-900 font-bold text-base shadow-2xl hover:scale-105 active:scale-95 transition-all w-full md:w-auto relative z-10"
              >
                启动全场景混合强化复习
              </button>
            ) : (
              <div className="px-8 py-5 rounded-[24px] bg-indigo-900/30 text-indigo-300 font-bold text-sm text-center border border-indigo-500/20 w-full md:w-auto">
                🎉 今日没有任何记忆积压！
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  // 会话总结报告
  if (fsmState === 'SESSION_SUMMARY') {
    return (
      <AppLayout title="复习报告">
        <div className="p-8 md:p-12 max-w-3xl mx-auto text-center space-y-8 page-fade-in">
          <div className="text-6xl">🏆</div>
          <div className="space-y-3">
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">今日集中复习达成</h2>
            <p className="text-slate-500 text-sm">完成了混合复习队列，已有效干预海马体遗忘因子</p>
          </div>

          <div className="grid grid-cols-3 gap-6 max-w-md mx-auto">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <span className="block text-2xl font-bold text-slate-800">{queue.length}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mt-1">总复习项</span>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
              <span className="block text-2xl font-bold text-feedback-success">{queue.length - wrongCount}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mt-1">完美对齐</span>
            </div>
            <div className="bg-rose-50 rounded-2xl p-5 border border-rose-100">
              <span className="block text-2xl font-bold text-feedback-error">{wrongCount}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mt-1">发生偏离</span>
            </div>
          </div>

          <div className="pt-6 flex justify-center gap-4">
            <button
              onClick={() => void loadReviewQueue()}
              className="px-6 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-sm font-bold active:scale-95 transition-all"
            >
              返回大厅
            </button>
            <Link
              to="/"
              className="px-8 py-3 rounded-2xl bg-brand-primary text-white text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all"
            >
              返回主页
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  // 复习工作台视图
  return (
    <AppLayout title="复习工作台">
      <div className="p-8 md:p-12 max-w-4xl mx-auto space-y-6 page-fade-in">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-indigo-50 text-brand-primary text-[10px] font-black rounded-lg border border-indigo-100">
              {currentItem?.title}
            </span>
            <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">
              • 混合排队进度: {currentIndex + 1} / {queue.length}
            </span>
          </div>
          <button
            onClick={() => setFsmState('IDLE')}
            className="text-xs font-bold text-slate-400 hover:text-slate-800 transition-colors"
          >
            退出本轮
          </button>
        </div>

        {/* 终极 Master Card */}
        {currentItem && (
          <div className="w-full space-y-6">
            <div className="bg-white rounded-[48px] p-12 md:p-16 border border-workspace-border shadow-master-card relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-600 to-purple-600"></div>

              {/* 卡片头部信息 */}
              <div className="flex justify-between items-center mb-8 text-xs font-medium text-slate-400">
                <span>类别: {currentItem.sourceType === 'card' ? 'SM2 调度单元' : '错题纠偏'}</span>
                {wrongCount > 0 && <span className="text-feedback-error font-semibold">⚠️ 本轮已触发过 {wrongCount} 次错答</span>}
              </div>

              {/* 答题核心区：根据类型选择渲染选择题或拼写题 */}
              {currentItem.type === 'quiz' ? (
                // 1. 选择题视图
                <div className="space-y-8">
                  <div className="text-center space-y-4 mb-10">
                    <h3 className="text-3xl font-bold text-slate-800 tracking-tight leading-snug">
                      {currentItem.question}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {currentItem.options?.map((option, idx) => {
                      const isSelected = selectedOption === idx;
                      const isCorrect = option === currentItem.correctAnswer;
                      const hasEvaluated = fsmState === 'EXPLANATION_ACTIVE' || fsmState === 'EVALUATING';

                      let btnStyle = 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer';
                      let badge = null;

                      if (isSelected && hasEvaluated) {
                        if (isCorrect) {
                          btnStyle = 'border-2 border-emerald-500 bg-emerald-50/40';
                          badge = <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">✨ 判定正确</span>;
                        } else {
                          btnStyle = 'border-2 border-rose-500 bg-rose-50/40';
                          badge = <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded">❌ 判定偏离</span>;
                        }
                      } else if (hasEvaluated && isCorrect) {
                        // 揭晓正确答案
                        btnStyle = 'border-2 border-emerald-500 bg-emerald-50/20';
                      }

                      return (
                        <div
                          key={idx}
                          onClick={() => handleSelectOption(idx)}
                          className={`flex items-center justify-between p-5 rounded-3xl border transition-all active:scale-[0.98] ${btnStyle}`}
                        >
                          <div className="flex items-center gap-4">
                            <span
                              className={`h-8 w-8 flex items-center justify-center rounded-xl text-sm font-bold ${
                                isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="text-base font-semibold text-slate-700">{option}</span>
                          </div>
                          {badge}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // 2. 单词拼写 / 填空复写视图
                <div className="space-y-8">
                  <div className="text-center space-y-6 mb-10">
                    <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black rounded-lg uppercase tracking-wider border border-amber-200/60">
                      主观拼写自适应检验
                    </span>
                    <h3 className="text-2xl font-bold text-slate-800 tracking-tight leading-relaxed">
                      {currentItem.question}
                    </h3>

                    <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        onClick={playPronunciation}
                        className="h-11 px-5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 font-semibold text-xs text-slate-600 flex items-center gap-2 transition-all active:scale-95 group"
                      >
                        <span className="group-hover:scale-110 transition-transform">🔊</span> 语音发音与朗读
                      </button>
                      {isPlayingAudio && (
                        <div className="flex items-center gap-0.5 h-3">
                          <span className="w-0.5 h-3 bg-indigo-500 rounded-full animate-pulse"></span>
                          <span className="w-0.5 h-4 bg-indigo-500 rounded-full animate-pulse"></span>
                          <span className="w-0.5 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleSpellSubmit} className="max-w-md mx-auto space-y-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="键入对应的英文单词或填空缺口..."
                        value={spellInput}
                        onChange={(e) => setSpellInput(e.target.value)}
                        disabled={fsmState === 'EXPLANATION_ACTIVE' || fsmState === 'EVALUATING'}
                        className={`w-full h-14 px-6 rounded-2xl border-2 text-lg font-bold tracking-wide text-center focus:outline-none focus:border-brand-primary focus:bg-white transition-all ${
                          isSpellCorrect === true
                            ? 'border-emerald-500 bg-emerald-50/20 text-emerald-900'
                            : isSpellCorrect === false
                            ? 'border-rose-500 bg-rose-50/20 text-rose-900'
                            : 'border-slate-200 bg-slate-50/50 text-slate-800'
                        }`}
                        autoFocus
                      />
                      {fsmState === 'QUESTION_ACTIVE' && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded">
                          Enter 验证
                        </span>
                      )}
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* 学术深度全解面板 */}
            {fsmState === 'EXPLANATION_ACTIVE' && (
              <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 space-y-4 page-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-brand-primary text-[11px] font-black tracking-widest uppercase">
                    <span>💡 深度释义与学术链认知</span>
                  </div>
                  {/* 可在此一键强制标记为已掌握（脱生转熟） */}
                  {(currentItem.sourceType === 'quiz_wrong' || currentItem.sourceType === 'blank_wrong') && (
                    <button
                      onClick={handleForceMastered}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-100/60 text-feedback-success border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition-colors active:scale-95"
                    >
                      脱生转熟，彻底消化 ✓
                    </button>
                  )}
                </div>
                <p className="text-base text-slate-700 leading-relaxed font-medium">
                  {currentItem.explanation}
                </p>
                <div className="text-xs text-slate-400 italic">
                  正确答案为：<span className="text-feedback-success font-bold">{currentItem.correctAnswer}</span>
                </div>
              </div>
            )}

            {/* 底部操作面板 */}
            <div className="flex items-center justify-between gap-6 px-4">
              <button
                onClick={playPronunciation}
                className="text-xs font-black text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest"
              >
                语音重放🔊
              </button>
              {fsmState === 'EXPLANATION_ACTIVE' && (
                <button
                  onClick={handleNextReview}
                  className="bg-slate-900 px-10 py-5 rounded-[24px] text-white font-bold text-lg shadow-2xl hover:bg-slate-800 active:scale-95 transition-all page-fade-in"
                >
                  熟知，下一个
                  →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
