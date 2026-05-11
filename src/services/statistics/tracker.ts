/**
 * 统计追踪服务
 */

import type { StudySession, Statistics, ChapterMastery, ReviewCard, ParsedContent } from '../../types';

/**
 * 计算总学习时长（秒）
 */
export function calculateTotalStudyTime(sessions: StudySession[]): number {
  return sessions.reduce((total, session) => total + session.duration, 0);
}

/**
 * 计算总正确数
 */
export function calculateTotalCorrect(sessions: StudySession[]): number {
  return sessions.reduce((total, session) => total + session.correctCount, 0);
}

/**
 * 计算总题目数
 */
export function calculateTotalQuestions(sessions: StudySession[]): number {
  return sessions.reduce((total, session) => total + session.totalCount, 0);
}

/**
 * 计算正确率
 */
export function calculateAccuracyRate(sessions: StudySession[]): number {
  const totalCorrect = calculateTotalCorrect(sessions);
  const totalQuestions = calculateTotalQuestions(sessions);
  
  if (totalQuestions === 0) return 0;
  return Math.round((totalCorrect / totalQuestions) * 100);
}

/**
 * 计算连续学习天数
 */
export function calculateStreakDays(sessions: StudySession[]): number {
  if (sessions.length === 0) return 0;

  // 按日期分组
  const dateSet = new Set<string>();
  sessions.forEach((session) => {
    const date = new Date(session.startedAt);
    dateSet.add(date.toISOString().split('T')[0]);
  });

  const dates = Array.from(dateSet).sort().reverse();
  
  if (dates.length === 0) return 0;

  // 检查今天是否有学习
  const today = new Date().toISOString().split('T')[0];
  if (dates[0] !== today) {
    // 检查昨天
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dates[0] !== yesterday.toISOString().split('T')[0]) {
      return 0;
    }
  }

  // 计算连续天数
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const current = new Date(dates[i - 1]);
    const prev = new Date(dates[i]);
    const diffDays = Math.floor((current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * 计算章节掌握度
 */
export function calculateChapterMastery(
  contents: ParsedContent[],
  cards: ReviewCard[]
): ChapterMastery[] {
  const masteryMap = new Map<string, { total: number; mastered: number; title: string }>();

  // 初始化章节
  contents.forEach((content) => {
    content.chapters.forEach((chapter) => {
      masteryMap.set(chapter.id, {
        total: 0,
        mastered: 0,
        title: chapter.title,
      });
    });
  });

  // 统计卡片
  cards.forEach((card) => {
    // 假设 cardData 中有 chapterId
    const chapterId = (card.cardData as { chapterId?: string }).chapterId;
    if (chapterId && masteryMap.has(chapterId)) {
      const data = masteryMap.get(chapterId)!;
      data.total++;
      // easeFactor >= 2.5 且 repetitions >= 3 视为掌握
      if (card.easeFactor >= 2.5 && card.repetitions >= 3) {
        data.mastered++;
      }
    }
  });

  return Array.from(masteryMap.entries()).map(([chapterId, data]) => ({
    chapterId,
    chapterTitle: data.title,
    masteryLevel: data.total > 0 ? Math.round((data.mastered / data.total) * 100) : 0,
    totalCards: data.total,
    masteredCards: data.mastered,
  }));
}

/**
 * 计算完整统计数据
 */
export function calculateStatistics(
  sessions: StudySession[],
  contents: ParsedContent[],
  cards: ReviewCard[]
): Statistics {
  const totalCorrect = calculateTotalCorrect(sessions);
  const totalQuestions = calculateTotalQuestions(sessions);

  return {
    totalStudyTime: calculateTotalStudyTime(sessions),
    totalCorrect,
    totalQuestions,
    accuracyRate: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    streakDays: calculateStreakDays(sessions),
    chapterMastery: calculateChapterMastery(contents, cards),
  };
}

/**
 * 格式化学习时长
 */
export function formatStudyTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}分钟`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}小时${remainingMinutes > 0 ? `${remainingMinutes}分钟` : ''}`;
}

/**
 * 获取今日学习数据
 */
export function getTodayStats(sessions: StudySession[]): {
  studyTime: number;
  correctCount: number;
  totalCount: number;
} {
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter((s) => {
    const sessionDate = new Date(s.startedAt).toISOString().split('T')[0];
    return sessionDate === today;
  });

  return {
    studyTime: calculateTotalStudyTime(todaySessions),
    correctCount: calculateTotalCorrect(todaySessions),
    totalCount: calculateTotalQuestions(todaySessions),
  };
}

/**
 * 获取本周学习数据
 */
export function getWeeklyStats(sessions: StudySession[]): {
  dailyData: { date: string; studyTime: number; accuracy: number }[];
} {
  const weekData: Map<string, { studyTime: number; correct: number; total: number }> = new Map();
  
  // 初始化最近7天
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    weekData.set(dateStr, { studyTime: 0, correct: 0, total: 0 });
  }

  // 填充数据
  sessions.forEach((session) => {
    const dateStr = new Date(session.startedAt).toISOString().split('T')[0];
    if (weekData.has(dateStr)) {
      const data = weekData.get(dateStr)!;
      data.studyTime += session.duration;
      data.correct += session.correctCount;
      data.total += session.totalCount;
    }
  });

  return {
    dailyData: Array.from(weekData.entries()).map(([date, data]) => ({
      date,
      studyTime: data.studyTime,
      accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    })),
  };
}
