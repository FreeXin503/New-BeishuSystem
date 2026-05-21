/**
 * 智能学习分析仪表盘 - Dashboard.tsx
 * 像素级对齐原型 `id="page-analytics"` 的深度可视化时空分析舱
 */

import { useMemo } from 'react';
import type { Statistics } from '../../types';
import { formatStudyTime } from '../../services/statistics/tracker';
import { getTrackedEvents } from '../../services/statistics/eventTracker';

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

  // 1. 获取本地 eventTracker 打卡突变流，动态生成年度 365 天热力方阵
  const heatmapData = useMemo(() => {
    const events = getTrackedEvents();
    
    // 按日期 YYYY-MM-DD 归类事件
    const dateCounts: Record<string, number> = {};
    events.forEach((evt) => {
      try {
        const dStr = new Date(evt.at).toISOString().split('T')[0];
        dateCounts[dStr] = (dateCounts[dStr] || 0) + 1;
      } catch (e) {
        // 忽略无效日期
      }
    });

    // 生成过去 365 天的连续日期序列 (为了排版整洁，我们生成 160 个最新的方格对齐原型栅格)
    const totalBlocks = 168; // 24 列 * 7 天 刚好对齐栅格
    const blocks: { date: string; count: number; opacity: number }[] = [];
    const today = new Date();

    for (let i = totalBlocks - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const count = dateCounts[dStr] || 0;
      
      // 根据活跃次数计算透明度级别
      let opacity = 0.08; // 默认极浅占位色
      if (count > 0) {
        if (count === 1) opacity = 0.25;
        else if (count === 2) opacity = 0.5;
        else if (count < 5) opacity = 0.75;
        else opacity = 1.0;
      }

      blocks.push({
        date: dStr,
        count,
        opacity,
      });
    }

    return blocks;
  }, []);

  // 2. 双排自适应学术认知图谱分量模拟
  const cognitiveFactorBars = useMemo(() => {
    // 基于真实 chapterMastery 生成高保真纯色柱状图，若为空则提供默认学术分量
    if (chapterMastery && chapterMastery.length > 0) {
      return chapterMastery.map((c, idx) => ({
        label: c.chapterTitle.slice(0, 8) + (c.chapterTitle.length > 8 ? '...' : ''),
        value: c.masteryLevel,
        color: idx % 2 === 0 ? 'bg-brand-primary' : 'bg-brand-accent',
      }));
    }
    
    return [
      { label: 'CET-6 核心词汇', value: 88, color: 'bg-brand-primary' },
      { label: '填空弱项拼写', value: 72, color: 'bg-brand-accent' },
      { label: '同义学术辨析', value: 95, color: 'bg-brand-primary' },
      { label: '政治考点主观', value: 64, color: 'bg-brand-accent' },
    ];
  }, [chapterMastery]);

  return (
    <div className="space-y-10 page-fade-in">
      
      {/* 四维量化指标大卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-master p-6 border border-workspace-border shadow-panel-flat space-y-4 hover:-translate-y-0.5 transition-all">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 text-brand-primary flex items-center justify-center text-xl font-bold">⏱️</div>
          <div>
            <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{formatStudyTime(totalStudyTime)}</h4>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">总有效专注时长</p>
          </div>
        </div>

        <div className="bg-white rounded-master p-6 border border-workspace-border shadow-panel-flat space-y-4 hover:-translate-y-0.5 transition-all">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-feedback-success flex items-center justify-center text-xl font-bold">🎯</div>
          <div>
            <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{accuracyRate}%</h4>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">混合平均正确率</p>
          </div>
        </div>

        <div className="bg-white rounded-master p-6 border border-workspace-border shadow-panel-flat space-y-4 hover:-translate-y-0.5 transition-all">
          <div className="h-10 w-10 rounded-xl bg-purple-50 text-indigo-600 flex items-center justify-center text-xl font-bold">📝</div>
          <div>
            <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{totalCorrect} / {totalQuestions}</h4>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">有效吞吐突变数</p>
          </div>
        </div>

        <div className="bg-white rounded-master p-6 border border-workspace-border shadow-panel-flat space-y-4 hover:-translate-y-0.5 transition-all">
          <div className="h-10 w-10 rounded-xl bg-orange-50 text-feedback-warning flex items-center justify-center text-xl font-bold">🔥</div>
          <div>
            <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{streakDays} 天</h4>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">全天候持续热力打卡</p>
          </div>
        </div>
      </div>

      {/* 核心热力学方块矩阵大卡片 */}
      <div className="bg-white rounded-master p-8 md:p-10 border border-workspace-border shadow-panel-flat space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">海马体量化分布式打卡热力图</h3>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">
              实时追踪记录您在 Independent Sandbox 发生的每一个突变状态修改
            </p>
          </div>
          <span className="text-xs font-black text-brand-primary bg-indigo-50 px-4 py-1.5 rounded-full uppercase tracking-wider">
            当前累积坚持打卡 {streakDays} 天
          </span>
        </div>

        {/* 年度热力网格 */}
        <div className="flex flex-col space-y-2 pt-2">
          <div className="flex flex-wrap gap-1.5 no-scrollbar max-w-full overflow-x-auto justify-start">
            {heatmapData.map((item, index) => (
              <div
                key={index}
                title={`${item.date} : 发生 ${item.count} 次突变修改`}
                className="h-3.5 w-3.5 rounded-[3px] transition-all hover:scale-115 cursor-pointer"
                style={{
                  backgroundColor: `rgba(16, 185, 129, ${item.opacity})`,
                }}
              />
            ))}
          </div>
          <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-2 pr-1">
            <span>极浅</span>
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)' }} />
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: 'rgba(16, 185, 129, 0.25)' }} />
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: 'rgba(16, 185, 129, 0.5)' }} />
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: 'rgba(16, 185, 129, 0.75)' }} />
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: 'rgba(16, 185, 129, 1.0)' }} />
            <span>高亮</span>
          </div>
        </div>
      </div>

      {/* 底部仿图谱混合区：左侧柱状图，右侧奖杯大卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 左侧：海马体遗忘因子收敛指数分量柱状图 */}
        <div className="lg:col-span-7 bg-white rounded-master p-8 md:p-10 border border-workspace-border shadow-panel-flat space-y-8 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">记忆遗忘因子收敛指数</h3>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">基于各学科或章节的艾宾浩斯复写率加权均值分量</p>
          </div>

          <div className="flex items-end justify-between gap-4 h-64 px-4 pt-6">
            {cognitiveFactorBars.map((bar, index) => (
              <div key={index} className="flex flex-col items-center gap-3 flex-1 group">
                <div className="w-full bg-slate-50 border border-slate-100 rounded-t-xl h-48 flex items-end justify-center relative overflow-hidden">
                  <div
                    className={`${bar.color} w-full rounded-t-lg transition-all duration-1000 ease-out group-hover:opacity-90 relative`}
                    style={{ height: `${bar.value}%` }}
                  >
                    <div className="absolute top-2 left-0 right-0 text-[10px] font-black text-white text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {bar.value}%
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 text-center tracking-tighter truncate max-w-full">
                  {bar.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：深蓝色客选题型正确率收敛汇总奖杯卡片 */}
        <div className="lg:col-span-5 bg-gradient-to-br from-indigo-950 to-brand-dark rounded-master p-10 text-white flex flex-col justify-between relative overflow-hidden shadow-xl">
          <div className="absolute -right-6 -top-6 h-40 w-40 bg-indigo-500/20 rounded-full blur-3xl"></div>
          
          <div className="space-y-4 relative z-10">
            <span className="px-3 py-1 bg-brand-primary rounded-full text-[10px] font-bold text-indigo-300 uppercase tracking-widest border border-indigo-500/30">
              Cognitive Award Panel
            </span>
            <h2 className="text-4xl font-bold tracking-tight pt-2">收敛达成汇总</h2>
            <p className="text-indigo-200/80 text-sm leading-relaxed pt-2">
              通过对今日答题行为以及离线事务队列的加权评估，您的遗忘曲线已实现高效拦截，客选题型精度达到最优边界。
            </p>
          </div>

          <div className="pt-8 flex items-center justify-between relative z-10 gap-6">
            <div className="space-y-1">
              <span className="text-5xl font-black block tracking-tight">{accuracyRate}%</span>
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">综合准确率收敛</span>
            </div>
            <div className="text-5xl animate-bounce duration-1000">
              🏆
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
