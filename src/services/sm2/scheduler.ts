import type { ReviewCard, ReviewSchedule, ReviewResult } from '../../types';

/**
 * SM-2 算法实现
 * 
 * quality 评分说明 (0-5):
 * 0 - 完全忘记
 * 1 - 错误，但看到答案后想起
 * 2 - 错误，但答案感觉熟悉
 * 3 - 正确，但很困难
 * 4 - 正确，有些犹豫
 * 5 - 正确，非常轻松
 */

/**
 * 计算下次复习时间
 * @param card 当前复习卡片
 * @param quality 用户评分 (0-5)
 * @returns 新的复习计划
 */
export function calculateSM2(
  card: Pick<ReviewCard, 'easeFactor' | 'interval' | 'repetitions'>,
  quality: number
): ReviewSchedule {
  // 确保 quality 在有效范围内
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  
  let { easeFactor, interval, repetitions } = card;
  
  if (q >= 3) {
    // 正确回答
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    // 错误回答，重置
    repetitions = 0;
    interval = 1;
  }
  
  // 更新难度系数
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  
  // 难度系数最小值为 1.3
  easeFactor = Math.max(1.3, easeFactor);
  
  // 计算下次复习日期
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);
  
  return {
    nextReviewDate,
    newInterval: interval,
    newEaseFactor: easeFactor,
    newRepetitions: repetitions,
  };
}

/**
 * 创建新的复习卡片默认值
 */
export function createDefaultCardValues(): Pick<ReviewCard, 'easeFactor' | 'interval' | 'repetitions'> {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
  };
}

/**
 * 获取待复习的卡片
 * @param cards 所有卡片
 * @param currentDate 当前日期（可选，默认为今天）
 * @returns 待复习的卡片列表
 */
export function getDueCards(
  cards: ReviewCard[],
  currentDate: Date = new Date()
): ReviewCard[] {
  const now = new Date(currentDate);
  now.setHours(0, 0, 0, 0);
  
  return cards.filter((card) => {
    const reviewDate = new Date(card.nextReviewDate);
    reviewDate.setHours(0, 0, 0, 0);
    return reviewDate <= now;
  });
}

/**
 * 更新卡片进度
 * @param card 当前卡片
 * @param result 复习结果
 * @returns 更新后的卡片
 */
export function updateCardProgress(
  card: ReviewCard,
  result: ReviewResult
): ReviewCard {
  const schedule = calculateSM2(card, result.quality);
  
  return {
    ...card,
    easeFactor: schedule.newEaseFactor,
    interval: schedule.newInterval,
    repetitions: schedule.newRepetitions,
    nextReviewDate: schedule.nextReviewDate,
    lastReviewDate: result.timestamp,
  };
}

/**
 * 计算卡片的掌握程度 (0-100)
 * 基于 easeFactor 和 repetitions
 */
export function calculateMasteryLevel(card: ReviewCard): number {
  // 基于重复次数和难度系数计算掌握度
  const repetitionScore = Math.min(card.repetitions / 10, 1) * 50;
  const easeScore = ((card.easeFactor - 1.3) / (2.5 - 1.3)) * 50;
  
  return Math.round(Math.min(100, repetitionScore + easeScore));
}

/**
 * 获取今日需要复习的卡片数量
 */
export function getDueCardsCount(cards: ReviewCard[]): number {
  return getDueCards(cards).length;
}

/**
 * 按优先级排序待复习卡片
 * 优先级：过期时间越长越优先，难度系数越低越优先
 */
export function sortDueCardsByPriority(cards: ReviewCard[]): ReviewCard[] {
  const now = new Date();
  
  return [...cards].sort((a, b) => {
    const aOverdue = now.getTime() - new Date(a.nextReviewDate).getTime();
    const bOverdue = now.getTime() - new Date(b.nextReviewDate).getTime();
    
    // 首先按过期时间排序（过期越久越优先）
    if (aOverdue !== bOverdue) {
      return bOverdue - aOverdue;
    }
    
    // 其次按难度系数排序（难度越低越优先）
    return a.easeFactor - b.easeFactor;
  });
}
