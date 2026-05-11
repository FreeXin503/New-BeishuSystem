/**
 * 记忆口诀组件 - 升级版
 */

import { useState, useCallback, useEffect } from 'react';
import type { ModeProgress } from '../../types';
import type { MnemonicItem, MnemonicType } from '../../services/learning/mnemonic';
import {
  toggleFavorite,
  generateMnemonic,
  createMnemonicItem,
  copyToClipboard,
  shareMnemonic,
  MNEMONIC_TYPES,
} from '../../services/learning/mnemonic';
import { AIServiceError } from '../../services/ai/deepseek';

interface MnemonicProps {
  item: MnemonicItem;
  onFavoriteChange?: (item: MnemonicItem) => void;
  onComplete?: (result: ModeProgress) => void;
}

export function Mnemonic({ item, onFavoriteChange, onComplete }: MnemonicProps) {
  const [localItem, setLocalItem] = useState(item);
  const [selectedType, setSelectedType] = useState<MnemonicType>(item.type || 'default');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>(item.content);
  const [showCopied, setShowCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState(Date.now());

  // 初始生成
  useEffect(() => {
    if (!item.content && item.sourceContent) {
      handleGenerate('default');
    }
  }, []);

  // 组件卸载时上报学习进度
  useEffect(() => {
    return () => {
      if (onComplete) {
        const timeSpent = Date.now() - startTime;
        const result: ModeProgress = {
          total: 1,
          completed: generatedContent ? 1 : 0,
          correct: generatedContent ? 1 : 0,
          timeSpent,
        };
        onComplete(result);
      }
    };
  }, [startTime, generatedContent, onComplete]);

  const handleToggleFavorite = useCallback(() => {
    const updated = toggleFavorite(localItem);
    setLocalItem(updated);
    onFavoriteChange?.(updated);
  }, [localItem, onFavoriteChange]);

  const handleGenerate = async (type: MnemonicType) => {
    if (!localItem.sourceContent) return;
    
    setIsGenerating(true);
    setError(null);
    setSelectedType(type);

    try {
      const content = await generateMnemonic(localItem.sourceContent, type);
      setGeneratedContent(content);
      
      const updated = createMnemonicItem(content, localItem.sourceContent, type);
      updated.id = localItem.id;
      updated.isFavorite = localItem.isFavorite;
      setLocalItem(updated);
    } catch (err) {
      if (err instanceof AIServiceError && !err.retryable) {
        setError('AI 功能暂不可用，请在设置中配置 DeepSeek API Key 后使用');
      } else {
        setError(err instanceof Error ? err.message : '生成失败，请重试');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(generatedContent);
    if (success) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    await shareMnemonic({
      ...localItem,
      content: generatedContent,
    });
  };

  const handleRegenerate = () => {
    handleGenerate(selectedType);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* 类型选择器 */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>
          选择记忆方式
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {MNEMONIC_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => handleGenerate(type.id)}
              disabled={isGenerating}
              className={`p-3 rounded-lg text-center transition-all ${
                selectedType === type.id
                  ? 'ring-2 ring-offset-2'
                  : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: selectedType === type.id ? 'var(--color-primary)' : 'var(--color-card)',
                color: selectedType === type.id ? 'white' : 'var(--color-text)',
                // @ts-expect-error CSS custom property
                '--tw-ring-color': 'var(--color-primary)',
              }}
            >
              <span className="text-2xl block mb-1">{type.icon}</span>
              <span className="text-xs font-medium">{type.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 口诀卡片 */}
      <div
        className="rounded-xl shadow-lg overflow-hidden"
        style={{ backgroundColor: 'var(--color-card)' }}
      >
        {/* 头部 */}
        <div
          className="px-6 py-4 flex justify-between items-center"
          style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">
              {MNEMONIC_TYPES.find(t => t.id === selectedType)?.icon || '🧠'}
            </span>
            <div>
              <h4 className="font-bold">
                {MNEMONIC_TYPES.find(t => t.id === selectedType)?.name || '记忆口诀'}
              </h4>
              <p className="text-xs opacity-80">
                {MNEMONIC_TYPES.find(t => t.id === selectedType)?.description}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleFavorite}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
            title={localItem.isFavorite ? '取消收藏' : '收藏'}
          >
            <span className="text-xl">{localItem.isFavorite ? '⭐' : '☆'}</span>
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-6">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div
                className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 mb-4"
                style={{ borderColor: 'var(--color-primary)' }}
              />
              <p style={{ color: 'var(--color-secondary)' }}>AI 正在生成口诀...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="mb-4" style={{ color: 'var(--color-error)' }}>{error}</p>
              <button
                onClick={handleRegenerate}
                className="px-4 py-2 rounded-lg text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                重新生成
              </button>
            </div>
          ) : (
            <div
              className="text-lg leading-relaxed whitespace-pre-line min-h-[120px]"
              style={{ color: 'var(--color-text)' }}
            >
              {generatedContent || '点击上方按钮生成口诀'}
            </div>
          )}
        </div>

        {/* 操作栏 */}
        {generatedContent && !isGenerating && (
          <div
            className="px-6 py-4 flex justify-between items-center border-t"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{ 
                  backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-text)'
                }}
              >
                {showCopied ? (
                  <>
                    <svg className="w-4 h-4" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    已复制
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    复制
                  </>
                )}
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{ 
                  backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-text)'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                分享
              </button>
            </div>
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-white transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              重新生成
            </button>
          </div>
        )}
      </div>

      {/* 原文摘要 */}
      <div
        className="mt-4 p-4 rounded-lg"
        style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
      >
        <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
          📄 原文内容
        </h4>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-secondary)' }}>
          {localItem.sourceContent.length > 200
            ? localItem.sourceContent.substring(0, 200) + '...'
            : localItem.sourceContent}
        </p>
      </div>
    </div>
  );
}

export default Mnemonic;
