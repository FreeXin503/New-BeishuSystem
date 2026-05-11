/**
 * 统计页面
 */

import { useState, useEffect } from 'react';
import Dashboard from '../components/statistics/Dashboard';
import { AppLayout } from '../components/layout';
import { calculateStatistics } from '../services/statistics/tracker';
import type { Statistics } from '../types';

export default function StatisticsPage() {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  async function loadStatistics() {
    try {
      const { getAllStudySessions, getAllContents, getAllReviewCards } = await import('../services/storage/indexedDB');
      const [sessions, contents, cards] = await Promise.all([
        getAllStudySessions(),
        getAllContents(),
        getAllReviewCards(),
      ]);
      const stats = calculateStatistics(sessions, contents, cards);
      setStatistics(stats);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout title="学习统计">
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : statistics ? (
          <Dashboard statistics={statistics} />
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">暂无统计数据</p>
          </div>
        )}
      </main>
    </AppLayout>
  );
}
