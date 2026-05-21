/**
 * 量化时空看板 - StatisticsPage.tsx
 * 像素级对齐原型 `id="page-analytics"` 的深度统计中台
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
    void loadStatistics();
  }, []);

  async function loadStatistics() {
    setLoading(true);
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
    <AppLayout title="量化时空看板">
      <div className="page-fade-in p-8 md:p-12 max-w-6xl mx-auto space-y-10">
        
        {/* 通栏标题 */}
        <header className="border-b border-slate-200/60 pb-8 flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">量化时空轴</h2>
            <p className="text-slate-500 mt-2 text-sm">事务队列吞吐量监测与分布式高阶突变矩阵</p>
          </div>
        </header>

        {loading ? (
          /* 大厂级骨架屏 */
          <div className="space-y-8 animate-pulse">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 bg-slate-100 rounded-master border border-slate-100" />
              ))}
            </div>
            <div className="h-64 bg-slate-100 rounded-master w-full" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 h-64 bg-slate-100 rounded-master" />
              <div className="lg:col-span-5 h-64 bg-slate-100 rounded-master" />
            </div>
          </div>
        ) : statistics ? (
          <Dashboard statistics={statistics} />
        ) : (
          <div className="text-center py-12 bg-white rounded-master border border-workspace-border shadow-panel-flat">
            <p className="text-slate-400 font-bold">暂无有效打卡或突变操作记录</p>
            <p className="text-xs text-slate-400 mt-1">在工作台或复习大厅答题后，统计将自动解锁</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
