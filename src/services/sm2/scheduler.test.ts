import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateSM2,
  createDefaultCardValues,
  getDueCards,
} from './scheduler';
import type { ReviewCard } from '../../types';

// 生成有效的卡片数据
const cardArbitrary = fc.record({
  easeFactor: fc.float({ min: Math.fround(1.3), max: Math.fround(5.0), noNaN: true }),
  interval: fc.integer({ min: 0, max: 365 }),
  repetitions: fc.integer({ min: 0, max: 100 }),
});

// 生成 quality 评分
const qualityArbitrary = fc.integer({ min: 0, max: 5 });

describe('SM-2 Algorithm', () => {
  /**
   * Feature: politics-study-system, Property 7: SM-2 算法正确性
   * *For any* ReviewCard 和 quality 评分 (0-5)：
   * - easeFactor 应始终 >= 1.3
   * **Validates: Requirements 7.1, 7.4, 7.5**
   */
  it('Property 7: easeFactor 应始终 >= 1.3', () => {
    fc.assert(
      fc.property(cardArbitrary, qualityArbitrary, (card, quality) => {
        const result = calculateSM2(card, quality);
        return result.newEaseFactor >= 1.3;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: politics-study-system, Property 7: SM-2 算法正确性
   * 当 quality >= 3 时，interval 应增加（首次为1，第二次为6，之后乘以 easeFactor）
   * **Validates: Requirements 7.1, 7.4**
   */
  it('Property 7: 正确回答时 interval 应按规则增加', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 5 }), // quality >= 3
        (quality) => {
          // 测试首次正确回答
          const newCard = createDefaultCardValues();
          const result1 = calculateSM2(newCard, quality);
          
          if (result1.newInterval !== 1) return false;
          if (result1.newRepetitions !== 1) return false;
          
          // 测试第二次正确回答
          const card2 = {
            easeFactor: result1.newEaseFactor,
            interval: result1.newInterval,
            repetitions: result1.newRepetitions,
          };
          const result2 = calculateSM2(card2, quality);
          
          if (result2.newInterval !== 6) return false;
          if (result2.newRepetitions !== 2) return false;
          
          // 测试第三次正确回答
          const card3 = {
            easeFactor: result2.newEaseFactor,
            interval: result2.newInterval,
            repetitions: result2.newRepetitions,
          };
          const result3 = calculateSM2(card3, quality);
          
          // interval 应该是 6 * easeFactor（四舍五入）
          const expectedInterval = Math.round(6 * card3.easeFactor);
          return result3.newInterval === expectedInterval;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: politics-study-system, Property 7: SM-2 算法正确性
   * 当 quality < 3 时，interval 应重置为 1，repetitions 应重置为 0
   * **Validates: Requirements 7.5**
   */
  it('Property 7: 错误回答时 interval 和 repetitions 应重置', () => {
    fc.assert(
      fc.property(
        cardArbitrary,
        fc.integer({ min: 0, max: 2 }), // quality < 3
        (card, quality) => {
          const result = calculateSM2(card, quality);
          return result.newInterval === 1 && result.newRepetitions === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: politics-study-system, Property 7: SM-2 算法正确性
   * nextReviewDate 应该是当前日期加上 interval 天
   */
  it('Property 7: nextReviewDate 应正确计算', () => {
    fc.assert(
      fc.property(cardArbitrary, qualityArbitrary, (card, quality) => {
        const before = new Date();
        const result = calculateSM2(card, quality);
        const after = new Date();
        
        // nextReviewDate 应该在 before + interval 和 after + interval 之间
        const expectedMin = new Date(before);
        expectedMin.setDate(expectedMin.getDate() + result.newInterval);
        
        const expectedMax = new Date(after);
        expectedMax.setDate(expectedMax.getDate() + result.newInterval);
        
        return (
          result.nextReviewDate >= expectedMin &&
          result.nextReviewDate <= expectedMax
        );
      }),
      { numRuns: 100 }
    );
  });

  /**
   * 单元测试：验证具体示例
   */
  describe('Unit Tests', () => {
    it('新卡片首次正确回答应设置 interval 为 1', () => {
      const card = createDefaultCardValues();
      const result = calculateSM2(card, 4);
      
      expect(result.newInterval).toBe(1);
      expect(result.newRepetitions).toBe(1);
    });

    it('新卡片首次错误回答应保持 interval 为 1', () => {
      const card = createDefaultCardValues();
      const result = calculateSM2(card, 2);
      
      expect(result.newInterval).toBe(1);
      expect(result.newRepetitions).toBe(0);
    });

    it('quality 为 5 时 easeFactor 应增加', () => {
      const card = { easeFactor: 2.5, interval: 1, repetitions: 1 };
      const result = calculateSM2(card, 5);
      
      expect(result.newEaseFactor).toBeGreaterThan(2.5);
    });

    it('quality 为 0 时 easeFactor 应减少但不低于 1.3', () => {
      const card = { easeFactor: 1.5, interval: 10, repetitions: 5 };
      const result = calculateSM2(card, 0);
      
      expect(result.newEaseFactor).toBeGreaterThanOrEqual(1.3);
    });
  });
});

describe('getDueCards', () => {
  /**
   * Feature: politics-study-system, Property 8: 待复习卡片提醒
   * *For any* 用户，当存在 nextReviewDate <= 当前时间 的 ReviewCard 时，
   * getDueCards 应返回非空数组。
   * **Validates: Requirements 7.2**
   */
  it('Property 8: 应返回所有到期的卡片', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            contentId: fc.uuid(),
            userId: fc.uuid(),
            cardType: fc.constantFrom('fill-blank', 'quiz', 'matching') as fc.Arbitrary<'fill-blank' | 'quiz' | 'matching'>,
            cardData: fc.constant({ type: 'fill-blank', text: '', blanks: [] }),
            easeFactor: fc.float({ min: Math.fround(1.3), max: Math.fround(5.0), noNaN: true }),
            interval: fc.integer({ min: 0, max: 365 }),
            repetitions: fc.integer({ min: 0, max: 100 }),
            nextReviewDate: fc.date({
              min: new Date('2020-01-01'),
              max: new Date('2030-12-31'),
            }),
            lastReviewDate: fc.option(fc.date(), { nil: null }),
            createdAt: fc.date(),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (cards) => {
          const now = new Date();
          const dueCards = getDueCards(cards as ReviewCard[], now);
          
          // 验证返回的卡片都是到期的
          const allDue = dueCards.every((card) => {
            const reviewDate = new Date(card.nextReviewDate);
            reviewDate.setHours(0, 0, 0, 0);
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            return reviewDate <= today;
          });
          
          // 验证没有遗漏到期的卡片
          const expectedDueCount = cards.filter((card) => {
            const reviewDate = new Date(card.nextReviewDate);
            reviewDate.setHours(0, 0, 0, 0);
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            return reviewDate <= today;
          }).length;
          
          return allDue && dueCards.length === expectedDueCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 单元测试
   */
  it('应返回今天到期的卡片', () => {
    const today = new Date();
    const cards: ReviewCard[] = [
      {
        id: '1',
        contentId: 'c1',
        userId: 'u1',
        cardType: 'quiz',
        cardData: { type: 'quiz', question: { id: 'q1', question: '', options: [], correctAnswer: '', explanation: '' } },
        easeFactor: 2.5,
        interval: 1,
        repetitions: 1,
        nextReviewDate: today,
        lastReviewDate: null,
        createdAt: new Date(),
      },
    ];
    
    const dueCards = getDueCards(cards, today);
    expect(dueCards.length).toBe(1);
  });

  it('不应返回未来到期的卡片', () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const cards: ReviewCard[] = [
      {
        id: '1',
        contentId: 'c1',
        userId: 'u1',
        cardType: 'quiz',
        cardData: { type: 'quiz', question: { id: 'q1', question: '', options: [], correctAnswer: '', explanation: '' } },
        easeFactor: 2.5,
        interval: 1,
        repetitions: 1,
        nextReviewDate: tomorrow,
        lastReviewDate: null,
        createdAt: new Date(),
      },
    ];
    
    const dueCards = getDueCards(cards, today);
    expect(dueCards.length).toBe(0);
  });
});
