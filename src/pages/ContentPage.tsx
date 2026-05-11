/**
 * 内容输入页面
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContentStore } from '../stores/useContentStore';
import { parseContent, parseContentByChapters } from '../services/ai/parser';
import { AIServiceError } from '../services/ai/deepseek';
import { AppLayout } from '../components/layout';
import type { ParsedContent } from '../types';

export default function ContentPage() {
  const navigate = useNavigate();
  const { addContent } = useContentStore();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parseMode, setParseMode] = useState<'full' | 'chapter'>('full');
  const [activeTab, setActiveTab] = useState<'text' | 'quiz' | 'fillblank'>('text');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!text.trim()) {
      setError('请输入政治文本内容');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const parsed = parseMode === 'chapter' 
        ? await parseContentByChapters(text)
        : await parseContent(text);
      
      const content: ParsedContent = {
        id: `content-${Date.now()}`,
        title: title.trim() || parsed.title || '未命名内容',
        chapters: parsed.chapters,
        keywords: parsed.keywords,
        concepts: parsed.concepts,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      addContent(content);
      
      const { saveContent } = await import('../services/storage/indexedDB');
      await saveContent(content);

      navigate(`/learning/${content.id}`);
    } catch (err) {
      if (err instanceof AIServiceError && !err.retryable) {
        setError('AI 功能暂不可用，请在设置中配置 DeepSeek API Key 后使用');
      } else {
        setError(err instanceof Error ? err.message : '解析失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout title="添加学习内容" showBack onBack={() => navigate('/')}>
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* 功能选择标签页 */}
        <div className="mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('text')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'text'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  文本内容
                </div>
              </button>
              <button
                onClick={() => setActiveTab('quiz')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'quiz'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2v2a2 2 0 002 2h-2" />
                  </svg>
                  选择题
                </div>
              </button>
              <button
                onClick={() => setActiveTab('fillblank')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'fillblank'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-4a1 1 0 011-1v-2a1 1 0 00-1-1zM7 19a2 2 0 002 2v-2a1 1 0 011-1v-2a1 1 0 00-1-1v-4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 001 1v2a1 1 0 001 1v2a2 2 0 002-2z" />
                  </svg>
                  填空题
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* 文本内容区域 */}
        {activeTab === 'text' && (
          <form onSubmit={handleSubmit} className="space-y-6">
          {/* 标题输入 */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium"
              style={{ color: 'var(--color-text)' }}
            >
              标题（可选）
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入内容标题"
              className="mt-1 block w-full rounded-md shadow-sm focus:ring-2 sm:text-sm p-3"
              style={{ 
                backgroundColor: 'var(--color-card)', 
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)'
              }}
            />
          </div>

          {/* 内容输入 */}
          <div>
            <label
              htmlFor="content"
              className="block text-sm font-medium"
              style={{ color: 'var(--color-text)' }}
            >
              政治文本内容
            </label>
            <textarea
              id="content"
              rows={15}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="粘贴或输入政治学习内容，AI 将自动解析并生成学习材料..."
              className="mt-1 block w-full rounded-md shadow-sm focus:ring-2 sm:text-sm p-3"
              style={{ 
                backgroundColor: 'var(--color-card)', 
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)'
              }}
            />
            <p className="mt-2 text-sm" style={{ color: 'var(--color-secondary)' }}>
              支持输入教材内容、考试大纲、知识点总结等政治学习材料
            </p>
          </div>

          {/* 解析模式选择 */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              解析模式
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="parseMode"
                  value="full"
                  checked={parseMode === 'full'}
                  onChange={() => setParseMode('full')}
                  className="mr-2"
                />
                <span style={{ color: 'var(--color-text)' }}>整体分析</span>
                <span className="ml-1 text-xs" style={{ color: 'var(--color-secondary)' }}>
                  （适合短文本）
                </span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="parseMode"
                  value="chapter"
                  checked={parseMode === 'chapter'}
                  onChange={() => setParseMode('chapter')}
                  className="mr-2"
                />
                <span style={{ color: 'var(--color-text)' }}>按章节分析</span>
                <span className="ml-1 text-xs" style={{ color: 'var(--color-secondary)' }}>
                  （适合长文本，更精细）
                </span>
              </label>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="rounded-md p-4" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-error)' }}>
              <div className="flex">
                <svg className="h-5 w-5" style={{ color: 'var(--color-error)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="ml-3">
                  <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* 提交按钮 */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  AI 解析中...
                </>
              ) : (
                <>
                  <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  开始解析
                </>
              )}
            </button>
          </div>
        </form>
        )}

        {/* 选择题区域 */}
        {activeTab === 'quiz' && (
          <div className="space-y-6">
            <div className="text-center py-12">
              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2v2a2 2 0 002 2h-2" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                导入选择题
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                粘贴选择题文本，系统将自动解析题目和选项，生成可练习的选择题库
              </p>
              <button
                onClick={() => navigate('/quiz-import')}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-medium rounded-xl hover:from-teal-600 hover:to-cyan-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                开始导入选择题
              </button>
            </div>
          </div>
        )}

        {/* 填空题区域 */}
        {activeTab === 'fillblank' && (
          <div className="space-y-6">
            <div className="text-center py-12">
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-4a1 1 0 011-1v-2a1 1 0 00-1-1zM7 19a2 2 0 002 2v-2a1 1 0 011-1v-2a1 1 0 00-1-1v-4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 001 1v2a1 1 0 001 1v2a2 2 0 002-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                填空题管理
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                手动添加或批量导入填空题，进行专项练习，提高记忆效果
              </p>
              <button
                onClick={() => navigate('/fill-blank-import')}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-blue-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                管理填空题
              </button>
            </div>
          </div>
        )}

        {/* 使用说明 - 只在文本内容标签页显示 */}
        {activeTab === 'text' && (
          <div className="mt-8 rounded-lg p-6" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text)' }}>
              使用说明
            </h3>
            <ul className="space-y-2 text-sm" style={{ color: 'var(--color-secondary)' }}>
              <li className="flex items-start">
                <svg className="h-5 w-5 mr-2 flex-shrink-0" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                AI 会自动识别章节结构，提取关键词和概念
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 mr-2 flex-shrink-0" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                自动生成挖空填词、选择题、术语配对等学习材料
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 mr-2 flex-shrink-0" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                支持生成记忆口诀，帮助快速记忆
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 mr-2 flex-shrink-0" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                基于 SM-2 算法智能安排复习计划
              </li>
            </ul>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
