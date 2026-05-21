/**
 * 学习工作台 FSM 控制器 Hook
 *
 * 统一封装全量交互状态机控制流、业务逻辑、仓储层副作用。
 * LearningPage 作为纯净 Presenter 组件，仅消费此 Hook 暴露的只读契约。
 *
 * 架构职责：
 * - 内部实例化 createLearningFSM 引擎，管理 FSM 状态转移
 * - 收拢 SynoMaster 选择、ChineseSpelling 拼写、FillBlank Popover、逐字盲打全场景
 * - 依赖倒置：通过 RecitationRepository 执行错题归档、进度打卡、事务预写
 * - 通过 trackEvent 发射统计遥测
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContentStore } from '../stores/useContentStore';
import { useToast } from '../components/ui';
import { RecitationRepository } from '../infrastructure/repositories/RecitationRepository';
import { trackEvent } from '../services/statistics/eventTracker';
import type { ParsedContent, Keyword } from '../types';

// ==================== 类型定义 ====================

export type WorkbenchMode = 'syno' | 'spell' | 'blank-choice' | 'blank-spell';

export type FSMState =
  | 'IDLE'
  | 'LOADING_MATERIAL'
  | 'QUESTION_ACTIVE'
  | 'EVALUATING'
  | 'EXPLANATION_ACTIVE'
  | 'SESSION_SUMMARY';

export interface SynoOption {
  term: string;
  definition: string;
  isCorrect: boolean;
}

export interface BlankSentence {
  leading: string;
  trailing: string;
  full: string;
}

export interface LearningFSMActions {
  selectSynoOption: (index: number, isCorrect: boolean) => void;
  submitSpelling: (e: React.FormEvent) => void;
  setSpellInput: (value: string) => void;
  playPronunciation: () => void;
  selectBlankChoice: (choice: string) => void;
  toggleBlankChoicePopover: () => void;
  typeBlankChar: (index: number, value: string) => void;
  resetBlankSpell: () => void;
  switchMode: (mode: WorkbenchMode) => void;
  nextQuestion: () => void;
  restartSession: () => void;
  returnToLobby: () => void;
  showContextTrace: () => void;
  navigateToContent: () => void;
  selectMaterial: (id: string) => void;
  goBackFromSession: () => void;
}

export interface LearningFSMControllerReturn {
  // 内容加载
  loading: boolean;
  selectedContent: ParsedContent | null;
  contents: ParsedContent[];

  // FSM 核心状态
  fsmState: FSMState;
  workbenchMode: WorkbenchMode;
  currentIndex: number;
  currentKeyword: Keyword | null;

  // 统计
  wrongCount: number;
  completedCount: number;
  quizWrongCount: number;
  fillBlankWrongCount: number;

  // 同义词模式
  synoOptions: SynoOption[];
  selectedSynoOption: number | null;

  // 拼写模式
  spellInput: string;
  isSpellCorrect: boolean | null;
  isPlayingAudio: boolean;

  // 挖空选择模式
  blankSentence: BlankSentence;
  blankChoiceOptions: string[];
  blankChoicePopoverOpen: boolean;
  selectedBlankChoice: string | null;
  isBlankChoiceCorrect: boolean | null;

  // 逐字盲打模式
  blankSpellInputs: string[];
  blankSpellErrorChar: { index: number; char: string } | null;
  isBlankSpellCompleted: boolean;

  // Actions
  actions: LearningFSMActions;

  // Refs
  spellInputRef: React.RefObject<HTMLInputElement>;
}

// ==================== Hook 实现 ====================

export function useLearningFSMController(): LearningFSMControllerReturn {
  const { contentId } = useParams<{ contentId?: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { contents } = useContentStore();

  // ——— 内容加载 ———
  const [selectedContent, setSelectedContent] = useState<ParsedContent | null>(null);
  const [loading, setLoading] = useState(true);

  // ——— FSM 核心状态 ———
  const [workbenchMode, setWorkbenchMode] = useState<WorkbenchMode>('syno');
  const [fsmState, setFsmState] = useState<FSMState>('IDLE');
  const [currentIndex, setCurrentIndex] = useState(0);

  // ——— 同义词选择状态 ———
  const [selectedSynoOption, setSelectedSynoOption] = useState<number | null>(null);

  // ——— 拼写状态 ———
  const [spellInput, setSpellInput] = useState('');
  const [isSpellCorrect, setIsSpellCorrect] = useState<boolean | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // ——— 挖空选择状态 ———
  const [blankChoicePopoverOpen, setBlankChoicePopoverOpen] = useState(false);
  const [selectedBlankChoice, setSelectedBlankChoice] = useState<string | null>(null);
  const [isBlankChoiceCorrect, setIsBlankChoiceCorrect] = useState<boolean | null>(null);

  // ——— 逐字盲打状态 ———
  const [blankSpellInputs, setBlankSpellInputs] = useState<string[]>([]);
  const [blankSpellErrorChar, setBlankSpellErrorChar] = useState<{ index: number; char: string } | null>(null);
  const [isBlankSpellCompleted, setIsBlankSpellCompleted] = useState(false);

  // ——— 会话统计 ———
  const [wrongCount, setWrongCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [quizWrongCount, setQuizWrongCount] = useState(0);
  const [fillBlankWrongCount, setFillBlankWrongCount] = useState(0);

  // ——— Refs ———
  const spellInputRef = useRef<HTMLInputElement>(null);

  // ==================== 副作用：加载错题数 ====================

  useEffect(() => {
    import('../services/storage/indexedDB').then((db) => {
      db.getAllWrongAnswers().then((l) => setQuizWrongCount(l.filter((x) => !x.mastered).length));
      db.getAllFillBlankWrongAnswers().then((l) => setFillBlankWrongCount(l.filter((x) => !x.mastered).length));
    });
  }, []);

  // ==================== 副作用：匹配/加载材料 ====================

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

  // ==================== 衍生状态：当前关键词 ====================

  const currentKeyword = useMemo(() => {
    if (!selectedContent || selectedContent.keywords.length === 0) return null;
    return selectedContent.keywords[currentIndex % selectedContent.keywords.length];
  }, [selectedContent, currentIndex]);

  // ==================== 副作用：盲打输入框初始化 ====================

  useEffect(() => {
    if (currentKeyword) {
      setBlankSpellInputs(new Array(currentKeyword.term.length).fill(''));
      setBlankSpellErrorChar(null);
      setIsBlankSpellCompleted(false);
    }
  }, [currentKeyword]);

  // ==================== 衍生状态：同义词选项 ====================

  const synoOptions = useMemo((): SynoOption[] => {
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

    const options: SynoOption[] = [
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

  // ==================== 衍生状态：挖空句子解析 ====================

  const blankSentence = useMemo((): BlankSentence => {
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

  // ==================== 衍生状态：挖空候选集 ====================

  const blankChoiceOptions = useMemo((): string[] => {
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

  // ==================== 通用：重置答题交互状态 ====================

  const resetInteractionState = useCallback(() => {
    setSelectedSynoOption(null);
    setSpellInput('');
    setIsSpellCorrect(null);
    setBlankChoicePopoverOpen(false);
    setSelectedBlankChoice(null);
    setIsBlankChoiceCorrect(null);
    setBlankSpellErrorChar(null);
    setIsBlankSpellCompleted(false);
  }, []);

  // ==================== 仓储层：错题归档 ====================

  const archiveWrongAnswer = useCallback((
    keyword: Keyword,
    content: ParsedContent,
    questionText: string,
    explanationText: string,
    userAnswer: string
  ) => {
    void RecitationRepository.saveWrongAnswer({
      id: `wrong-${Date.now()}`,
      questionId: keyword.term,
      archiveId: content.id,
      question: {
        id: keyword.term,
        question: questionText,
        options: [],
        correctAnswer: keyword.term,
        explanation: explanationText,
      },
      userAnswer,
      wrongCount: 1,
      lastWrongAt: new Date(),
      category: content.title,
      tags: [],
      mastered: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }, []);

  // ==================== Action: 同义词选择 ====================

  const selectSynoOption = useCallback((index: number, isCorrectOption: boolean) => {
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
        if (currentKeyword && selectedContent) {
          archiveWrongAnswer(
            currentKeyword,
            selectedContent,
            `请写出与 "${currentKeyword.definition}" 对应的英文核心词汇`,
            `学术辨析：${currentKeyword.term} 表示 ${currentKeyword.definition}。`,
            synoOptions[index].term
          );
        }
      }
    }, 400);
  }, [fsmState, currentKeyword, selectedContent, synoOptions, toast, archiveWrongAnswer]);

  // ==================== Action: 发音播放 ====================

  const playPronunciation = useCallback(() => {
    if (!currentKeyword) return;
    setIsPlayingAudio(true);
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(currentKeyword.term);
    utterance.lang = 'en-US';
    utterance.onend = () => setIsPlayingAudio(false);
    synth.speak(utterance);
  }, [currentKeyword]);

  // ==================== Action: 拼写提交 ====================

  const submitSpelling = useCallback((e: React.FormEvent) => {
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
          archiveWrongAnswer(
            currentKeyword,
            selectedContent,
            `拼写单词："${currentKeyword.definition}"`,
            `正确拼写为 ${currentKeyword.term} [${currentKeyword.definition}]`,
            spellInput
          );
        }
      }
    }, 300);
  }, [fsmState, currentKeyword, spellInput, selectedContent, toast, archiveWrongAnswer]);

  // ==================== Action: 挖空选择 ====================

  const selectBlankChoice = useCallback((choice: string) => {
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
  }, [fsmState, currentKeyword, toast]);

  // ==================== Action: Popover 开关 ====================

  const toggleBlankChoicePopover = useCallback(() => {
    if (fsmState === 'QUESTION_ACTIVE') {
      setBlankChoicePopoverOpen((prev) => !prev);
    }
  }, [fsmState]);

  // ==================== Action: 逐字盲打 ====================

  const typeBlankChar = useCallback((index: number, val: string) => {
    if (!currentKeyword || fsmState !== 'QUESTION_ACTIVE') return;

    const correctWord = currentKeyword.term.toLowerCase();
    const charInput = val.slice(-1).toLowerCase();

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
      // 输入错误
      setBlankSpellErrorChar({ index: index + 1, char: charInput });
      toast.error(`实时纠错：您键入了非预期的 '${charInput}'`);
    }
  }, [currentKeyword, fsmState, blankSpellInputs, toast]);

  // ==================== Action: 重置盲打 ====================

  const resetBlankSpell = useCallback(() => {
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
  }, [currentKeyword]);

  // ==================== Action: 模式切换 ====================

  const switchMode = useCallback((mode: WorkbenchMode) => {
    setWorkbenchMode(mode);
    setFsmState('QUESTION_ACTIVE');
    resetInteractionState();
    if (currentKeyword) {
      setBlankSpellInputs(new Array(currentKeyword.term.length).fill(''));
    }
    trackEvent('learning_mode_switch', { mode });
  }, [currentKeyword, resetInteractionState]);

  // ==================== Action: 下一题 ====================

  const nextQuestion = useCallback(() => {
    if (!selectedContent) return;

    setCompletedCount((prev) => prev + 1);
    resetInteractionState();

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
  }, [selectedContent, currentIndex, completedCount, workbenchMode, currentKeyword, resetInteractionState]);

  // ==================== Action: 重新挑战 ====================

  const restartSession = useCallback(() => {
    setCurrentIndex(0);
    setWrongCount(0);
    setFsmState('QUESTION_ACTIVE');
  }, []);

  // ==================== Action: 返回控制大厅 ====================

  const returnToLobby = useCallback(() => {
    setSelectedContent(null);
    setFsmState('IDLE');
  }, []);

  // ==================== Action: 上下文语料回溯 ====================

  const showContextTrace = useCallback(() => {
    toast.success(`回溯句点：${blankSentence.full}`);
  }, [blankSentence, toast]);

  // ==================== Action: 导航到内容页 ====================

  const navigateToContent = useCallback(() => {
    navigate('/content');
  }, [navigate]);

  // ==================== Action: 选择材料 ====================

  const selectMaterial = useCallback((id: string) => {
    navigate(`/learning/${id}`);
  }, [navigate]);

  // ==================== Action: 返回 (从会话) ====================

  const goBackFromSession = useCallback(() => {
    setSelectedContent(null);
    setFsmState('IDLE');
  }, []);

  // ==================== 组装 Actions 对象 ====================

  const actions = useMemo((): LearningFSMActions => ({
    selectSynoOption,
    submitSpelling,
    setSpellInput,
    playPronunciation,
    selectBlankChoice,
    toggleBlankChoicePopover,
    typeBlankChar,
    resetBlankSpell,
    switchMode,
    nextQuestion,
    restartSession,
    returnToLobby,
    showContextTrace,
    navigateToContent,
    selectMaterial,
    goBackFromSession,
  }), [
    selectSynoOption,
    submitSpelling,
    playPronunciation,
    selectBlankChoice,
    toggleBlankChoicePopover,
    typeBlankChar,
    resetBlankSpell,
    switchMode,
    nextQuestion,
    restartSession,
    returnToLobby,
    showContextTrace,
    navigateToContent,
    selectMaterial,
    goBackFromSession,
  ]);

  // ==================== 返回只读契约 ====================

  return {
    loading,
    selectedContent,
    contents,

    fsmState,
    workbenchMode,
    currentIndex,
    currentKeyword,

    wrongCount,
    completedCount,
    quizWrongCount,
    fillBlankWrongCount,

    synoOptions,
    selectedSynoOption,

    spellInput,
    isSpellCorrect,
    isPlayingAudio,

    blankSentence,
    blankChoiceOptions,
    blankChoicePopoverOpen,
    selectedBlankChoice,
    isBlankChoiceCorrect,

    blankSpellInputs,
    blankSpellErrorChar,
    isBlankSpellCompleted,

    actions,
    spellInputRef,
  };
}
