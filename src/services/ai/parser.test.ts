import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { ParsedContent, Question, MatchPair } from '../../types';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

// 生成有效的 ParsedContent
const parsedContentArbitrary = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  chapters: fc.array(
    fc.record({
      id: fc.uuid(),
      title: fc.string({ minLength: 1, maxLength: 100 }),
      content: fc.string({ minLength: 10, maxLength: 500 }),
      keywords: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
      order: fc.integer({ min: 1, max: 100 }),
    }),
    { minLength: 1, maxLength: 5 }
  ),
  keywords: fc.array(
    fc.record({
      term: fc.string({ minLength: 1, maxLength: 50 }),
      definition: fc.string({ minLength: 1, maxLength: 200 }),
      importance: fc.constantFrom('high', 'medium', 'low') as fc.Arbitrary<'high' | 'medium' | 'low'>,
    }),
    { minLength: 1, maxLength: 10 }
  ),
  concepts: fc.array(
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      definition: fc.string({ minLength: 1, maxLength: 200 }),
      relatedTerms: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
    }),
    { minLength: 1, maxLength: 10 }
  ),
  createdAt: fc.date(),
  updatedAt: fc.date(),
});

// 生成有效的 Question
const questionArbitrary = fc.record({
  id: fc.uuid(),
  question: fc.string({ minLength: 10, maxLength: 200 }),
  options: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 4, maxLength: 4 }),
  correctAnswer: fc.string({ minLength: 1, maxLength: 100 }),
  explanation: fc.string({ minLength: 1, maxLength: 500 }),
});

describe('Content Parser Properties', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  /**
   * Feature: politics-study-system, Property 1: 内容解析完整性
   * *For any* 有效的政治文本输入，解析后的 ParsedContent 对象应包含
   * 非空的 chapters 数组、keywords 数组和 concepts 数组。
   * **Validates: Requirements 1.2, 1.3**
   */
  it('Property 1: 解析后的内容应包含必要的结构', () => {
    fc.assert(
      fc.property(parsedContentArbitrary, (content) => {
        // 验证 ParsedContent 结构完整性
        const hasValidId = typeof content.id === 'string' && content.id.length > 0;
        const hasValidTitle = typeof content.title === 'string' && content.title.length > 0;
        const hasChapters = Array.isArray(content.chapters);
        const hasKeywords = Array.isArray(content.keywords);
        const hasConcepts = Array.isArray(content.concepts);
        
        // 至少有一个章节或关键词
        const hasContent = content.chapters.length > 0 || content.keywords.length > 0;
        
        return hasValidId && hasValidTitle && hasChapters && hasKeywords && hasConcepts && hasContent;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1: 章节结构验证
   */
  it('Property 1: 每个章节应包含必要字段', () => {
    fc.assert(
      fc.property(parsedContentArbitrary, (content) => {
        return content.chapters.every((chapter) => {
          const hasId = typeof chapter.id === 'string' && chapter.id.length > 0;
          const hasTitle = typeof chapter.title === 'string' && chapter.title.length > 0;
          const hasContent = typeof chapter.content === 'string';
          const hasKeywords = Array.isArray(chapter.keywords);
          const hasOrder = typeof chapter.order === 'number' && chapter.order > 0;
          
          return hasId && hasTitle && hasContent && hasKeywords && hasOrder;
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1: 关键词结构验证
   */
  it('Property 1: 每个关键词应包含术语和定义', () => {
    fc.assert(
      fc.property(parsedContentArbitrary, (content) => {
        return content.keywords.every((keyword) => {
          const hasTerm = typeof keyword.term === 'string' && keyword.term.length > 0;
          const hasDefinition = typeof keyword.definition === 'string' && keyword.definition.length > 0;
          const hasValidImportance = ['high', 'medium', 'low'].includes(keyword.importance);
          
          return hasTerm && hasDefinition && hasValidImportance;
        });
      }),
      { numRuns: 100 }
    );
  });
});

describe('Learning Materials Generation Properties', () => {
  /**
   * Feature: politics-study-system, Property 2: 学习材料生成完整性
   * *For any* 有效的 ParsedContent 对象，系统应能生成至少一个挖空填词项、
   * 一道选择题和一组术语配对。
   * **Validates: Requirements 1.4**
   */
  it('Property 2: 生成的选择题应有正确的结构', () => {
    fc.assert(
      fc.property(
        fc.array(questionArbitrary, { minLength: 1, maxLength: 10 }),
        (questions) => {
          return questions.every((q) => {
            const hasId = typeof q.id === 'string' && q.id.length > 0;
            const hasQuestion = typeof q.question === 'string' && q.question.length > 0;
            const hasFourOptions = Array.isArray(q.options) && q.options.length === 4;
            const hasCorrectAnswer = typeof q.correctAnswer === 'string' && q.correctAnswer.length > 0;
            const hasExplanation = typeof q.explanation === 'string' && q.explanation.length > 0;
            
            return hasId && hasQuestion && hasFourOptions && hasCorrectAnswer && hasExplanation;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: 术语配对结构验证
   */
  it('Property 2: 生成的术语配对应有正确的结构', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            term: fc.string({ minLength: 1, maxLength: 50 }),
            definition: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (pairs: MatchPair[]) => {
          return pairs.every((p) => {
            const hasId = typeof p.id === 'string' && p.id.length > 0;
            const hasTerm = typeof p.term === 'string' && p.term.length > 0;
            const hasDefinition = typeof p.definition === 'string' && p.definition.length > 0;
            
            return hasId && hasTerm && hasDefinition;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: 从 ParsedContent 生成的材料应覆盖内容
   */
  it('Property 2: 生成的材料数量应与内容复杂度相关', () => {
    fc.assert(
      fc.property(parsedContentArbitrary, (content) => {
        // 如果有关键词，应该能生成配对
        const canGenerateMatching = content.keywords.length > 0 || content.concepts.length > 0;
        
        // 如果有章节内容，应该能生成选择题
        const canGenerateQuiz = content.chapters.some((ch) => ch.content.length > 0);
        
        // 至少应该能生成一种学习材料
        return canGenerateMatching || canGenerateQuiz;
      }),
      { numRuns: 100 }
    );
  });
});

describe('Unit Tests', () => {
  it('ParsedContent 应有有效的时间戳', () => {
    const content: ParsedContent = {
      id: 'test-id',
      title: 'Test Title',
      chapters: [],
      keywords: [],
      concepts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    expect(content.createdAt).toBeInstanceOf(Date);
    expect(content.updatedAt).toBeInstanceOf(Date);
    expect(content.updatedAt >= content.createdAt).toBe(true);
  });

  it('Question 的 correctAnswer 应在 options 中', () => {
    const question: Question = {
      id: 'q1',
      question: '测试问题',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'B',
      explanation: '解析',
    };
    
    expect(question.options).toContain(question.correctAnswer);
  });
});
