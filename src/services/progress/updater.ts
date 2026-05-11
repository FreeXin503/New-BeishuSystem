/**
 * 学习进度更新服务
 */

import type { ReviewCard, ContentProgress, LearningMode } from '../../types';
import { calculateSM2 } from '../sm2/scheduler';

/**
 * 更新卡片进度（正确答案）
 */
export function updateCardOnCorrect(
  card: ReviewCard,
  quality: number = 4 // 默认为"正确，有些犹豫"
): ReviewCard {
  const schedule = calculateSM2(card, quality);
  
  return {
    ...card,
    easeFactor: schedule.newEaseFactor,
    interval: schedule.newInterval,
    repetitions: schedule.newRepetitions,
    nextReviewDate: schedule.nextReviewDate,
    lastReviewDate: new Date(),
  };
}

/**
 * 更新卡片进度（错误答案）
 */
export function updateCardOnIncorrect(
  card: ReviewCard,
  quality: number = 1 // 默认为"错误，但看到答案后想起"
): ReviewCard {
  const schedule = calculateSM2(card, quality);
  
  return {
    ...card,
    easeFactor: schedule.newEaseFactor,
    interval: schedule.newInterval,
    repetitions: schedule.newRepetitions,
    nextReviewDate: schedule.nextReviewDate,
    lastReviewDate: new Date(),
  };
}

/**
 * 标记卡片为需要复习
 */
export function markForReview(card: ReviewCard): ReviewCard {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return {
    ...card,
    nextReviewDate: tomorrow,
  };
}

/**
 * 计算内容掌握度
 */
export function calculateContentMastery(
  contentId: string,
  cards: ReviewCard[]
): number {
  const contentCards = cards.filter((c) => c.contentId === contentId);
  
  if (contentCards.length === 0) return 0;
  
  // 基于 easeFactor 和 repetitions 计算掌握度
  const totalScore = contentCards.reduce((sum, card) => {
    // easeFactor 贡献 (1.3-2.5 映射到 0-50)
    const easeScore = Math.min(50, ((card.easeFactor - 1.3) / 1.2) * 50);
    // repetitions 贡献 (0-5 映射到 0-50)
    const repScore = Math.min(50, (card.repetitions / 5) * 50);
    return sum + easeScore + repScore;
  }, 0);
  
  return Math.round(totalScore / contentCards.length);
}

/**
 * 更新内容进度
 */
export function updateContentProgress(
  progress: ContentProgress | null,
  contentId: string,
  mode: LearningMode,
  masteryLevel: number
): ContentProgress {
  const now = new Date();
  
  if (!progress) {
    return {
      contentId,
      masteryLevel,
      lastStudiedAt: now,
      completedModes: [mode],
    };
  }
  
  const completedModes = progress.completedModes.includes(mode)
    ? progress.completedModes
    : [...progress.completedModes, mode];
  
  return {
    ...progress,
    masteryLevel: Math.max(progress.masteryLevel, masteryLevel),
    lastStudiedAt: now,
    completedModes,
  };
}

/**
 * 检查是否需要复习
 */
export function needsReview(card: ReviewCard): boolean {
  const now = new Date();
  const reviewDate = new Date(card.nextReviewDate);
  return reviewDate <= now;
}

/**
 * 获取掌握度等级
 */
export function getMasteryLevel(mastery: number): 'beginner' | 'learning' | 'familiar' | 'mastered' {
  if (mastery >= 80) return 'mastered';
  if (mastery >= 60) return 'familiar';
  if (mastery >= 30) return 'learning';
  return 'beginner';
}

/**
 * 获取掌握度颜色
 */
export function getMasteryColor(mastery: number): string {
  if (mastery >= 80) return 'green';
  if (mastery >= 60) return 'blue';
  if (mastery >= 30) return 'yellow';
  return 'red';
}

/**
 * 批量更新卡片进度
 */
export function batchUpdateCards(
  cards: ReviewCard[],
  results: Map<string, boolean> // cardId -> isCorrect
): ReviewCard[] {
  return cards.map((card) => {
    const isCorrect = results.get(card.id);
    if (isCorrect === undefined) return card;
    
    return isCorrect
      ? updateCardOnCorrect(card)
      : updateCardOnIncorrect(card);
  });
}
