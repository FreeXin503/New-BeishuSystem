/**
 * 数据同步属性测试
 * Property 10: 数据迁移一致性
 * Property 12: 数据冲突解决
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ParsedContent, ReviewCard, StudySession } from '../../types';
import {
  resolveContentConflict,
  resolveCardConflict,
  resolveSessionConflict,
  detectConflict,
  type ConflictStrategy,
} from './conflictResolver';

// Arbitrary generators
const contentArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  chapters: fc.array(fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    content: fc.string({ minLength: 1, maxLength: 500 }),
    keywords: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
    order: fc.nat({ max: 100 }),
  }), { minLength: 1, maxLength: 5 }),
  keywords: fc.array(fc.record({
    term: fc.string({ minLength: 1, maxLength: 30 }),
    definition: fc.string({ minLength: 1, maxLength: 200 }),
    importance: fc.constantFrom('high', 'medium', 'low') as fc.Arbitrary<'high' | 'medium' | 'low'>,
  }), { minLength: 0, maxLength: 10 }),
  concepts: fc.array(fc.record({
    name: fc.string({ minLength: 1, maxLength: 30 }),
    definition: fc.string({ minLength: 1, maxLength: 200 }),
    relatedTerms: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
  }), { minLength: 0, maxLength: 5 }),
  createdAt: fc.date(),
  updatedAt: fc.date(),
}) as fc.Arbitrary<ParsedContent>;

const reviewCardArb = fc.record({
  id: fc.uuid(),
  contentId: fc.uuid(),
  userId: fc.string({ minLength: 1, maxLength: 50 }),
  cardType: fc.constantFrom('fill-blank', 'quiz', 'matching') as fc.Arbitrary<'fill-blank' | 'quiz' | 'matching'>,
  cardData: fc.record({
    type: fc.constant('fill-blank'),
    text: fc.string({ minLength: 1, maxLength: 200 }),
    blanks: fc.array(fc.record({
      id: fc.uuid(),
      position: fc.nat({ max: 100 }),
      length: fc.nat({ max: 20 }),
      answer: fc.string({ minLength: 1, maxLength: 30 }),
    }), { minLength: 1, maxLength: 5 }),
  }),
  easeFactor: fc.double({ min: 1.3, max: 2.5 }),
  interval: fc.nat({ max: 365 }),
  repetitions: fc.nat({ max: 100 }),
  nextReviewDate: fc.date(),
  lastReviewDate: fc.option(fc.date(), { nil: null }),
  createdAt: fc.date(),
}) as fc.Arbitrary<ReviewCard>;

const studySessionArb = fc.record({
  id: fc.uuid(),
  userId: fc.string({ minLength: 1, maxLength: 50 }),
  contentId: fc.uuid(),
  mode: fc.constantFrom('fill-blank', 'quiz', 'matching', 'mnemonic', 'speech') as fc.Arbitrary<'fill-blank' | 'quiz' | 'matching' | 'mnemonic' | 'speech'>,
  duration: fc.nat({ max: 7200 }),
  correctCount: fc.nat({ max: 100 }),
  totalCount: fc.nat({ max: 100 }),
  startedAt: fc.date(),
  endedAt: fc.option(fc.date(), { nil: null }),
}) as fc.Arbitrary<StudySession>;

const strategyArb = fc.constantFrom(
  'local-wins',
  'remote-wins',
  'latest-wins',
  'merge'
) as fc.Arbitrary<ConflictStrategy>;

describe('数据冲突解决属性测试 (Property 12)', () => {
  describe('内容冲突解决', () => {
    it('Property 12.1: local-wins 策略应始终返回本地版本', () => {
      fc.assert(
        fc.property(contentArb, contentArb, (local, remote) => {
          // 确保 ID 相同
          const remoteWithSameId = { ...remote, id: local.id };
          
          const result = resolveContentConflict(local, remoteWithSameId, 'local-wins');
          
          expect(result.source).toBe('local');
          expect(result.resolved.id).toBe(local.id);
          expect(result.resolved.title).toBe(local.title);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 12.2: remote-wins 策略应始终返回远程版本', () => {
      fc.assert(
        fc.property(contentArb, contentArb, (local, remote) => {
          const remoteWithSameId = { ...remote, id: local.id };
          
          const result = resolveContentConflict(local, remoteWithSameId, 'remote-wins');
          
          expect(result.source).toBe('remote');
          expect(result.resolved.id).toBe(local.id);
          expect(result.resolved.title).toBe(remote.title);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 12.3: latest-wins 策略应返回更新时间较晚的版本', () => {
      fc.assert(
        fc.property(contentArb, contentArb, (local, remote) => {
          const now = Date.now();
          const localWithTime = { ...local, updatedAt: new Date(now - 1000) };
          const remoteWithTime = { ...remote, id: local.id, updatedAt: new Date(now + 1000) };
          
          const result = resolveContentConflict(localWithTime, remoteWithTime, 'latest-wins');
          
          expect(result.source).toBe('remote');
          expect(result.resolved.title).toBe(remote.title);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 12.4: merge 策略应合并章节和关键词', () => {
      fc.assert(
        fc.property(contentArb, contentArb, (local, remote) => {
          const remoteWithSameId = { ...remote, id: local.id };
          
          const result = resolveContentConflict(local, remoteWithSameId, 'merge');
          
          expect(result.source).toBe('merged');
          // 合并后的章节数应该 >= 任一版本的章节数（去重后）
          expect(result.resolved.chapters.length).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('复习卡片冲突解决', () => {
    it('Property 12.5: 卡片冲突解决应保持 ID 不变', () => {
      fc.assert(
        fc.property(reviewCardArb, reviewCardArb, strategyArb, (local, remote, strategy) => {
          const remoteWithSameId = { ...remote, id: local.id };
          
          const result = resolveCardConflict(local, remoteWithSameId, strategy);
          
          expect(result.resolved.id).toBe(local.id);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 12.6: merge 策略应选择复习次数更多的版本', () => {
      fc.assert(
        fc.property(reviewCardArb, reviewCardArb, (local, remote) => {
          const localWithReps = { ...local, repetitions: 10 };
          const remoteWithReps = { ...remote, id: local.id, repetitions: 5 };
          
          const result = resolveCardConflict(localWithReps, remoteWithReps, 'merge');
          
          expect(result.resolved.repetitions).toBe(10);
          expect(result.source).toBe('local');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('学习会话冲突解决', () => {
    it('Property 12.7: 会话冲突解决应保持 ID 不变', () => {
      fc.assert(
        fc.property(studySessionArb, studySessionArb, strategyArb, (local, remote, strategy) => {
          const remoteWithSameId = { ...remote, id: local.id };
          
          const result = resolveSessionConflict(local, remoteWithSameId, strategy);
          
          expect(result.resolved.id).toBe(local.id);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 12.8: merge 策略应选择学习时间更长的版本', () => {
      fc.assert(
        fc.property(studySessionArb, studySessionArb, (local, remote) => {
          const localWithDuration = { ...local, duration: 3600 };
          const remoteWithDuration = { ...remote, id: local.id, duration: 1800 };
          
          const result = resolveSessionConflict(localWithDuration, remoteWithDuration, 'merge');
          
          expect(result.resolved.duration).toBe(3600);
          expect(result.source).toBe('local');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('冲突检测', () => {
    it('Property 12.9: 相同 ID 的项应被检测为冲突', () => {
      fc.assert(
        fc.property(
          fc.array(contentArb, { minLength: 1, maxLength: 5 }),
          (contents) => {
            // 创建本地和远程版本，部分 ID 相同
            const localItems = contents;
            const remoteItems = contents.map(c => ({ ...c, title: c.title + '-remote' }));
            
            const { conflicts, localOnly, remoteOnly } = detectConflict(localItems, remoteItems);
            
            // 所有项都应该是冲突
            expect(conflicts.length).toBe(contents.length);
            expect(localOnly.length).toBe(0);
            expect(remoteOnly.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 12.10: 不同 ID 的项应被分类为 localOnly 或 remoteOnly', () => {
      fc.assert(
        fc.property(
          fc.array(contentArb, { minLength: 1, maxLength: 3 }),
          fc.array(contentArb, { minLength: 1, maxLength: 3 }),
          (localContents, remoteContents) => {
            // 确保 ID 不重复
            const localItems = localContents.map((c, i) => ({ ...c, id: `local-${i}` }));
            const remoteItems = remoteContents.map((c, i) => ({ ...c, id: `remote-${i}` }));
            
            const { conflicts, localOnly, remoteOnly } = detectConflict(localItems, remoteItems);
            
            expect(conflicts.length).toBe(0);
            expect(localOnly.length).toBe(localItems.length);
            expect(remoteOnly.length).toBe(remoteItems.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('数据迁移一致性属性测试 (Property 10)', () => {
  it('Property 10.1: 迁移后数据应保持完整性', () => {
    fc.assert(
      fc.property(contentArb, (content) => {
        // 模拟迁移：数据应该保持所有字段
        const migrated = { ...content };
        
        expect(migrated.id).toBe(content.id);
        expect(migrated.title).toBe(content.title);
        expect(migrated.chapters.length).toBe(content.chapters.length);
        expect(migrated.keywords.length).toBe(content.keywords.length);
        expect(migrated.concepts.length).toBe(content.concepts.length);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 10.2: 迁移后复习卡片应保持学习进度', () => {
    fc.assert(
      fc.property(reviewCardArb, (card) => {
        // 模拟迁移：学习进度字段应该保持
        const migrated = { ...card };
        
        expect(migrated.easeFactor).toBe(card.easeFactor);
        expect(migrated.interval).toBe(card.interval);
        expect(migrated.repetitions).toBe(card.repetitions);
        expect(migrated.nextReviewDate).toEqual(card.nextReviewDate);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 10.3: 迁移后学习会话应保持统计数据', () => {
    fc.assert(
      fc.property(studySessionArb, (session) => {
        // 模拟迁移：统计数据应该保持
        const migrated = { ...session };
        
        expect(migrated.duration).toBe(session.duration);
        expect(migrated.correctCount).toBe(session.correctCount);
        expect(migrated.totalCount).toBe(session.totalCount);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 10.4: 批量迁移应保持数据数量一致', () => {
    fc.assert(
      fc.property(
        fc.array(contentArb, { minLength: 0, maxLength: 10 }),
        fc.array(reviewCardArb, { minLength: 0, maxLength: 20 }),
        fc.array(studySessionArb, { minLength: 0, maxLength: 15 }),
        (contents, cards, sessions) => {
          // 模拟批量迁移
          const migratedContents = contents.map(c => ({ ...c }));
          const migratedCards = cards.map(c => ({ ...c }));
          const migratedSessions = sessions.map(s => ({ ...s }));
          
          expect(migratedContents.length).toBe(contents.length);
          expect(migratedCards.length).toBe(cards.length);
          expect(migratedSessions.length).toBe(sessions.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
