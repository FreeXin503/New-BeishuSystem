/**
 * 学习页面 - 学习模式选择和学习界面
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUserStore } from '../stores/useUserStore';
import { useContentStore } from '../stores/useContentStore';
import { AppLayout } from '../components/layout';
import FillBlank from '../components/learning/FillBlank';
import Quiz from '../components/learning/Quiz';
import Matching from '../components/learning/Matching';
import Mnemonic from '../components/learning/Mnemonic';
import SpeechReader from '../components/learning/SpeechReader';
import LogicChainComponent from '../components/learning/LogicChain';
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
  const sessionStartTime = useRef<Date>(new Date());

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

  function handleModeSelect(mode: LearningMode) {
    if (mode === 'logic-chain' && selectedContent) {
      loadLogicChain();
    }
    if (selectedContent) {
      const modeObj = LEARNING_MODES.find(m => m.id === mode);
      localStorage.setItem('last-study-session', JSON.stringify({
        contentId: selectedContent.id,
        contentTitle: selectedContent.title,
        modeId: mode,
        modeName: modeObj ? modeObj.name : mode,
        timestamp: Date.now()
      }));
    }
    setSelectedMode(mode);
    sessionStartTime.current = new Date();
  }

  async function loadLogicChain() {
    if (!selectedContent) return;
    
    setLogicChainLoading(true);
    try {
      // 先尝试从缓存加载
      const cached = await getLogicChainsByContent(selectedContent.id);
      if (cached.length > 0) {
        setCurrentLogicChain(cached[0]);
      } else {
        // 生成新的逻辑链
        const chain = await generateLogicChainFromContent(selectedContent);
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

  return (
    <AppLayout title={selectedMode ? LEARNING_MODES.find(m => m.id === selectedMode)?.name : '学习模式'} showBack={!!selectedMode} onBack={handleBack}>
      <main className="max-w-6xl mx-auto px-4 py-8">
        {selectedMode && selectedContent ? (
          renderLearningComponent()
        ) : (
          <div className="space-y-6">
            {/* 上次答题/学习断点一键继续 (极其人性化) */}
            {lastStudy && !selectedMode && (
              <div className="p-5 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:shadow-md" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-4">
                  <span className="text-4xl">🎯</span>
                  <div>
                    <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>继续上次的学习进度</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-secondary)' }}>
                      内容：<span className="font-medium" style={{ color: 'var(--color-text)' }}>{lastStudy.contentTitle}</span> · 模式：<span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{lastStudy.modeName}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const matchedContent = contents.find(c => c.id === lastStudy.contentId);
                    if (matchedContent) {
                      setSelectedContent(matchedContent);
                      handleModeSelect(lastStudy.modeId);
                    }
                  }}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 flex-shrink-0"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  继续学习 →
                </button>
              </div>
            )}

            {/* 当前选定的学习内容详情与便捷切换 (人性化极佳) */}
            {(selectedContent || contentId) && selectedContent && !selectedMode && (
              <div className="p-6 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)' }}>📚 当前选定学习内容</span>
                    <span className="text-xs" style={{ color: 'var(--color-secondary)' }}>{selectedContent.chapters.length} 个章节 · {selectedContent.keywords.length} 个重点词</span>
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{selectedContent.title}</h2>
                </div>
                {!contentId && (
                  <button 
                    onClick={() => { setSelectedContent(null); handleBack(); }} 
                    className="text-sm font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-opacity-10 transition-all" 
                    style={{ color: 'var(--color-primary)', borderColor: 'var(--color-border)' }}
                  >
                    🔄 切换其他内容
                  </button>
                )}
              </div>
            )}

            {/* 学习内容选择面板 */}
            {selectedContent === null && contents.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                  📖 请选择学习内容
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contents.map((contentItem) => (
                    <button
                      key={contentItem.id}
                      onClick={() => setSelectedContent(contentItem)}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                      className="text-left p-5 rounded-2xl border transition-all active:scale-[0.99] group"
                      style={{ 
                        backgroundColor: 'var(--color-card)',
                        borderColor: 'var(--color-border)'
                      }}
                    >
                      <h3 className="font-bold text-md mb-2 group-hover:text-primary transition-colors" style={{ color: 'var(--color-text)' }}>
                        {contentItem.title}
                      </h3>
                      <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                        {contentItem.chapters.length} 个章节 · {contentItem.keywords.length} 个关键词
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 空白状态 */}
            {contents.length === 0 && (
              <div className="text-center py-16 rounded-2xl border border-dashed" style={{ borderColor: 'var(--color-border)' }}>
                <svg className="mx-auto h-14 w-14" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-4 text-md font-bold" style={{ color: 'var(--color-text)' }}>
                  还没有学习教材
                </h3>
                <p className="mt-1 text-sm max-w-xs mx-auto" style={{ color: 'var(--color-secondary)' }}>
                  您需要先导入或者手动添加学习教材，之后即可开启高效背诵。
                </p>
                <div className="mt-6">
                  <Link
                    to="/content"
                    className="inline-flex items-center px-5 py-2.5 shadow-sm text-sm font-bold rounded-xl text-white hover:opacity-90 active:scale-95 transition-all"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    💡 去添加内容
                  </Link>
                </div>
              </div>
            )}

            {/* 学习模式选择面板 */}
            {(selectedContent || contentId) && (
              <div>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                  ⚡ 请选择学习模式
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
                      {/* Hover subtle background aura overlay */}
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
            )}
          </div>
        )}
      </main>
    </AppLayout>
  );
}
