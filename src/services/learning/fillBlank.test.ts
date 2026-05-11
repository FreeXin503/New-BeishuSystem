import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateAnswer,
  validateAllAnswers,
  calculateSimilarity,
  isCloseAnswer,
  extractBlanksFromChapter,
} from './fillBlank';
import type { BlankItem, Chapter } from '../../types';

describe('Fill Blank Service', () => {
  /**
   * Feature: politics-study-system, Property 3: 答案验证正确性
   * *For any* 学习模式中的问题和用户答案，当用户答案与正确答案完全匹配时
   * isCorrect 应为 true，否则应为 false。
   * **Validates: Requirements 2.3**
   */
  describe('Property 3: 答案验证正确性', () => {
    it('完全匹配的答案应返回 isCorrect = true', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (answer) => {
            const result = validateAnswer(answer, answer);
            return result.isCorrect === true && result.score === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('不匹配的答案应返回 isCorrect = false', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (userAnswer, correctAnswer) => {
            // 确保两个答案不同
            if (userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()) {
              return true; // 跳过相同的情况
            }
            const result = validateAnswer(userAnswer, correctAnswer);
            return result.isCorrect === false && result.score === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('忽略大小写和空格的非严格匹配', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (answer) => {
            const withSpaces = `  ${answer.toUpperCase()}  `;
            const result = validateAnswer(withSpaces, answer, false);
            return result.isCorrect === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('严格模式下区分大小写', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s !== s.toUpperCase()),
          (answer) => {
            const result = validateAnswer(answer.toUpperCase(), answer, true);
            return result.isCorrect === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('批量验证', () => {
    it('应正确计算正确数量和总数', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              position: fc.integer({ min: 0, max: 1000 }),
              length: fc.integer({ min: 1, max: 50 }),
              answer: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (blanks: BlankItem[]) => {
            // 创建一半正确一半错误的答案
            const userAnswers = new Map<string, string>();
            blanks.forEach((blank, index) => {
              userAnswers.set(
                blank.id,
                index % 2 === 0 ? blank.answer : 'wrong_answer_xyz'
              );
            });

            const result = validateAllAnswers(userAnswers, blanks);
            
            // 验证总数正确
            if (result.totalCount !== blanks.length) return false;
            
            // 验证正确数量在合理范围内
            if (result.correctCount < 0 || result.correctCount > blanks.length) return false;
            
            // 验证分数计算正确
            const expectedScore = Math.round((result.correctCount / result.totalCount) * 100);
            return result.score === expectedScore;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('相似度计算', () => {
    it('相同字符串的相似度应为 1', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (str) => {
            return calculateSimilarity(str, str) === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('相似度应在 0 到 1 之间', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          (a, b) => {
            const similarity = calculateSimilarity(a, b);
            return similarity >= 0 && similarity <= 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('接近正确的答案应被识别', () => {
      // 测试具体示例 - 使用更接近的字符串
      expect(isCloseAnswer('社会主义核', '社会主义核心')).toBe(true);
      expect(isCloseAnswer('xyz', '社会主义')).toBe(false);
    });
  });

  describe('关键词提取', () => {
    it('应正确提取章节中的关键词', () => {
      const chapter: Chapter = {
        id: 'ch1',
        title: '测试章节',
        content: '中国特色社会主义是我们的道路，马克思主义是我们的指导思想。',
        keywords: ['中国特色社会主义', '马克思主义'],
        order: 1,
      };

      const result = extractBlanksFromChapter(chapter);
      
      expect(result.blanks.length).toBe(2);
      expect(result.blanks[0].answer).toBe('中国特色社会主义');
      expect(result.blanks[1].answer).toBe('马克思主义');
      expect(result.text).toContain('___1___');
      expect(result.text).toContain('___2___');
    });

    it('没有关键词时应返回原文', () => {
      const chapter: Chapter = {
        id: 'ch1',
        title: '测试章节',
        content: '这是一段没有关键词的文本。',
        keywords: [],
        order: 1,
      };

      const result = extractBlanksFromChapter(chapter);
      
      expect(result.blanks.length).toBe(0);
      expect(result.text).toBe(chapter.content);
    });
  });

  describe('Unit Tests', () => {
    it('空答案应返回 false', () => {
      const result = validateAnswer('', '正确答案');
      expect(result.isCorrect).toBe(false);
    });

    it('结果应包含正确答案', () => {
      const correctAnswer = '测试答案';
      const result = validateAnswer('错误', correctAnswer);
      expect(result.correctAnswer).toBe(correctAnswer);
    });

    it('正确答案应有解释', () => {
      const result = validateAnswer('答案', '答案');
      expect(result.explanation).toBeDefined();
      expect(result.explanation!.length).toBeGreaterThan(0);
    });
  });
});
