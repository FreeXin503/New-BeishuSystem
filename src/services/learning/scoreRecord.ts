/**
 * 得分记录服务
 */

import type { ScoreRecord, LearningMode } from '../../types';

// 内存缓存当前会话的得分记录
let sessionScores: ScoreRecord[] = [];

/**
 * 记录单次答题得分
 */
export function recordScore(params: {
  userId: string;
  contentId: string;
  sessionId: string;
  mode: LearningMode;
  questionId: string;
  questionType: ScoreRecord['questionType'];
  isCorrect: boolean;
  responseTime: number;
}): ScoreRecord {
  const score: ScoreRecord = {
    id: `score-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId: params.userId,
    contentId: params.contentId,
    sessionId: params.sessionId,
    mode: params.mode,
    questionId: params.questionId,
    questionType: params.questionType,
    score: params.isCorrect ? 100 : 0,
    isCorrect: params.isCorrect,
    responseTime: params.responseTime,
    timestamp: new Date(),
  };

  sessionScores.push(score);
  return score;
}

/**
 * 获取当前会话的所有得分
 */
export function getSessionScores(): ScoreRecord[] {
  return [...sessionScores];
}

/**
 * 清空当前会话得分
 */
export function clearSessionScores(): void {
  sessionScores = [];
}

/**
 * 计算会话统计
 */
export function calculateSessionStats(scores: ScoreRecord[]): {
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  averageTime: number;
  totalScore: number;
} {
  if (scores.length === 0) {
    return { totalQuestions: 0, correctCount: 0, accuracy: 0, averageTime: 0, totalScore: 0 };
  }

  const correctCount = scores.filter(s => s.isCorrect).length;
  const totalTime = scores.reduce((sum, s) => sum + s.responseTime, 0);
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);

  return {
    totalQuestions: scores.length,
    correctCount,
    accuracy: Math.round((correctCount / scores.length) * 100),
    averageTime: Math.round(totalTime / scores.length),
    totalScore,
  };
}

/**
 * 按题型分组统计
 */
export function getStatsByType(scores: ScoreRecord[]): Record<string, {
  count: number;
  correct: number;
  accuracy: number;
}> {
  const grouped: Record<string, ScoreRecord[]> = {};
  
  scores.forEach(score => {
    if (!grouped[score.questionType]) {
      grouped[score.questionType] = [];
    }
    grouped[score.questionType].push(score);
  });

  const result: Record<string, { count: number; correct: number; accuracy: number }> = {};
  
  Object.entries(grouped).forEach(([type, typeScores]) => {
    const correct = typeScores.filter(s => s.isCorrect).length;
    result[type] = {
      count: typeScores.length,
      correct,
      accuracy: Math.round((correct / typeScores.length) * 100),
    };
  });

  return result;
}
