import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateTotalStudyTime,
  calculateTotalCorrect,
  calculateTotalQuestions,
  calculateAccuracyRate,
  calculateStatistics,
  formatStudyTime,
} from './tracker';
import type { StudySession, LearningMode } from '../../types';

// 生成有效的学习会话
const sessionArbitrary = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  contentId: fc.uuid(),
  mode: fc.constantFrom('fill-blank', 'quiz', 'matching', 'mnemonic', 'speech') as fc.Arbitrary<LearningMode>,
  duration: fc.integer({ min: 0, max: 3600 }),
  correctCount: fc.integer({ min: 0, max: 100 }),
  totalCount: fc.integer({ min: 0, max: 100 }),
  startedAt: fc.date(),
  endedAt: fc.option(fc.date(), { nil: null }),
}).filter((s) => s.correctCount <= s.totalCount);

describe('Statistics Tracker', () => {
  /**
   * Feature: politics-study-system, Property 5: 统计记录正确性
   * *For any* 完成的学习会话，Statistics_Tracker 记录的 correct_count 应等于
   * 该会话中正确答案的数量，total_count 应等于总题目数量。
   * **Validates: Requirements 2.6, 3.5**
   */
  describe('Property 5: 统计记录正确性', () => {
    it('总学习时长应等于所有会话时长之和', () => {
      fc.assert(
        fc.property(
          fc.array(sessionArbitrary, { minLength: 0, maxLength: 20 }),
          (sessions) => {
            const result = calculateTotalStudyTime(sessions as StudySession[]);
            const expected = sessions.reduce((sum, s) => sum + s.duration, 0);
            return result === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('总正确数应等于所有会话正确数之和', () => {
      fc.assert(
        fc.property(
          fc.array(sessionArbitrary, { minLength: 0, maxLength: 20 }),
          (sessions) => {
            const result = calculateTotalCorrect(sessions as StudySession[]);
            const expected = sessions.reduce((sum, s) => sum + s.correctCount, 0);
            return result === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('总题目数应等于所有会话题目数之和', () => {
      fc.assert(
        fc.property(
          fc.array(sessionArbitrary, { minLength: 0, maxLength: 20 }),
          (sessions) => {
            const result = calculateTotalQuestions(sessions as StudySession[]);
            const expected = sessions.reduce((sum, s) => sum + s.totalCount, 0);
            return result === expected;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: politics-study-system, Property 13: 统计计算正确性
   * *For any* 用户的学习记录集合：
   * - totalStudyTime 应等于所有 studySessions 的 duration 之和
   * - 正确率应等于 sum(correct_count) / sum(total_count)
   * **Validates: Requirements 10.1, 10.2, 10.3**
   */
  describe('Property 13: 统计计算正确性', () => {
    it('正确率计算应正确', () => {
      fc.assert(
        fc.property(
          fc.array(sessionArbitrary, { minLength: 1, maxLength: 20 }),
          (sessions) => {
            const result = calculateAccuracyRate(sessions as StudySession[]);
            const totalCorrect = sessions.reduce((sum, s) => sum + s.correctCount, 0);
            const totalQuestions = sessions.reduce((sum, s) => sum + s.totalCount, 0);
            
            if (totalQuestions === 0) {
              return result === 0;
            }
            
            const expected = Math.round((totalCorrect / totalQuestions) * 100);
            return result === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('正确率应在 0-100 之间', () => {
      fc.assert(
        fc.property(
          fc.array(sessionArbitrary, { minLength: 0, maxLength: 20 }),
          (sessions) => {
            const result = calculateAccuracyRate(sessions as StudySession[]);
            return result >= 0 && result <= 100;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('完整统计应包含所有必要字段', () => {
      fc.assert(
        fc.property(
          fc.array(sessionArbitrary, { minLength: 0, maxLength: 10 }),
          (sessions) => {
            const result = calculateStatistics(sessions as StudySession[], [], []);
            
            return (
              typeof result.totalStudyTime === 'number' &&
              typeof result.totalCorrect === 'number' &&
              typeof result.totalQuestions === 'number' &&
              typeof result.accuracyRate === 'number' &&
              typeof result.streakDays === 'number' &&
              Array.isArray(result.chapterMastery)
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('时间格式化', () => {
    it('应正确格式化秒数', () => {
      expect(formatStudyTime(30)).toBe('30秒');
      expect(formatStudyTime(90)).toBe('1分钟');
      expect(formatStudyTime(3600)).toBe('1小时');
      expect(formatStudyTime(3660)).toBe('1小时1分钟');
    });

    it('格式化结果应为非空字符串', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 86400 }),
          (seconds) => {
            const result = formatStudyTime(seconds);
            return typeof result === 'string' && result.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('边界情况', () => {
    it('空会话列表应返回零值', () => {
      expect(calculateTotalStudyTime([])).toBe(0);
      expect(calculateTotalCorrect([])).toBe(0);
      expect(calculateTotalQuestions([])).toBe(0);
      expect(calculateAccuracyRate([])).toBe(0);
    });

    it('全部正确时正确率应为 100', () => {
      const sessions: StudySession[] = [
        {
          id: '1',
          userId: 'u1',
          contentId: 'c1',
          mode: 'quiz',
          duration: 60,
          correctCount: 10,
          totalCount: 10,
          startedAt: new Date(),
          endedAt: null,
        },
      ];
      expect(calculateAccuracyRate(sessions)).toBe(100);
    });

    it('全部错误时正确率应为 0', () => {
      const sessions: StudySession[] = [
        {
          id: '1',
          userId: 'u1',
          contentId: 'c1',
          mode: 'quiz',
          duration: 60,
          correctCount: 0,
          totalCount: 10,
          startedAt: new Date(),
          endedAt: null,
        },
      ];
      expect(calculateAccuracyRate(sessions)).toBe(0);
    });
  });
});
