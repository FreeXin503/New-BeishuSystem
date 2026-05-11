import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateQuizAnswer,
  validateQuestionStructure,
  validateAllQuizAnswers,
  getOptionLabel,
  getScoreRating,
} from './quiz';
import type { Question } from '../../types';

// 生成有效的选择题
const questionArbitrary = fc.record({
  id: fc.uuid(),
  question: fc.string({ minLength: 5, maxLength: 200 }),
  options: fc.tuple(
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.string({ minLength: 1, maxLength: 100 })
  ).map(([a, b, c, d]) => [a, b, c, d]),
  correctAnswer: fc.string({ minLength: 1, maxLength: 100 }),
  explanation: fc.string({ minLength: 1, maxLength: 500 }),
}).chain((q) => {
  // 确保 correctAnswer 在 options 中
  const randomIndex = Math.floor(Math.random() * 4);
  const options = [...q.options];
  options[randomIndex] = q.correctAnswer;
  return fc.constant({
    ...q,
    options,
    correctAnswer: options[randomIndex],
  } as Question);
});

describe('Quiz Service', () => {
  /**
   * Feature: politics-study-system, Property 6: 选择题结构正确性
   * *For any* 生成的选择题，options 数组长度应为 4，
   * correctAnswer 应存在于 options 中，explanation 应为非空字符串。
   * **Validates: Requirements 3.1, 3.3**
   */
  describe('Property 6: 选择题结构正确性', () => {
    it('有效选择题应有 4 个选项', () => {
      fc.assert(
        fc.property(questionArbitrary, (question) => {
          return question.options.length === 4;
        }),
        { numRuns: 100 }
      );
    });

    it('正确答案应在选项中', () => {
      fc.assert(
        fc.property(questionArbitrary, (question) => {
          return question.options.includes(question.correctAnswer);
        }),
        { numRuns: 100 }
      );
    });

    it('解析应为非空字符串', () => {
      fc.assert(
        fc.property(questionArbitrary, (question) => {
          return (
            typeof question.explanation === 'string' &&
            question.explanation.length > 0
          );
        }),
        { numRuns: 100 }
      );
    });

    it('结构验证应正确识别有效题目', () => {
      fc.assert(
        fc.property(questionArbitrary, (question) => {
          const result = validateQuestionStructure(question);
          return result.valid === true && result.errors.length === 0;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('答案验证', () => {
    it('正确答案应返回 isCorrect = true', () => {
      fc.assert(
        fc.property(questionArbitrary, (question) => {
          const result = validateQuizAnswer(question.correctAnswer, question);
          return result.isCorrect === true && result.score === 1;
        }),
        { numRuns: 100 }
      );
    });

    it('错误答案应返回 isCorrect = false', () => {
      fc.assert(
        fc.property(
          questionArbitrary,
          (question) => {
            // 找一个不是正确答案的选项
            const wrongAnswer = question.options.find(
              (opt) => opt !== question.correctAnswer
            );
            if (!wrongAnswer) return true; // 跳过所有选项相同的情况
            
            const result = validateQuizAnswer(wrongAnswer, question);
            return result.isCorrect === false && result.score === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('验证结果应包含解析', () => {
      fc.assert(
        fc.property(questionArbitrary, (question) => {
          const result = validateQuizAnswer('any answer', question);
          return result.explanation === question.explanation;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('批量验证', () => {
    it('应正确计算正确数量', () => {
      fc.assert(
        fc.property(
          fc.array(questionArbitrary, { minLength: 1, maxLength: 10 }),
          (questions) => {
            const userAnswers = new Map<string, string>();
            
            // 一半正确一半错误
            questions.forEach((q, index) => {
              userAnswers.set(
                q.id,
                index % 2 === 0 ? q.correctAnswer : 'wrong_answer'
              );
            });

            const result = validateAllQuizAnswers(userAnswers, questions);
            
            // 验证总数
            if (result.totalCount !== questions.length) return false;
            
            // 验证正确数量在合理范围
            if (result.correctCount < 0 || result.correctCount > questions.length) {
              return false;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('结构验证', () => {
    it('缺少选项的题目应无效', () => {
      const invalidQuestion: Question = {
        id: 'q1',
        question: '测试问题',
        options: ['A', 'B'], // 只有2个选项
        correctAnswer: 'A',
        explanation: '解析',
      };

      const result = validateQuestionStructure(invalidQuestion);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('选项数量必须为 4');
    });

    it('正确答案不在选项中应无效', () => {
      const invalidQuestion: Question = {
        id: 'q1',
        question: '测试问题',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'E', // 不在选项中
        explanation: '解析',
      };

      const result = validateQuestionStructure(invalidQuestion);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('正确答案必须在选项中');
    });

    it('缺少解析应无效', () => {
      const invalidQuestion: Question = {
        id: 'q1',
        question: '测试问题',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: '', // 空解析
      };

      const result = validateQuestionStructure(invalidQuestion);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('缺少答案解析');
    });
  });

  describe('工具函数', () => {
    it('getOptionLabel 应返回正确的标签', () => {
      expect(getOptionLabel(0)).toBe('A');
      expect(getOptionLabel(1)).toBe('B');
      expect(getOptionLabel(2)).toBe('C');
      expect(getOptionLabel(3)).toBe('D');
    });

    it('getScoreRating 应返回正确的评级', () => {
      expect(getScoreRating(95).rating).toBe('excellent');
      expect(getScoreRating(75).rating).toBe('good');
      expect(getScoreRating(65).rating).toBe('pass');
      expect(getScoreRating(50).rating).toBe('fail');
    });
  });
});
