/**
 * 学习页面 - 学习模式选择和学习界面
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/useUserStore';
import { useContentStore } from '../stores/useContentStore';
import { AppLayout } from '../components/layout';
import FillBlank from '../components/learning/FillBlank';
import Quiz from '../components/learning/Quiz';
import Matching from '../components/learning/Matching';
import Mnemonic from '../components/learning/Mnemonic';
import SpeechReader from '../components/learning/SpeechReader';
import LogicChainComponent from '../components/learning/LogicChain';
import TutorMode from '../components/learning/TutorMode';
import { generateFillBlanks } from '../services/learning/fillBlank';
import { generateQuizQuestions } from '../services/learning/quiz';
import { generateMatchingPairs } from '../services/learning/matching';
import { generateLogicChainFromContent } from '../services/learning/logicChain';
import { saveStudySession, saveLogicChain, getLogicChainsByContent } from '../services/storage/indexedDB';
import { AIServiceError } from '../services/ai/deepseek';
import type { ParsedContent, LearningMode, ModeProgress, StudySession, LogicChain } from '../types';

const LEARNING_MODES: { id: LearningMode; name: string; description: string; icon: string }[] = [
  { id: 'fill-blank', name: '挖空填词', description: '关键词遮盖，强化主动回忆', icon: '📝' },
  { id: 'quiz', name: '选择题', description: '四选一测验，含答案解析', icon: '❓' },
  { id: 'matching', name: '术语配对', description: '概念与定义连线', icon: '🔗' },
  { id: 'logic-chain', name: '逻辑链', description: '理清逻辑关系，强化理解', icon: '🔀' },
  { id: 'mnemonic', name: '记忆口诀', description: 'AI 生成押韵助记', icon: '🎵' },
  { id: 'speech', name: '语音朗读', description: '听觉通道强化编码', icon: '🔊' },
  { id: 'tutor', name: 'AI 伴读', description: '选中划词，随时向助教提问', icon: '🤖' },
];

export default function LearningPage() {
  const { contentId } = useParams<{ contentId?: string }>();
  const { contents, addStudySession } = useContentStore();
  const { user } = useUserStore();
  const [selectedContent, setSelectedContent] = useState<ParsedContent | null>(null);
  const [selectedMode, setSelectedMode] = useState<LearningMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [logicChainLoading, setLogicChainLoading] = useState(false);
  const [currentLogicChain, setCurrentLogicChain] = useState<LogicChain | null>(null);
  const navigate = useNavigate();
  const sessionStartTime = useRef<Date>(new Date());
  
  const [quizWrongCount, setQuizWrongCount] = useState(0);
  const [fillBlankWrongCount, setFillBlankWrongCount] = useState(0);

  useEffect(() => {
    import('../services/storage/indexedDB').then(db => {
      db.getAllWrongAnswers().then(l => setQuizWrongCount(l.filter(x => !x.mastered).length));
      db.getAllFillBlankWrongAnswers().then(l => setFillBlankWrongCount(l.filter(x => !x.mastered).length));
    });
  }, []);

  // 记录和恢复上次学习进度状态
  const [lastStudy, setLastStudy] = useState<{
    contentId: string;
    contentTitle: string;
    modeId: LearningMode;
    modeName: string;
    timestamp: number;
  } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('last-study-session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (contents.some(c => c.id === parsed.contentId)) {
          setLastStudy(parsed);
        }
      } catch (e) {
        console.error('解析上次学习进度失败:', e);
      }
    }
  }, [contents]);

  useEffect(() => {
    loadContent();
  }, [contentId, contents]);

  async function loadContent() {
    setLoading(true);
    try {
      if (contentId) {
        let content = contents.find(c => c.id === contentId);
        if (!content) {
          const { getContentById } = await import('../services/storage/indexedDB');
          content = await getContentById(contentId) || undefined;
        }
        setSelectedContent(content || null);
      }
    } catch (error) {
      console.error('加载内容失败:', error);
    } finally {
      setLoading(false);
    }
  }

  const learningMaterials = useMemo(() => {
    if (!selectedContent) return null;
    
    const text = selectedContent.chapters.map(c => c.content).join('\n\n');
    const keywords = selectedContent.keywords.map(k => k.term);
    
    return {
      fillBlanks: generateFillBlanks(text, keywords),
      quizQuestions: generateQuizQuestions(selectedContent.keywords),
      matchingPairs: generateMatchingPairs(selectedContent.keywords),
    };
  }, [selectedContent]);

  function handleModeSelect(mode: LearningMode, contentOverride?: ParsedContent) {
    const contentToUse = contentOverride || selectedContent;
    if (!contentToUse) return;

    if (mode === 'logic-chain') {
      loadLogicChain(contentToUse);
    }
    
    const modeObj = LEARNING_MODES.find(m => m.id === mode);
    localStorage.setItem('last-study-session', JSON.stringify({
      contentId: contentToUse.id,
      contentTitle: contentToUse.title,
      modeId: mode,
      modeName: modeObj ? modeObj.name : mode,
      timestamp: Date.now()
    }));

    // --- 生态大一统：将生成的题目注入全局练习系统 ---
    if (mode === 'quiz') {
      const quizQuestions = generateQuizQuestions(contentToUse.keywords);
      sessionStorage.setItem('importedQuiz', JSON.stringify(quizQuestions));
      sessionStorage.setItem('currentArchiveId', `learning-quiz-${contentToUse.id}`);
      sessionStorage.setItem('currentCategory', contentToUse.title);
      navigate('/quiz-practice');
      return;
    }

    if (mode === 'fill-blank') {
      const text = contentToUse.chapters.map(c => c.content).join('\n\n');
      const keywords = contentToUse.keywords.map(k => k.term);
      const generated = generateFillBlanks(text, keywords);
      
      const fillBlankItems = generated.blanks.map(blank => {
        let sentenceStart = Math.max(0, generated.text.lastIndexOf('。', blank.position) + 1);
        if (sentenceStart === 0 || sentenceStart < blank.position - 100) {
          sentenceStart = Math.max(0, blank.position - 50);
        }
        let sentenceEnd = generated.text.indexOf('。', blank.position + blank.length);
        if (sentenceEnd === -1 || sentenceEnd > blank.position + blank.length + 100) {
          sentenceEnd = Math.min(generated.text.length, blank.position + blank.length + 50);
        } else {
          sentenceEnd += 1;
        }
        
        const sentence = generated.text.substring(sentenceStart, sentenceEnd).trim();
        const localPosition = sentence.indexOf(blank.answer);
        let questionText = sentence;
        if (localPosition !== -1) {
           questionText = sentence.substring(0, localPosition) + '___' + sentence.substring(localPosition + blank.answer.length);
        } else {
           questionText = `___ (${blank.hint || '请填空'})`;
        }

        return {
          id: blank.id,
          question: questionText,
          answer: blank.answer,
          hints: blank.hint ? [blank.hint] : [],
          difficulty: 'medium',
          category: contentToUse.title,
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });
      
      sessionStorage.setItem('fillBlankPractice', JSON.stringify(fillBlankItems));
      sessionStorage.setItem('currentArchiveId', `learning-fill-${contentToUse.id}`);
      sessionStorage.setItem('currentCategory', contentToUse.title);
      navigate('/fill-blank-practice');
      return;
    }

    setSelectedContent(contentToUse);
    setSelectedMode(mode);
    sessionStartTime.current = new Date();
  }

  async function loadLogicChain(contentToUse: ParsedContent) {
    setLogicChainLoading(true);
    try {
      // 先尝试从缓存加载
      const cached = await getLogicChainsByContent(contentToUse.id);
      if (cached.length > 0) {
        setCurrentLogicChain(cached[0]);
      } else {
        // 生成新的逻辑链
        const chain = await generateLogicChainFromContent(contentToUse);
        await saveLogicChain(chain);
        setCurrentLogicChain(chain);
      }
    } catch (error) {
      if (error instanceof AIServiceError && !error.retryable) {
        console.error('AI 功能暂不可用，请在设置中配置 DeepSeek API Key 后使用');
      } else {
        console.error('加载逻辑链失败:', error);
      }
    } finally {
      setLogicChainLoading(false);
    }
  }

  function handleBack() {
    setSelectedMode(null);
    setCurrentLogicChain(null);
  }

  async function handleComplete(result: ModeProgress) {
    if (!selectedContent || !selectedMode || !user) {
      handleBack();
      return;
    }

    const session: StudySession = {
      id: `session-${Date.now()}`,
      userId: user.id,
      contentId: selectedContent.id,
      mode: selectedMode,
      duration: result.timeSpent,
      correctCount: result.correct,
      totalCount: result.total,
      startedAt: sessionStartTime.current,
      endedAt: new Date(),
    };

    addStudySession(session);
    await saveStudySession(session);

    handleBack();
  }

  function renderLearningComponent() {
    if (!selectedContent || !selectedMode || !learningMaterials) return null;

    switch (selectedMode) {
      case 'fill-blank':
        return (
          <FillBlank
            text={learningMaterials.fillBlanks.text}
            blanks={learningMaterials.fillBlanks.blanks}
            onComplete={handleComplete}
          />
        );
      case 'quiz':
        return (
          <Quiz
            questions={learningMaterials.quizQuestions}
            onComplete={handleComplete}
          />
        );
      case 'matching':
        return (
          <Matching
            pairs={learningMaterials.matchingPairs}
            onComplete={handleComplete}
          />
        );
      case 'mnemonic':
        return (
          <Mnemonic
            item={{
              id: selectedContent.id,
              content: '',
              sourceContent: selectedContent.chapters[0]?.content || '',
              type: 'default',
              createdAt: new Date(),
              isFavorite: false,
            }}
            onFavoriteChange={() => {}}
            onComplete={handleComplete}
          />
        );
      case 'speech':
        return (
          <SpeechReader
            content={selectedContent.chapters.map(c => c.content).join('\n\n')}
            onComplete={() => {}}
            onStudyComplete={handleComplete}
          />
        );
      case 'logic-chain':
        if (logicChainLoading) {
          return (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mb-4" style={{ borderColor: 'var(--color-primary)' }}></div>
              <p style={{ color: 'var(--color-secondary)' }}>AI 正在生成逻辑链...</p>
            </div>
          );
        }
        if (currentLogicChain) {
          return (
            <LogicChainComponent
              chain={currentLogicChain}
              onComplete={handleComplete}
            />
          );
        }
        return null;
      case 'tutor':
        return <TutorMode content={selectedContent} />;
      default:
        return null;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
      </div>
    );
  }

  function renderDashboard() {
    return (
      <div className="space-y-10 animate-fade-in">
        {/* Top Area */}
        <section>
          <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <span className="text-3xl">🚀</span> 学习指挥中心
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Last Study */}
            {lastStudy ? (
              <div className="p-6 rounded-2xl border flex flex-col justify-between transition-all hover:shadow-lg relative overflow-hidden" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-primary)' }}>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <span className="text-8xl">🎯</span>
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs px-2.5 py-1 rounded-md font-bold" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>断点续练</span>
                    <span className="text-xs" style={{ color: 'var(--color-secondary)' }}>您上次学到了这里</span>
                  </div>
                  <h3 className="font-bold text-xl mb-1" style={{ color: 'var(--color-text)' }}>{lastStudy.contentTitle}</h3>
                  <p className="text-sm font-semibold mb-6" style={{ color: 'var(--color-primary)' }}>正在进行：{lastStudy.modeName}</p>
                  
                  <button
                    onClick={() => {
                      const matchedContent = contents.find(c => c.id === lastStudy.contentId);
                      if (matchedContent) {
                        handleModeSelect(lastStudy.modeId, matchedContent);
                      }
                    }}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    立刻继续学习 →
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl border flex flex-col justify-center items-center text-center transition-all" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', borderStyle: 'dashed' }}>
                <span className="text-4xl mb-3 opacity-50">🌱</span>
                <p className="text-sm font-medium" style={{ color: 'var(--color-secondary)' }}>今天还没有深度的学习记录，快选个内容开始吧！</p>
              </div>
            )}

            {/* Wrong Answers Review */}
            <div className="p-6 rounded-2xl border flex flex-col justify-between transition-all hover:shadow-lg relative overflow-hidden" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
               <div className="absolute top-0 right-0 p-4 opacity-10">
                  <span className="text-8xl">⚠️</span>
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs px-2.5 py-1 rounded-md font-bold bg-red-500 text-white">弱点突破</span>
                  </div>
                  <h3 className="font-bold text-xl mb-1 text-red-600">待巩固错题</h3>
                  <div className="flex items-baseline gap-2 mb-6">
                    <p className="text-4xl font-extrabold text-red-500">{quizWrongCount + fillBlankWrongCount}</p>
                    <span className="text-sm text-red-400">题未掌握</span>
                  </div>
                  
                  <div className="flex gap-3">
                    <Link to="/wrong-answers" className="flex-1 py-3 text-center rounded-xl text-sm font-bold text-red-600 bg-red-100 hover:bg-red-200 transition-colors">
                      选择题 ({quizWrongCount})
                    </Link>
                    <Link to="/fill-blank-wrong" className="flex-1 py-3 text-center rounded-xl text-sm font-bold text-red-600 bg-red-100 hover:bg-red-200 transition-colors">
                      填空题 ({fillBlankWrongCount})
                    </Link>
                  </div>
                </div>
            </div>
          </div>
        </section>

        {/* Ecosystem Matrix */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
             <span className="text-2xl">🏛️</span> 专项训练题库
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/quiz-import" className="p-5 rounded-2xl border flex items-center gap-4 transition-all hover:-translate-y-1 hover:shadow-md group" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>❓</div>
              <div>
                <h3 className="font-bold text-md mb-0.5" style={{ color: 'var(--color-text)' }}>选择题库</h3>
                <p className="text-xs" style={{ color: 'var(--color-secondary)' }}>单选与判断综合演练</p>
              </div>
            </Link>
            <Link to="/fill-blank-import" className="p-5 rounded-2xl border flex items-center gap-4 transition-all hover:-translate-y-1 hover:shadow-md group" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>📝</div>
              <div>
                <h3 className="font-bold text-md mb-0.5" style={{ color: 'var(--color-text)' }}>填空题库</h3>
                <p className="text-xs" style={{ color: 'var(--color-secondary)' }}>核心字词精准打击</p>
              </div>
            </Link>
            <Link to="/chinese-spelling" className="p-5 rounded-2xl border flex items-center gap-4 transition-all hover:-translate-y-1 hover:shadow-md group" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>✍️</div>
              <div>
                <h3 className="font-bold text-md mb-0.5" style={{ color: 'var(--color-text)' }}>中文拼写</h3>
                <p className="text-xs" style={{ color: 'var(--color-secondary)' }}>汉字听写与词意记忆</p>
              </div>
            </Link>
          </div>
        </section>

        {/* Deep Learning Matrix */}
        <section>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <span className="text-2xl">🧠</span> 深度解析材料
            </h2>
            <Link to="/content" className="text-sm font-bold flex items-center gap-1 hover:underline" style={{ color: 'var(--color-primary)' }}>
              ➕ 导入新材料
            </Link>
          </div>
          
          {contents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contents.map((contentItem) => (
                <button
                  key={contentItem.id}
                  onClick={() => setSelectedContent(contentItem)}
                  className="text-left p-5 rounded-2xl border transition-all hover:shadow-md active:scale-[0.98] group"
                  style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded text-blue-600 bg-blue-100">文本教材</span>
                  </div>
                  <h3 className="font-bold text-md mb-2 group-hover:text-primary transition-colors line-clamp-1" style={{ color: 'var(--color-text)' }}>
                    {contentItem.title}
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--color-secondary)' }}>
                    {contentItem.chapters.length} 章节 · {contentItem.keywords.length} 关键词
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 rounded-2xl border border-dashed" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
              <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>您还没有导入任何学习材料，立刻导入体验AI自动解析出题吧！</p>
            </div>
          )}
        </section>
        
        {/* Favorites Matrix */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
             <span className="text-2xl">⭐</span> 知识精华库 (收藏夹)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Link to="/favorites" className="p-4 rounded-xl border flex items-center justify-between transition-all hover:shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>🌟</div>
                   <span className="font-bold" style={{ color: 'var(--color-text)' }}>选择题收藏夹</span>
                </div>
                <span className="text-sm font-bold text-gray-400">查看 →</span>
             </Link>
             <Link to="/fill-blank-favorites" className="p-4 rounded-xl border flex items-center justify-between transition-all hover:shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>🌟</div>
                   <span className="font-bold" style={{ color: 'var(--color-text)' }}>填空题收藏夹</span>
                </div>
                <span className="text-sm font-bold text-gray-400">查看 →</span>
             </Link>
          </div>
        </section>
      </div>
    );
  }

  function renderModeSelection() {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* 当前选定的学习内容详情与便捷切换 */}
        <div className="p-6 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)' }}>📚 当前解析材料</span>
              <span className="text-xs" style={{ color: 'var(--color-secondary)' }}>{selectedContent!.chapters.length} 个章节 · {selectedContent!.keywords.length} 个重点词</span>
            </div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{selectedContent!.title}</h2>
          </div>
          <button 
            onClick={() => { setSelectedContent(null); handleBack(); }} 
            className="text-sm font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-opacity-10 transition-all" 
            style={{ color: 'var(--color-primary)', borderColor: 'var(--color-border)' }}
          >
            返回指挥中心
          </button>
        </div>

        {/* 学习模式选择面板 */}
        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            ⚡ 请选择针对此材料的学习模式
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {LEARNING_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => handleModeSelect(mode.id)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                className="rounded-2xl border p-6 transition-all text-left relative group overflow-hidden active:scale-[0.98]"
                style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.02] transition-opacity duration-300" style={{ backgroundColor: 'var(--color-primary)' }} />
                <div className="flex items-center mb-3">
                  <span className="text-3xl mr-3 group-hover:scale-110 transition-transform duration-300">{mode.icon}</span>
                  <h3 className="text-lg font-bold group-hover:text-primary transition-colors" style={{ color: 'var(--color-text)' }}>
                    {mode.name}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-secondary)' }}>
                  {mode.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout title={selectedMode ? LEARNING_MODES.find(m => m.id === selectedMode)?.name : (!selectedContent ? '学习指挥中心' : '模式选择')} showBack={!!selectedMode || !!selectedContent} onBack={selectedMode ? handleBack : () => setSelectedContent(null)}>
      <main className="max-w-6xl mx-auto px-4 py-8">
        {selectedMode && selectedContent ? (
          renderLearningComponent()
        ) : selectedContent ? (
          renderModeSelection()
        ) : (
          renderDashboard()
        )}
      </main>
    </AppLayout>
  );
}
