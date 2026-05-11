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
    <AppLayout title={selectedMode ? LEARNING_MODES.find(m => m.id === selectedMode)?.name : '选择学习模式'} showBack={!!selectedMode} onBack={handleBack}>
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {selectedMode && selectedContent ? (
          renderLearningComponent()
        ) : (
          <>
            {selectedContent === null && contents.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text)' }}>
                  选择学习内容
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contents.map((contentItem) => (
                    <button
                      key={contentItem.id}
                      onClick={() => setSelectedContent(contentItem)}
                      className="text-left p-4 rounded-lg border-2 transition-colors hover:opacity-90"
                      style={{ 
                        backgroundColor: 'var(--color-card)',
                        borderColor: 'var(--color-border)'
                      }}
                    >
                      <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>
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

            {contents.length === 0 && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  还没有学习内容
                </h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-secondary)' }}>
                  请先添加学习内容
                </p>
                <div className="mt-6">
                  <Link
                    to="/content"
                    className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-white hover:opacity-90"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    添加内容
                  </Link>
                </div>
              </div>
            )}

            {(selectedContent || contentId) && (
              <div>
                <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text)' }}>
                  选择学习模式
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {LEARNING_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => handleModeSelect(mode.id)}
                      className="rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
                      style={{ backgroundColor: 'var(--color-card)' }}
                    >
                      <div className="flex items-center mb-3">
                        <span className="text-3xl mr-3">{mode.icon}</span>
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                          {mode.name}
                        </h3>
                      </div>
                      <p style={{ color: 'var(--color-secondary)' }}>
                        {mode.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </AppLayout>
  );
}
