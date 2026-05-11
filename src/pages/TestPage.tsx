/**
 * 测试页面 - 用于调试数据库功能
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Question, FavoriteQuestion } from '../types';
import { 
  getAllFavorites, 
  saveFavorite, 
  deleteFavorite 
} from '../services/storage/indexedDB';
import { isFavorited, toggleFavorite } from '../services/learning/favorite';
import { openDatabase } from '../services/storage/indexedDB';

export default function TestPage() {
  const [favorites, setFavorites] = useState<FavoriteQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<string>('');

  // 测试题目
  const testQuestion: Question = {
    id: 'test-123',
    question: '这是一个测试题目吗？',
    options: ['是', '不是', '可能', '不知道'],
    correctAnswer: '是',
    explanation: '这确实是一个测试题目',
    type: 'choice'
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  async function loadFavorites() {
    try {
      const favs = await getAllFavorites();
      setFavorites(favs);
      setTestResult(`加载成功：找到 ${favs.length} 个收藏`);
    } catch (error) {
      console.error('加载收藏失败:', error);
      setTestResult(`加载失败：${error}`);
    } finally {
      setLoading(false);
    }
  }

  async function testAddFavorite() {
    try {
      const favorite: FavoriteQuestion = {
        id: `fav-${Date.now()}`,
        questionId: testQuestion.id,
        question: testQuestion,
        category: 'default',
        sourceType: 'quiz',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await saveFavorite(favorite);
      await loadFavorites();
      setTestResult('添加收藏成功');
    } catch (error) {
      console.error('添加收藏失败:', error);
      setTestResult(`添加收藏失败：${error}`);
    }
  }

  async function testToggleFavorite() {
    try {
      const result = await toggleFavorite(testQuestion, 'default', 'quiz');
      await loadFavorites();
      setTestResult(`切换收藏成功：${result ? '已收藏' : '已取消收藏'}`);
    } catch (error) {
      console.error('切换收藏失败:', error);
      setTestResult(`切换收藏失败：${error}`);
    }
  }

  async function testIsFavorited() {
    try {
      const isFav = await isFavorited(testQuestion.id);
      setTestResult(`收藏状态：${isFav ? '已收藏' : '未收藏'}`);
    } catch (error) {
      console.error('检查收藏状态失败:', error);
      setTestResult(`检查收藏状态失败：${error}`);
    }
  }

  async function testDatabaseConnection() {
    try {
      const db = await openDatabase();
      setTestResult(`数据库连接成功：${db.name} v${db.version}`);
    } catch (error) {
      console.error('数据库连接失败:', error);
      setTestResult(`数据库连接失败：${error}`);
    }
  }

  async function clearTestFavorites() {
    try {
      const testFavs = favorites.filter(f => f.questionId === testQuestion.id);
      for (const fav of testFavs) {
        await deleteFavorite(fav.id);
      }
      await loadFavorites();
      setTestResult('清除测试收藏成功');
    } catch (error) {
      console.error('清除收藏失败:', error);
      setTestResult(`清除收藏失败：${error}`);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Link to="/" className="mr-4 p-2 rounded-full hover:opacity-80">
              <svg className="w-6 h-6" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>🧪 数据库测试</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: 'var(--color-card)' }}>
          <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text)' }}>测试题目</h2>
          <p className="mb-2" style={{ color: 'var(--color-text)' }}>{testQuestion.question}</p>
          <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>正确答案：{testQuestion.correctAnswer}</p>
        </div>

        <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: 'var(--color-card)' }}>
          <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text)' }}>测试操作</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button onClick={testDatabaseConnection} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-secondary)' }}>
              测试数据库连接
            </button>
            <button onClick={testAddFavorite} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
              直接添加收藏
            </button>
            <button onClick={testToggleFavorite} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-success)' }}>
              切换收藏状态
            </button>
            <button onClick={testIsFavorited} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-warning)' }}>
              检查收藏状态
            </button>
            <button onClick={clearTestFavorites} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-error)' }}>
              清除测试收藏
            </button>
          </div>
          
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
            <p className="text-sm font-mono" style={{ color: 'var(--color-text)' }}>{testResult}</p>
          </div>
        </div>

        <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--color-card)' }}>
          <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text)' }}>
            当前收藏 ({favorites.length})
          </h2>
          <div className="space-y-2">
            {favorites.length === 0 ? (
              <p style={{ color: 'var(--color-secondary)' }}>暂无收藏</p>
            ) : (
              favorites.map(fav => (
                <div key={fav.id} className="p-3 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>{fav.question.question}</p>
                  <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                    分类：{fav.category} | 时间：{new Date(fav.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
