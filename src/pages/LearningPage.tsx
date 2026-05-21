/**
 * 核心演练工作台 - LearningPage.tsx
 * 像素级对齐原型 `id="page-learning"` 的终极全场景交互工作台
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useContentStore } from '../stores/useContentStore';
import { AppLayout } from '../components/layout';
import { useToast } from '../components/ui';
import { RecitationRepository } from '../infrastructure/repositories/RecitationRepository';
import { trackEvent } from '../services/statistics/eventTracker';
import type { ParsedContent } from '../types';

type WorkbenchMode = 'syno' | 'spell' | 'blank-choice' | 'blank-spell';

// FSM 状态类型定义
type FSMState =
  | 'IDLE'
  | 'LOADING_MATERIAL'
  | 'QUESTION_ACTIVE'
  | 'EVALUATING'
  | 'EXPLANATION_ACTIVE'
  | 'SESSION_SUMMARY';

export default function LearningPage() {
  const { contentId } = useParams<{ contentId?: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { contents } = useContentStore();

  // 1. 选择要学习的材料
  const [selectedContent, setSelectedContent] = useState<ParsedContent | null>(null);
  const [loading, setLoading] = useState(true);

  // 2. 练习状态与 FSM 状态机控制
  const [workbenchMode, setWorkbenchMode] = useState<WorkbenchMode>('syno');
  const [fsmState, setFsmState] = useState<FSMState>('IDLE');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // 答题过程状态
  const [selectedSynoOption, setSelectedSynoOption] = useState<number | null>(null);
  const [spellInput, setSpellInput] = useState('');
  const [isSpellCorrect, setIsSpellCorrect] = useState<boolean | null>(null);
  
  // 填空选择状态
  const [blankChoicePopoverOpen, setBlankChoicePopoverOpen] = useState(false);
  const [selectedBlankChoice, setSelectedBlankChoice] = useState<string | null>(null);
  const [isBlankChoiceCorrect, setIsBlankChoiceCorrect] = useState<boolean | null>(null);
  
  // 逐字盲打状态
  const [blankSpellInputs, setBlankSpellInputs] = useState<string[]>([]);
  const [blankSpellErrorChar, setBlankSpellErrorChar] = useState<{ index: number; char: string } | null>(null);
  const [isBlankSpellCompleted, setIsBlankSpellCompleted] = useState(false);
  
  const [wrongCount, setWrongCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  // 音频播放状态波形
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // 统计与历史错题记录
  const [quizWrongCount, setQuizWrongCount] = useState(0);
  const [fillBlankWrongCount, setFillBlankWrongCount] = useState(0);

  // 自动聚焦引用
  const spellInputRef = useRef<HTMLInputElement>(null);

  // 加载页面数据和错题数
  useEffect(() => {
    import('../services/storage/indexedDB').then((db) => {
      db.getAllWrongAnswers().then((l) => setQuizWrongCount(l.filter((x) => !x.mastered).length));
      db.getAllFillBlankWrongAnswers().then((l) => setFillBlankWrongCount(l.filter((x) => !x.mastered).length));
    });
  }, []);

  // 匹配/加载材料
  useEffect(() => {
    async function loadContent() {
      setLoading(true);
      try {
        if (contentId) {
          let content = contents.find((c) => c.id === contentId);
          if (!content) {
            const { getContentById } = await import('../services/storage/indexedDB');
            content = (await getContentById(contentId)) || undefined;
          }
          if (content) {
            setSelectedContent(content);
            setFsmState('QUESTION_ACTIVE');
            setCurrentIndex(0);
          }
        }
      } catch (error) {
        console.error('加载材料失败:', error);
      } finally {
        setLoading(false);
      }
    }
    loadContent();
  }, [contentId, contents]);

  // 当前练习的关键词
  const currentKeyword = useMemo(() => {
    if (!selectedContent || selectedContent.keywords.length === 0) return null;
    return selectedContent.keywords[currentIndex % selectedContent.keywords.length];
  }, [selectedContent, currentIndex]);

  // 下一题/流转状态
  const handleNextQuestion = useCallback(() => {
    if (!selectedContent) return;
    
    // 标记完成
    setCompletedCount((prev) => prev + 1);

    // 重置状态
    setSelectedSynoOption(null);
    setSpellInput('');
    setIsSpellCorrect(null);
    setBlankChoicePopoverOpen(false);
    setSelectedBlankChoice(null);
    setIsBlankChoiceCorrect(null);
    setBlankSpellErrorChar(null);

    if (currentKeyword) {
      setBlankSpellInputs(new Array(currentKeyword.term.length).fill(''));
    }

    if (currentIndex >= selectedContent.keywords.length - 1) {
      setFsmState('SESSION_SUMMARY');
      // 触发打卡突变
      void RecitationRepository.saveProgress({
        mode: workbenchMode,
        currentIndex: currentIndex + 1,
        totalItems: selectedContent.keywords.length,
        completedCount: completedCount + 1,
        type: 'synomaster'
      });
      trackEvent('learning_session_complete', { mode: workbenchMode, contentId: selectedContent.id });
    } else {
      setCurrentIndex((prev) => prev + 1);
      setFsmState('QUESTION_ACTIVE');
    }
  }, [selectedContent, currentIndex, completedCount, workbenchMode, currentKeyword]);

  // 1. 同义词组选择候选集动态构建
  const synoOptions = useMemo(() => {
    if (!selectedContent || !currentKeyword) return [];
    
    const correct = currentKeyword.term;
    const correctDefinition = currentKeyword.definition;
    
    // 从其他关键词中挑选 3 个干扰项
    const distractors = selectedContent.keywords
      .filter((k) => k.term !== correct)
      .slice(0, 3)
      .map((k) => ({
        term: k.term,
        definition: k.definition
      }));

    // 补足干扰项
    while (distractors.length < 3) {
      distractors.push({
        term: 'alleviate',
        definition: 'v. 减轻，缓和'
      });
    }

    const options = [
      { term: correct + ' / improve / enhance', definition: correctDefinition, isCorrect: true },
      ...distractors.map((d) => ({
        term: d.term + ' / aggravate / deteriorate',
        definition: d.definition,
        isCorrect: false
      }))
    ];

    // 随机乱序打乱，保证 correct 随机分布
    return options.sort(() => Math.random() - 0.5);
  }, [selectedContent, currentKeyword]);

  // 同义词选择事件
  const handleSelectSyno = (index: number, isCorrectOption: boolean) => {
    if (fsmState !== 'QUESTION_ACTIVE') return;
    
    setSelectedSynoOption(index);
    setFsmState('EVALUATING');

    setTimeout(() => {
      setFsmState('EXPLANATION_ACTIVE');
      if (isCorrectOption) {
        toast.success('解答正确！海马体遗忘因子收敛中');
      } else {
        setWrongCount((v) => v + 1);
        toast.error('判定错误，已拦截并自动归档错题本');
        // 保存错题突变
        if (currentKeyword && selectedContent) {
          void RecitationRepository.saveWrongAnswer({
            id: `wrong-${Date.now()}`,
            questionId: currentKeyword.term,
            archiveId: selectedContent.id,
            question: {
              id: currentKeyword.term,
              question: `请写出与 "${currentKeyword.definition}" 对应的英文核心词汇`,
              options: [],
              correctAnswer: currentKeyword.term,
              explanation: `学术辨析：${currentKeyword.term} 表示 ${currentKeyword.definition}。`,
            },
            userAnswer: synoOptions[index].term,
            wrongCount: 1,
            lastWrongAt: new Date(),
            category: selectedContent.title,
            tags: [],
            mastered: false,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    }, 400);
  };

  // 2. 单词拼写发音 Web Speech Synthesis
  const playPronunciation = () => {
    if (!currentKeyword) return;
    setIsPlayingAudio(true);
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(currentKeyword.term);
    utterance.lang = 'en-US';
    utterance.onend = () => setIsPlayingAudio(false);
    synth.speak(utterance);
  };

  // 拼写检验
  const handleSpellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fsmState !== 'QUESTION_ACTIVE' || !currentKeyword) return;

    const correct = currentKeyword.term.trim().toLowerCase();
    const input = spellInput.trim().toLowerCase();
    const isCorrect = correct === input;

    setFsmState('EVALUATING');
    setTimeout(() => {
      setIsSpellCorrect(isCorrect);
      setFsmState('EXPLANATION_ACTIVE');
      if (isCorrect) {
        toast.success('契约拼写成功！');
      } else {
        setWrongCount((v) => v + 1);
        toast.error('拼写偏离预期！已自动入库错题本');
        if (selectedContent) {
          void RecitationRepository.saveWrongAnswer({
            id: `wrong-${Date.now()}`,
            questionId: currentKeyword.term,
            archiveId: selectedContent.id,
            question: {
              id: currentKeyword.term,
              question: `拼写单词："${currentKeyword.definition}"`,
              options: [],
              correctAnswer: currentKeyword.term,
              explanation: `正确拼写为 ${currentKeyword.term} [${currentKeyword.definition}]`,
            },
            userAnswer: spellInput,
            wrongCount: 1,
            lastWrongAt: new Date(),
            category: selectedContent.title,
            tags: [],
            mastered: false,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    }, 300);
  };

  // 3. 挖空行内学术文本
  const blankSentence = useMemo(() => {
    if (!selectedContent || !currentKeyword) return { leading: '', trailing: '', full: '' };
    
    // 在 chapters 中搜寻包含 term 的句子
    const allText = selectedContent.chapters.map((c) => c.content).join(' ');
    const sentences = allText.split(/[。！？.!?]/);
    const matched = sentences.find((s) => s.toLowerCase().includes(currentKeyword.term.toLowerCase()));

    const term = currentKeyword.term;
    if (matched) {
      const idx = matched.toLowerCase().indexOf(term.toLowerCase());
      return {
        leading: matched.substring(0, idx),
        trailing: matched.substring(idx + term.length),
        full: matched
      };
    }

    // 兜底学术级例句
    return {
      leading: 'The government regulator proposed rigorous frameworks to ',
      trailing: ' the harsh industrial environments inside emerging local manufacturing zones.',
      full: `The government regulator proposed rigorous frameworks to ${term} the harsh industrial environments inside emerging local manufacturing zones.`
    };
  }, [selectedContent, currentKeyword]);

  // 挖空候选集
  const blankChoiceOptions = useMemo(() => {
    if (!selectedContent || !currentKeyword) return [];
    const correct = currentKeyword.term;
    
    const others = selectedContent.keywords
      .filter((k) => k.term !== correct)
      .slice(0, 2)
      .map((k) => k.term);
      
    while (others.length < 2) {
      others.push('aggravate');
    }
    
    return [correct, ...others].sort(() => Math.random() - 0.5);
  }, [selectedContent, currentKeyword]);

  // 挖空选项点击
  const handleSelectBlankChoice = (choice: string) => {
    if (fsmState !== 'QUESTION_ACTIVE' || !currentKeyword) return;
    
    setSelectedBlankChoice(choice);
    setBlankChoicePopoverOpen(false);
    
    const isCorrect = choice.toLowerCase() === currentKeyword.term.toLowerCase();
    setFsmState('EVALUATING');
    
    setTimeout(() => {
      setIsBlankChoiceCorrect(isCorrect);
      setFsmState('EXPLANATION_ACTIVE');
      if (isCorrect) {
        toast.success('上下文匹配成功！');
      } else {
        setWrongCount((v) => v + 1);
        toast.error('选项偏离，建议进行回溯');
      }
    }, 300);
  };

  // 4. 逐字盲打核心算法控制
  useEffect(() => {
    if (currentKeyword) {
      setBlankSpellInputs(new Array(currentKeyword.term.length).fill(''));
      setBlankSpellErrorChar(null);
      setIsBlankSpellCompleted(false);
    }
  }, [currentKeyword]);

  const handleBlankSpellKeyPress = (index: number, val: string) => {
    if (!currentKeyword || fsmState !== 'QUESTION_ACTIVE') return;
    
    const correctWord = currentKeyword.term.toLowerCase();
    const charInput = val.slice(-1).toLowerCase(); // 获取输入的最后一个字符

    if (!charInput) {
      // 退格处理
      const nextInputs = [...blankSpellInputs];
      nextInputs[index] = '';
      setBlankSpellInputs(nextInputs);
      setBlankSpellErrorChar(null);
      return;
    }

    const correctChar = correctWord.charAt(index);
    if (charInput === correctChar) {
      // 字符正确
      const nextInputs = [...blankSpellInputs];
      nextInputs[index] = charInput;
      setBlankSpellInputs(nextInputs);
      setBlankSpellErrorChar(null);

      // 移动到下一个输入框
      const nextEl = document.getElementById(`blank-char-${index + 1}`) as HTMLInputElement;
      if (nextEl) {
        nextEl.removeAttribute('disabled');
        nextEl.focus();
      }

      // 检查是否拼写完全
      if (index === correctWord.length - 1) {
        setIsBlankSpellCompleted(true);
        setFsmState('EVALUATING');
        setTimeout(() => {
          setFsmState('EXPLANATION_ACTIVE');
          toast.success('逐字精准盲打通关！');
        }, 300);
      }
    } else {
      // 输入错误，锁定阻塞状态机并报警
      setBlankSpellErrorChar({ index: index + 1, char: charInput });
      toast.error(`实时纠错：您键入了非预期的 '${charInput}'`);
    }
  };

  // 重置盲打
  const handleResetBlankSpell = () => {
    if (currentKeyword) {
      setBlankSpellInputs(new Array(currentKeyword.term.length).fill(''));
      setBlankSpellErrorChar(null);
      setIsBlankSpellCompleted(false);
      setFsmState('QUESTION_ACTIVE');
      setTimeout(() => {
        const el = document.getElementById('blank-char-0') as HTMLInputElement;
        if (el) el.focus();
      }, 100);
    }
  };

  // 模式药丸切换
  const handleModeSwitch = (mode: WorkbenchMode) => {
    setWorkbenchMode(mode);
    setFsmState('QUESTION_ACTIVE');
    setSelectedSynoOption(null);
    setSpellInput('');
    setIsSpellCorrect(null);
    setBlankChoicePopoverOpen(false);
    setSelectedBlankChoice(null);
    setIsBlankChoiceCorrect(null);
    setBlankSpellErrorChar(null);
    setIsBlankSpellCompleted(false);
    if (currentKeyword) {
      setBlankSpellInputs(new Array(currentKeyword.term.length).fill(''));
    }
    trackEvent('learning_mode_switch', { mode });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-workspace-bg">
        {/* Pulsing Skeleton Placeholder */}
        <div className="w-full max-w-4xl p-8 space-y-6 bg-white rounded-master shadow-panel-flat animate-pulse">
          <div className="h-6 bg-slate-200 rounded-md w-1/4"></div>
          <div className="h-32 bg-slate-100 rounded-3xl w-full"></div>
          <div className="space-y-4">
            <div className="h-12 bg-slate-100 rounded-2xl w-full"></div>
            <div className="h-12 bg-slate-100 rounded-2xl w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // 视图渲染 1: Dashboard (未选择材料时)
  // ----------------------------------------------------
  if (!selectedContent) {
    return (
      <AppLayout title="学习指挥中心" showBack={false}>
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-10 page-fade-in">
          
          {/* Top Panel Banner */}
          <div className="bg-white rounded-master border border-workspace-border p-8 md:p-12 shadow-panel-flat flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-2 text-brand-primary font-bold text-xs uppercase tracking-widest mb-2">
                <span className="h-2.5 w-2.5 rounded-full bg-brand-primary animate-ping"></span>
                Learning Command Dashboard
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900">演练控制大厅</h2>
              <p className="text-slate-500 mt-2 text-sm max-w-lg">
                基于有限状态机（FSM）的全自动切题大脑，混合挖空填词、拼写、同义选择多态训练。
              </p>
            </div>
            
            <Link
              to="/content"
              className="px-6 py-3.5 rounded-2xl bg-brand-primary text-white text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 ease-in-out"
            >
              ➕ 导入学术新语料
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Left: Material List Grid */}
            <div className="md:col-span-8 space-y-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>📚</span> 待攻坚教材语料库
              </h3>

              {contents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {contents.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/learning/${item.id}`)}
                      className="bg-white p-6 rounded-[28px] border border-workspace-border hover:border-indigo-200 hover:-translate-y-0.5 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.98] transition-all duration-300 group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-indigo-50 text-brand-primary rounded-lg border border-indigo-100">
                          解析完毕
                        </span>
                        <span className="text-slate-300 text-xs">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-slate-900 group-hover:text-brand-primary transition-colors text-lg line-clamp-1 mb-2">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {item.chapters.length} 章节 · {item.keywords.length} 实体记忆卡片
                      </p>
                      
                      <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">智能 FSM 模式</span>
                        <span className="text-xs font-black text-brand-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          启动演练 →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => navigate('/content')}
                  className="flex flex-col items-center justify-center p-12 bg-white rounded-master border-2 border-dashed border-slate-200 hover:border-brand-primary hover:bg-indigo-50/5 cursor-pointer transition-all text-center space-y-4"
                >
                  <span className="text-5xl">📥</span>
                  <h4 className="font-bold text-slate-700">导入您的第一份学习材料</h4>
                  <p className="text-xs text-slate-400">AI 将自动执行清洗并划词生成多态背诵实体</p>
                </div>
              )}
            </div>

            {/* Right: Quick Stats & Sidebar */}
            <div className="md:col-span-4 space-y-6">
              <h3 className="text-lg font-bold text-slate-800">🎯 记忆薄弱靶向阻击</h3>

              <div className="bg-slate-900 rounded-master p-8 text-white relative overflow-hidden shadow-lg space-y-6">
                <div className="absolute -right-10 -top-10 h-40 w-40 bg-brand-primary/20 rounded-full blur-3xl"></div>
                
                <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">
                  海马体遗忘因子拦截
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                    <span className="text-xs text-slate-300">待巩固错题</span>
                    <span className="text-xl font-black text-rose-400">{quizWrongCount + fillBlankWrongCount} 题</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                    <span className="text-xs text-slate-300">近 7 日打卡频率</span>
                    <span className="text-xl font-black text-emerald-400">92.4%</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    to="/wrong-answers"
                    className="flex-1 py-3 text-center rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-600/10 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
                  >
                    选择错题 ({quizWrongCount})
                  </Link>
                  <Link
                    to="/wrong-answers"
                    className="flex-1 py-3 text-center rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-lg shadow-amber-600/10 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
                  >
                    填空错题 ({fillBlankWrongCount})
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ----------------------------------------------------
  // 视图渲染 2: 核心 FSM 演练工作台 (已选择材料时)
  // ----------------------------------------------------
  return (
    <AppLayout
      title={selectedContent.title}
      showBack={true}
      onBack={() => {
        setSelectedContent(null);
        setFsmState('IDLE');
      }}
    >
      <div id="page-learning" className="max-w-4xl mx-auto px-4 py-6 space-y-8 page-fade-in">
        
        {/* Top pill capsules capsule switcher */}
        <div className="bg-white border border-workspace-border rounded-master p-2 flex flex-wrap gap-2 shadow-panel-flat">
          <button
            onClick={() => handleModeSwitch('syno')}
            className={`flex-1 min-w-[140px] px-4 py-3 rounded-2xl text-xs font-black tracking-wide transition-all border ${
              workbenchMode === 'syno'
                ? 'bg-brand-primary text-white border-transparent shadow-lg shadow-indigo-600/15'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            🎯 SynoMaster 词组选择
          </button>
          <button
            onClick={() => handleModeSwitch('spell')}
            className={`flex-1 min-w-[140px] px-4 py-3 rounded-2xl text-xs font-black tracking-wide transition-all border ${
              workbenchMode === 'spell'
                ? 'bg-brand-primary text-white border-transparent shadow-lg shadow-indigo-600/15'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            ⌨️ ChineseSpelling 拼写
          </button>
          <button
            onClick={() => handleModeSwitch('blank-choice')}
            className={`flex-1 min-w-[140px] px-4 py-3 rounded-2xl text-xs font-black tracking-wide transition-all border ${
              workbenchMode === 'blank-choice'
                ? 'bg-brand-primary text-white border-transparent shadow-lg shadow-indigo-600/15'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            📖 FillBlank 行内Popover
          </button>
          <button
            onClick={() => handleModeSwitch('blank-spell')}
            className={`flex-1 min-w-[140px] px-4 py-3 rounded-2xl text-xs font-black tracking-wide transition-all border ${
              workbenchMode === 'blank-spell'
                ? 'bg-brand-primary text-white border-transparent shadow-lg shadow-indigo-600/15'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            ✏️ FillBlank 逐字盲打
          </button>
        </div>

        {/* State Banner & Progress */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-rose-50 text-feedback-error text-[10px] font-black rounded-lg uppercase border border-rose-100">
              Hard 模式
            </span>
            <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase">
              ● FSM 状态机并发锁控制 [{fsmState}]
            </span>
          </div>
          <div className="text-xs font-bold text-brand-primary bg-indigo-50 px-4 py-1.5 rounded-full">
            进度: {currentIndex + 1} / {selectedContent.keywords.length}
          </div>
        </div>

        {/* ==================================================== */}
        {/* 终极 MASTER CARD (1:1 原型高保真还原) */}
        {/* ==================================================== */}
        {fsmState === 'SESSION_SUMMARY' ? (
          <div className="bg-white rounded-[48px] p-12 md:p-16 border border-workspace-border shadow-master-card relative overflow-hidden text-center space-y-8 page-fade-in">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-indigo-500"></div>
            <span className="text-6xl">🏆</span>
            <h3 className="text-3xl font-extrabold text-slate-900">演练会话完成！</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
              今日的混合演练已圆满结束，本次会话共完成 <span className="font-bold text-brand-primary">{selectedContent.keywords.length}</span> 个实体卡片，错误拦截 <span className="font-bold text-feedback-error">{wrongCount}</span> 次。
            </p>
            <div className="pt-4 flex gap-4 justify-center">
              <button
                onClick={() => {
                  setCurrentIndex(0);
                  setWrongCount(0);
                  setFsmState('QUESTION_ACTIVE');
                }}
                className="px-8 py-4 rounded-2xl bg-brand-primary text-white text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 active:scale-95 transition-all"
              >
                再次挑战
              </button>
              <button
                onClick={() => setSelectedContent(null)}
                className="px-8 py-4 rounded-2xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 hover:-translate-y-0.5 active:scale-95 transition-all"
              >
                返回控制大厅
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full space-y-6">
            
            {/* 1. SynoMaster 词组视图 (`view-syno`) */}
            {workbenchMode === 'syno' && currentKeyword && (
              <div
                id="view-syno"
                className="bg-white rounded-[48px] p-12 md:p-16 border border-workspace-border shadow-master-card relative overflow-hidden page-fade-in"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-600 to-purple-600"></div>

                <div className="flex justify-between items-center mb-8">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">
                    实体 ID: syno_{currentIndex + 8103}
                  </span>
                  {wrongCount > 0 && (
                    <span className="text-xs text-feedback-error font-semibold">
                      ⚠️ 当前会话错题数: {wrongCount} 次
                    </span>
                  )}
                </div>

                <div className="text-center space-y-4 mb-14">
                  <h2 className="text-5xl md:text-6xl font-bold text-slate-900 tracking-tight">
                    {currentKeyword.term}
                  </h2>
                  <p className="text-lg text-slate-400 font-medium tracking-widest">
                    英 [əˈmiːliəreɪt] &nbsp; 美 [əˈmiːliəreɪt]
                  </p>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                    请选择最具内聚性的同义核心词组：
                  </p>

                  <div className="grid grid-cols-1 gap-4">
                    {synoOptions.map((opt, i) => {
                      const isSelected = selectedSynoOption === i;
                      const showCorrect = fsmState === 'EXPLANATION_ACTIVE' && opt.isCorrect;
                      const showWrong = fsmState === 'EXPLANATION_ACTIVE' && isSelected && !opt.isCorrect;

                      let borderClass = 'border-slate-200 hover:bg-slate-50';
                      let bgClass = 'bg-white';
                      let textClass = 'text-slate-700';

                      if (showCorrect) {
                        borderClass = 'border-2 border-emerald-500';
                        bgClass = 'bg-emerald-50/40 shadow-sm';
                        textClass = 'text-emerald-900 font-bold';
                      } else if (showWrong) {
                        borderClass = 'border-2 border-rose-500';
                        bgClass = 'bg-rose-50/40';
                        textClass = 'text-rose-900 font-bold';
                      }

                      return (
                        <div
                          key={i}
                          onClick={() => handleSelectSyno(i, opt.isCorrect)}
                          className={`flex items-center justify-between p-6 rounded-3xl border cursor-pointer active:scale-[0.98] transition-all ${borderClass} ${bgClass}`}
                        >
                          <div className="flex items-center gap-6">
                            <span
                              className={`h-8 w-8 flex items-center justify-center rounded-xl text-sm font-bold ${
                                showCorrect
                                  ? 'bg-emerald-500 text-white'
                                  : showWrong
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span className={`text-base md:text-lg ${textClass}`}>{opt.term}</span>
                          </div>
                          {showCorrect && (
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-md tracking-wider">
                              ✨ 判定正确
                            </span>
                          )}
                          {!showCorrect && !showWrong && (
                            <span className="text-xs font-bold text-slate-300">
                              {opt.definition.substring(0, 8)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 2. ChineseSpelling 拼写视图 (`view-spell`) */}
            {workbenchMode === 'spell' && currentKeyword && (
              <div
                id="view-spell"
                className="bg-white rounded-[48px] p-12 md:p-16 border border-workspace-border shadow-master-card relative overflow-hidden page-fade-in"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500"></div>

                <div className="text-center space-y-6 mb-12">
                  <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black rounded-lg uppercase tracking-wider border border-amber-200/60">
                    主观词汇拼写检查
                  </span>
                  
                  <h3 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight leading-snug">
                    {currentKeyword.definition}
                  </h3>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={playPronunciation}
                      className="h-12 px-5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 font-bold text-xs text-slate-600 flex items-center gap-2 transition-all active:scale-95 group"
                    >
                      <span className="group-hover:scale-110 transition-transform">🔊</span> 发音回放
                    </button>
                    {isPlayingAudio && (
                      <div className="flex items-center gap-0.5 h-4">
                        <span className="w-0.5 h-3 bg-indigo-500 rounded-full animate-pulse"></span>
                        <span className="w-0.5 h-4 bg-indigo-500 rounded-full animate-pulse"></span>
                        <span className="w-0.5 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                      </div>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSpellSubmit} className="max-w-md mx-auto space-y-5">
                  <div className="relative">
                    <input
                      ref={spellInputRef}
                      type="text"
                      value={spellInput}
                      onChange={(e) => setSpellInput(e.target.value)}
                      disabled={fsmState === 'EXPLANATION_ACTIVE'}
                      placeholder="键入对应的英文 Entity 单词..."
                      className={`w-full h-16 px-6 rounded-2xl border-2 bg-slate-50/50 text-xl font-bold tracking-wide text-center focus:outline-none focus:bg-white transition-all ${
                        isSpellCorrect === true
                          ? 'border-emerald-500 bg-emerald-50/10 text-emerald-900'
                          : isSpellCorrect === false
                          ? 'border-rose-500 bg-rose-50/10 text-rose-900'
                          : 'border-slate-200 focus:border-brand-primary'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={fsmState === 'EXPLANATION_ACTIVE'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md hover:bg-slate-200"
                    >
                      Enter 验证契约
                    </button>
                  </div>

                  {/* Letter Placeholders */}
                  <div className="flex justify-center gap-1.5 pt-2 flex-wrap">
                    {currentKeyword.term.split('').map((char, index) => {
                      const typed = spellInput.charAt(index);
                      const isCorrectLetter = typed && typed.toLowerCase() === char.toLowerCase();
                      
                      return (
                        <span
                          key={index}
                          className={`w-6 h-1 rounded-full ${
                            isCorrectLetter
                              ? 'bg-brand-primary'
                              : typed
                              ? 'bg-rose-400'
                              : 'bg-slate-200'
                          }`}
                        ></span>
                      );
                    })}
                  </div>
                </form>
              </div>
            )}

            {/* 3. FillBlank 行内选择视图 (`view-blank-choice`) */}
            {workbenchMode === 'blank-choice' && currentKeyword && (
              <div
                id="view-blank-choice"
                className="bg-white rounded-[48px] p-12 md:p-16 border border-workspace-border shadow-master-card relative overflow-hidden page-fade-in"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-indigo-500"></div>

                <div className="space-y-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                    长篇学术文本行内划词挖空选择
                  </h3>

                  <div className="text-xl text-slate-800 leading-[2.4] tracking-wide font-normal font-['Noto_Sans_SC']">
                    {blankSentence.leading}
                    
                    {/* Gap choice activator */}
                    <span className="relative inline-block align-middle mx-1.5">
                      <button
                        onClick={() => {
                          if (fsmState === 'QUESTION_ACTIVE') {
                            setBlankChoicePopoverOpen(!blankChoicePopoverOpen);
                          }
                        }}
                        className={`inline-flex items-center justify-center min-w-[150px] h-9 px-4 rounded-full border-2 text-sm font-bold transition-all ${
                          isBlankChoiceCorrect === true
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : isBlankChoiceCorrect === false
                            ? 'border-rose-500 bg-rose-50 text-rose-700'
                            : 'border-dashed border-brand-primary bg-indigo-50/50 text-brand-primary'
                        }`}
                      >
                        {selectedBlankChoice || '[ 点击防腐选词 ]'}
                      </button>

                      {/* Dropdown Popover */}
                      {blankChoicePopoverOpen && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-11 w-52 bg-white rounded-2xl border border-slate-200 shadow-popover p-2 text-left space-y-1 z-50 animate-fade-in">
                          <div className="px-2.5 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            领域模型候选集
                          </div>
                          {blankChoiceOptions.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => handleSelectBlankChoice(opt)}
                              className="w-full px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 text-left rounded-lg transition-colors flex justify-between items-center"
                            >
                              <span>{opt}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </span>

                    {blankSentence.trailing}
                  </div>
                </div>
              </div>
            )}

            {/* 4. FillBlank 逐字盲打视图 (`view-blank-spell`) */}
            {workbenchMode === 'blank-spell' && currentKeyword && (
              <div
                id="view-blank-spell"
                className="bg-white rounded-[48px] p-12 md:p-16 border border-workspace-border shadow-master-card relative overflow-hidden page-fade-in"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-rose-500"></div>

                <div className="space-y-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                    长文本主观行内逐字盲打纠错
                  </h3>

                  <div className="text-xl text-slate-800 leading-[2.4] tracking-wide font-normal">
                    {blankSentence.leading}

                    {/* Character Grid Box */}
                    <span className="inline-flex items-center gap-1 mx-2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-2xl align-middle">
                      {currentKeyword.term.split('').map((_, i) => {
                        const val = blankSpellInputs[i] || '';
                        const isCorrectInput = val !== '';
                        const isErrorInput = blankSpellErrorChar && blankSpellErrorChar.index === i + 1;
                        
                        let borderClass = 'border-slate-200';
                        let bgClass = 'bg-white';
                        let textClass = 'text-slate-800';

                        if (isCorrectInput) {
                          borderClass = 'border-emerald-500';
                          textClass = 'text-emerald-600';
                        } else if (isErrorInput) {
                          borderClass = 'border-feedback-error';
                          bgClass = 'bg-rose-50';
                          textClass = 'text-feedback-error animate-pulse';
                        }

                        return (
                          <input
                            key={i}
                            id={`blank-char-${i}`}
                            type="text"
                            value={val || (isErrorInput ? blankSpellErrorChar.char : '')}
                            onChange={(e) => handleBlankSpellKeyPress(i, e.target.value)}
                            maxLength={1}
                            disabled={fsmState === 'EXPLANATION_ACTIVE' || isBlankSpellCompleted || (i > 0 && !blankSpellInputs[i - 1])}
                            className={`w-7 h-8 text-center text-sm font-bold focus:outline-none transition-all rounded-md border ${borderClass} ${bgClass} ${textClass}`}
                            autoComplete="off"
                          />
                        );
                      })}
                    </span>

                    {blankSentence.trailing}
                  </div>

                  {/* Inline Warning Error Popover */}
                  {blankSpellErrorChar && (
                    <div className="flex items-center gap-2 text-xs font-bold text-feedback-error bg-rose-50 px-4 py-2.5 rounded-xl w-fit border border-rose-100 animate-bounce">
                      <span>⚠️ 字符第 {blankSpellErrorChar.index} 位发生冲突：您键入了非预期的 '{blankSpellErrorChar.char}'，已拦截并退回</span>
                      <button
                        type="button"
                        onClick={handleResetBlankSpell}
                        className="underline ml-2 text-rose-700 hover:text-rose-900"
                      >
                        重置盲打
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================================================== */}
            {/* 深度释义与学术链认知面板 */}
            {/* ==================================================== */}
            {currentKeyword && (
              <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 space-y-4 page-fade-in">
                <div className="flex items-center gap-2 text-brand-primary text-[11px] font-black tracking-widest uppercase mb-1">
                  <span>💡 深度释义与学术链认知</span>
                </div>
                <p className="text-base text-slate-700 leading-relaxed font-medium">
                  <span className="text-brand-primary font-black">vt. & vi. &nbsp;</span>
                  {currentKeyword.definition}。在正式语篇中，指将原本不利的、退化的境遇或状态改善为更为优良、合理的形态。
                </p>
                {(currentKeyword as any).tags && (currentKeyword as any).tags.length > 0 && (
                  <div className="flex gap-2 pt-2">
                    {((currentKeyword as any).tags as string[]).map((tag: string, i: number) => (
                      <span key={i} className="text-[10px] font-bold bg-slate-200/60 text-slate-500 px-2 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between gap-6 px-4">
              <button
                onClick={() => {
                  toast.success(`回溯句点：${blankSentence.full}`);
                }}
                className="text-xs font-bold text-slate-400 hover:text-slate-900 active:scale-95 transition-all uppercase tracking-widest"
              >
                上下文语料回溯
              </button>

              <button
                onClick={handleNextQuestion}
                disabled={fsmState !== 'EXPLANATION_ACTIVE'}
                className="bg-slate-900 px-10 py-5 rounded-[24px] text-white font-bold text-lg shadow-2xl shadow-slate-900/20 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5 active:scale-[0.98] transition-all"
              >
                熟知，下一题 →
              </button>
            </div>

          </div>
        )}

      </div>
    </AppLayout>
  );
}
