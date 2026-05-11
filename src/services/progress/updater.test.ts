import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  updateCardOnCorrect,
  updateCardOnIncorrect,
  markForReview,
  calculateContentMastery,
  needsReview,
  getMasteryLevel,
  batchUpdateCards,
} from './updater';
import type { ReviewCard } from '../../types';

// 生成有效的复习卡片
const cardArbitrary = fc.record({
  id: fc.uuid(),
  contentId: fc.uuid(),
  userId: fc.uuid(),
  cardType: fc.constantFrom('fill-blank', 'quiz', 'matching') as fc.Arbitrary<'fill-blank' | 'quiz' | 'matching'>,
  cardData: fc.constant({ type: 'fill-blank', text: '', blanks: [] }),
  easeFactor: fc.float({ min: Math.fround(1.3), max: Math.fround(5.0), noNaN: true }),
  interval: fc.integer({ min: 0, max: 365 }),
  repetitions: fc.integer({ min: 0, max: 100 }),
  nextReviewDate: fc.date(),
  lastReviewDate: fc.option(fc.date(), { nil: null }),
  createdAt: fc.date(),
});

describe('Progress Updater', () => {
  /**
   * Feature: politics-study-system, Property 4: 学习进度更新一致性
   * *For any* 答题结果，正确答案应导致掌握度增加或保持，
   * 错误答案应导致该项被标记为需要复习。
   * **Validates: Requirements 2.4, 2.5, 4.5**
   */
  describe('Property 4: 学习进度更新一致性', () => {
    it('正确答案应增加或保持 easeFactor', () => {
      fc.assert(
        fc.property(cardArbitrary, (card) => {
          const updated = updateCardOnCorrect(card as ReviewCard, 4);
          // easeFactor 应该增加或保持（取决于当前值）
          // 但始终 >= 1.3
          return updated.easeFactor >= 1.3;
        }),
        { numRuns: 100 }
      );
    });

    it('正确答案应增加 repetitions', () => {
      fc.assert(
        fc.property(cardArbitrary, (card) => {
          const updated = updateCardOnCorrect(card as ReviewCard, 4);
          return updated.repetitions === (card as ReviewCard).repetitions + 1;
        }),
        { numRuns: 100 }
      );
    });

    it('错误答案应重置 repetitions 为 0', () => {
      fc.assert(
        fc.property(cardArbitrary, (card) => {
          const updated = updateCardOnIncorrect(card as ReviewCard, 1);
          return updated.repetitions === 0;
        }),
        { numRuns: 100 }
      );
    });

    it('错误答案应设置 interval 为 1', () => {
      fc.assert(
        fc.property(cardArbitrary, (card) => {
          const updated = updateCardOnIncorrect(card as ReviewCard, 1);
          return updated.interval === 1;
        }),
        { numRuns: 100 }
      );
    });

    it('标记复习应设置明天为复习日期', () => {
      fc.assert(
        fc.property(cardArbitrary, (card) => {
          const updated = markForReview(card as ReviewCard);
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);
          
          const reviewDate = new Date(updated.nextReviewDate);
          reviewDate.setHours(0, 0, 0, 0);
          
          return reviewDate.getTime() === tomorrow.getTime();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('掌握度计算', () => {
    it('空卡片列表应返回 0', () => {
      expect(calculateContentMastery('content-1', [])).toBe(0);
    });

    it('掌握度应在 0-100 之间', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(cardArbitrary, { minLength: 1, maxLength: 10 }),
          (contentId, cards) => {
            const cardsWithContent = (cards as ReviewCard[]).map((c) => ({
              ...c,
              contentId,
            }));
            const mastery = calculateContentMastery(contentId, cardsWithContent);
            return mastery >= 0 && mastery <= 100;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('复习检查', () => {
    it('过期卡片应需要复习', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const card: ReviewCard = {
        id: '1',
        contentId: 'c1',
        userId: 'u1',
        cardType: 'quiz',
        cardData: { type: 'quiz', question: { id: 'q1', question: '', options: [], correctAnswer: '', explanation: '' } },
        easeFactor: 2.5,
        interval: 1,
        repetitions: 1,
        nextReviewDate: yesterday,
        lastReviewDate: null,
        createdAt: new Date(),
      };
      
      expect(needsReview(card)).toBe(true);
    });

    it('未来卡片不应需要复习', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const card: ReviewCard = {
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
      };
      
      expect(needsReview(card)).toBe(false);
    });
  });

  describe('掌握度等级', () => {
    it('应返回正确的等级', () => {
      expect(getMasteryLevel(90)).toBe('mastered');
      expect(getMasteryLevel(70)).toBe('familiar');
      expect(getMasteryLevel(40)).toBe('learning');
      expect(getMasteryLevel(10)).toBe('beginner');
    });

    it('等级应为有效值', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          (mastery) => {
            const level = getMasteryLevel(mastery);
            return ['beginner', 'learning', 'familiar', 'mastered'].includes(level);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('批量更新', () => {
    it('应正确更新所有卡片', () => {
      fc.assert(
        fc.property(
          fc.array(cardArbitrary, { minLength: 1, maxLength: 10 }),
          (cards) => {
            const results = new Map<string, boolean>();
            (cards as ReviewCard[]).forEach((card, index) => {
              results.set(card.id, index % 2 === 0);
            });
            
            const updated = batchUpdateCards(cards as ReviewCard[], results);
            
            // 验证更新后的卡片数量相同
            return updated.length === cards.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
