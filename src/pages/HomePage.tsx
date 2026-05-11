/**
 * 首页 - 复习提醒和快速入口
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUserStore } from '../stores/useUserStore';
import { useContentStore } from '../stores/useContentStore';
import { getDueCards } from '../services/sm2/scheduler';
import { AppLayout } from '../components/layout';
import type { ReviewCard } from '../types';

export default function HomePage() {
  const { user, isGuest } = useUserStore();
  const { contents } = useContentStore();
  const [dueCards, setDueCards] = useState<ReviewCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDueCards();
  }, []);

  async function loadDueCards() {
    try {
      const { getAllReviewCards } = await import('../services/storage/indexedDB');
      const allCards = await getAllReviewCards();
      const due = getDueCards(allCards);
      setDueCards(due);
    } catch (error) {
      console.error('加载待复习卡片失败:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* 欢迎横幅 */}
        <div className="mb-12 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-3xl p-8 text-white shadow-2xl transform hover:scale-105 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-100">
                智慧学习平台
              </h1>
              <p className="text-xl text-blue-100 max-w-2xl">
                用AI赋能学习，让政治背诵更高效、更有趣
              </p>
            </div>
            <div className="hidden lg:block">
              <svg className="w-32 h-32 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c14.754 18 13.168 17.523 12 16.753V3.747z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 用户信息 */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            {isGuest ? (
              <Link
                to="/login"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4 4m-4-4v4m0 0h6a2 2 0 002-2V7a2 2 0 00-2-2h-2m-6 0a2 2 0 00-2 2v10a2 2 0 002 2h6" />
                </svg>
                立即登录
              </Link>
            ) : (
              <div className="flex items-center space-x-3 px-6 py-3 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
                <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.email}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">欢迎回来</p>
                </div>
              </div>
            )}
          </div>
          <Link
            to="/settings"
            className="p-3 rounded-full bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transform hover:scale-110 transition-all duration-200 border border-gray-200 dark:border-gray-700"
          >
            <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
          </Link>
        </div>

        {/* 待复习提醒 */}
        {dueCards.length > 0 && (
          <div className="mb-8 rounded-lg p-4" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-warning)' }}>
            <div className="flex items-center">
              <svg className="w-6 h-6 mr-3" style={{ color: 'var(--color-warning)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>
                  待复习提醒
                </h3>
                <p style={{ color: 'var(--color-secondary)' }}>
                  您有 {dueCards.length} 张卡片需要复习
                </p>
              </div>
              <Link
                to="/learning"
                className="ml-auto px-4 py-2 text-white rounded-lg hover:opacity-90"
                style={{ backgroundColor: 'var(--color-warning)' }}
              >
                开始复习
              </Link>
            </div>
          </div>
        )}

        {/* 快速入口 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 添加内容 */}
          <Link
            to="/content"
            className="group bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-2xl p-6 shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border border-blue-100"
          >
            <div className="flex items-center mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg group-hover:scale-110 transition-transform duration-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h2 className="ml-4 text-lg font-bold text-gray-800">
                添加内容
              </h2>
            </div>
            <p className="text-gray-600 group-hover:text-gray-700 transition-colors">
              输入政治文本，AI 自动解析生成学习材料
            </p>
            <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
              <span>智能解析</span>
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* 开始学习 */}
          <Link
            to="/learning"
            className="group bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-2xl p-6 shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border border-green-100"
          >
            <div className="flex items-center mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg group-hover:scale-110 transition-transform duration-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="ml-4 text-lg font-bold text-gray-800">
                开始学习
              </h2>
            </div>
            <p className="text-gray-600 group-hover:text-gray-700 transition-colors">
              选择学习模式，开始高效记忆
            </p>
            <div className="mt-4 flex items-center text-green-600 text-sm font-medium">
              <span>6种模式</span>
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* 学习统计 */}
          <Link
            to="/statistics"
            className="group bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-2xl p-6 shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border border-purple-100"
          >
            <div className="flex items-center mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg group-hover:scale-110 transition-transform duration-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="ml-4 text-lg font-bold text-gray-800">
                学习统计
              </h2>
            </div>
            <p className="text-gray-600 group-hover:text-gray-700 transition-colors">
              查看学习进度和掌握情况
            </p>
            <div className="mt-4 flex items-center text-purple-600 text-sm font-medium">
              <span>数据分析</span>
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* 复习中心 */}
          <Link
            to="/review"
            className="group bg-gradient-to-br from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 rounded-2xl p-6 shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border border-orange-100"
          >
            <div className="flex items-center mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg group-hover:scale-110 transition-transform duration-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h2 className="ml-4 text-lg font-bold text-gray-800">
                复习中心
              </h2>
            </div>
            <p className="text-gray-600 group-hover:text-gray-700 transition-colors">
              错题集锦，收藏管理
            </p>
            <div className="mt-4 flex items-center text-orange-600 text-sm font-medium">
              <span>智能复习</span>
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* SynoMaster 同义词学习 */}
          <Link
            to="/synomaster"
            className="group bg-gradient-to-br from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100 rounded-2xl p-6 shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border border-teal-100"
          >
            <div className="flex items-center mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg group-hover:scale-110 transition-transform duration-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="ml-4 text-lg font-bold text-gray-800">
                SynoMaster
              </h2>
            </div>
            <p className="text-gray-600 group-hover:text-gray-700 transition-colors">
              游戏化同义词学习，高效记忆词汇簇
            </p>
            <div className="mt-4 flex items-center text-teal-600 text-sm font-medium">
              <span>3种模式</span>
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* 中文拼写练习 */}
          <Link
            to="/chinese-spelling"
            className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border border-gray-100"
          >
            <div className="flex items-center mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg group-hover:scale-110 transition-transform duration-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h2 className="ml-4 text-lg font-bold text-gray-800">
                中文拼写
              </h2>
            </div>
            <p className="text-gray-600 group-hover:text-gray-700 transition-colors">
              看英文拼写中文，Alt键提示，空格跳转
            </p>
            <div className="mt-4 flex items-center text-orange-600 text-sm font-medium">
              <span>2种模式</span>
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          </div>

        {/* 最近学习内容 */}
        {contents.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
              最近学习内容
            </h2>
            <div className="rounded-lg shadow overflow-hidden" style={{ backgroundColor: 'var(--color-card)' }}>
              <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {contents.slice(0, 5).map((content) => (
                  <li key={content.id} style={{ borderColor: 'var(--color-border)' }}>
                    <Link
                      to={`/learning/${content.id}`}
                      className="block px-6 py-4 hover:opacity-90"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>
                            {content.title}
                          </h3>
                          <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                            {content.chapters.length} 个章节 · {content.keywords.length} 个关键词
                          </p>
                        </div>
                        <svg className="w-5 h-5" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 空状态 */}
        {contents.length === 0 && !loading && (
          <div className="mt-8 text-center py-12">
            <svg className="mx-auto h-12 w-12" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              还没有学习内容
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-secondary)' }}>
              开始添加政治文本，AI 将帮您生成学习材料
            </p>
            <div className="mt-6">
              <Link
                to="/content"
                className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-white hover:opacity-90"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                添加内容
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
