/**
 * 统计仪表盘组件
 */

import type { Statistics } from '../../types';
import { formatStudyTime } from '../../services/statistics/tracker';

interface DashboardProps {
  statistics: Statistics;
}

export function Dashboard({ statistics }: DashboardProps) {
  const {
    totalStudyTime,
    totalCorrect,
    totalQuestions,
    accuracyRate,
    streakDays,
    chapterMastery,
  } = statistics;

  return (
    <div className="dashboard p-4 space-y-6">
      {/* 概览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="总学习时长"
          value={formatStudyTime(totalStudyTime)}
          icon="⏱️"
          color="blue"
        />
        <StatCard
          title="正确率"
          value={`${accuracyRate}%`}
          icon="✓"
          color="green"
        />
        <StatCard
          title="答题数"
          value={`${totalCorrect}/${totalQuestions}`}
          icon="📝"
          color="purple"
        />
        <StatCard
          title="连续学习"
          value={`${streakDays}天`}
          icon="🔥"
          color="orange"
        />
      </div>

      {/* 章节掌握度 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-4">章节掌握度</h3>
        <div className="space-y-3">
          {chapterMastery.length > 0 ? (
            chapterMastery.map((chapter) => (
              <div key={chapter.chapterId}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">{chapter.chapterTitle}</span>
                  <span className="text-gray-800 dark:text-gray-200">{chapter.masteryLevel}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      chapter.masteryLevel >= 80
                        ? 'bg-green-500'
                        : chapter.masteryLevel >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${chapter.masteryLevel}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              暂无学习数据
            </p>
          )}
        </div>
      </div>

      {/* 正确率趋势图（简化版） */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-4">学习概况</h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>总共完成 {totalQuestions} 道题目</p>
          <p>正确 {totalCorrect} 道，正确率 {accuracyRate}%</p>
        </div>
      </div>
    </div>
  );
}

// 统计卡片组件
interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  };

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-sm opacity-80">{title}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export default Dashboard;
