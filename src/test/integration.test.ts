/**
 * 集成测试 - 测试完整学习流程和认证同步流程
 */

import { describe, it, expect } from 'vitest';
import { calculateSM2, getDueCards } from '../services/sm2/scheduler';
import { calculateStatistics } from '../services/statistics/tracker';
import { validateAnswer, generateFillBlanks } from '../services/learning/fillBlank';
import { validateQuizAnswer, generateQuizQuestions, validateQuestionStructure } from '../services/learning/quiz';
import { generateMatchingPairs, validateAllMatches } from '../services/learning/matching';
import { updateCardOnCorrect, updateCardOnIncorrect, calculateContentMastery } from '../services/progress/updater';
import { resolveContentConflict } from '../services/sync/conflictResolver';
import type { ReviewCard, StudySession, ParsedContent, Keyword, MatchPair } from '../types';

// Mock 数据
const mockKeywords: Keyword[] = [
  { term: '社会主义核心价值观', definition: '富强、民主、文明、和谐等24字', importance: 'high' },
  { term: '中国特色社会主义', definition: '中国共产党领导的社会主义道路', importance: 'high' },
  { term: '人民代表大会制度', definition: '中国的根本政治制度', importance: 'medium' },
  { term: '民主集中制', definition: '党的根本组织原则', importance: 'medium' },
  { term: '依法治国', definition: '党领导人民治理国家的基本方略', importance: 'high' },
];

const mockContent: ParsedContent = {
  id: 'test-content-1',
  title: '政治学习测试内容',
  chapters: [
    {
      id: 'chapter-1',
      title: '第一章',
      content: '社会主义核心价值观是中国特色社会主义的重要组成部分。',
      keywords: ['社会主义核心价值观', '中国特色社会主义'],
      order: 1,
    },
  ],
  keywords: mockKeywords,
  concepts: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockCard(overrides: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: `card-${Date.now()}`,
    contentId: 'test-content-1',
    userId: 'test-user-1',
    cardType: 'quiz',
    cardData: { type: 'quiz', question: { id: 'q1', question: 'test', options: [], correctAnswer: '', explanation: '' } },
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date(),
    lastReviewDate: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function createMockSession(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: `session-${Date.now()}`,
    userId: 'test-user-1',
    contentId: 'test-content-1',
    mode: 'quiz',
    duration: 300,
    correctCount: 8,
    totalCount: 10,
    startedAt: new Date(),
    endedAt: new Date(),
    ...overrides,
  };
}

describe('完整学习流程集成测试', () => {
  describe('内容解析到学习材料生成', () => {
    it('应该从关键词生成挖空填词练习', () => {
      const text = '社会主义核心价值观是中国特色社会主义的重要组成部分。';
      const keywords = ['社会主义核心价值观', '中国特色社会主义'];
      
      const result = generateFillBlanks(text, keywords);
      
      expect(result.blanks.length).toBeGreaterThan(0);
      expect(result.text).toContain('___');
      result.blanks.forEach(blank => {
        expect(keywords).toContain(blank.answer);
      });
    });

    it('应该从关键词生成选择题', () => {
      const questions = generateQuizQuestions(mockKeywords);
      
      expect(questions.length).toBeGreaterThan(0);
      questions.forEach(q => {
        const validation = validateQuestionStructure(q);
        expect(validation.valid).toBe(true);
        expect(q.options.length).toBe(4);
        expect(q.options).toContain(q.correctAnswer);
      });
    });

    it('应该从关键词生成术语配对', () => {
      const pairs = generateMatchingPairs(mockKeywords);
      
      expect(pairs.length).toBeGreaterThan(0);
      pairs.forEach(pair => {
        expect(pair.term).toBeTruthy();
        expect(pair.definition).toBeTruthy();
      });
    });
  });

  describe('答案验证流程', () => {
    it('挖空填词答案验证应该正确', () => {
      const correctResult = validateAnswer('社会主义核心价值观', '社会主义核心价值观');
      expect(correctResult.isCorrect).toBe(true);
      expect(correctResult.score).toBe(1);

      const incorrectResult = validateAnswer('错误答案', '社会主义核心价值观');
      expect(incorrectResult.isCorrect).toBe(false);
      expect(incorrectResult.score).toBe(0);
    });

    it('选择题答案验证应该正确', () => {
      const question = {
        id: 'q1',
        question: '测试问题',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'B',
        explanation: '解析',
      };

      const correctResult = validateQuizAnswer('B', question);
      expect(correctResult.isCorrect).toBe(true);

      const incorrectResult = validateQuizAnswer('A', question);
      expect(incorrectResult.isCorrect).toBe(false);
    });

    it('术语配对验证应该正确', () => {
      const pairs: MatchPair[] = [
        { id: 'p1', term: '术语1', definition: '定义1' },
        { id: 'p2', term: '术语2', definition: '定义2' },
      ];

      // 正确配对
      const correctMatches = new Map([['p1', 'p1'], ['p2', 'p2']]);
      const correctResult = validateAllMatches(correctMatches, pairs);
      expect(correctResult.correctCount).toBe(2);
      expect(correctResult.score).toBe(100);

      // 错误配对
      const wrongMatches = new Map([['p1', 'p2'], ['p2', 'p1']]);
      const wrongResult = validateAllMatches(wrongMatches, pairs);
      expect(wrongResult.correctCount).toBe(0);
    });
  });

  describe('SM-2 复习调度流程', () => {
    it('正确答案应该增加复习间隔', () => {
      const card = createMockCard({ repetitions: 0, interval: 0 });
      
      const result = calculateSM2(card, 4); // 正确，有些犹豫
      
      expect(result.newInterval).toBe(1);
      expect(result.newRepetitions).toBe(1);
      expect(result.newEaseFactor).toBeGreaterThanOrEqual(1.3);
    });

    it('错误答案应该重置复习间隔', () => {
      const card = createMockCard({ repetitions: 5, interval: 30 });
      
      const result = calculateSM2(card, 2); // 错误
      
      expect(result.newInterval).toBe(1);
      expect(result.newRepetitions).toBe(0);
    });

    it('应该正确获取待复习卡片', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const cards = [
        createMockCard({ id: 'due-card', nextReviewDate: yesterday }),
        createMockCard({ id: 'future-card', nextReviewDate: tomorrow }),
      ];

      const dueCards = getDueCards(cards);
      
      expect(dueCards.length).toBe(1);
      expect(dueCards[0].id).toBe('due-card');
    });
  });

  describe('学习进度更新流程', () => {
    it('正确答案应该更新卡片进度', () => {
      const card = createMockCard();
      
      const updatedCard = updateCardOnCorrect(card, 4);
      
      expect(updatedCard.repetitions).toBeGreaterThan(card.repetitions);
      expect(updatedCard.lastReviewDate).not.toBeNull();
    });

    it('错误答案应该标记需要复习', () => {
      const card = createMockCard({ repetitions: 5, interval: 30 });
      
      const updatedCard = updateCardOnIncorrect(card, 1);
      
      expect(updatedCard.repetitions).toBe(0);
      expect(updatedCard.interval).toBe(1);
    });

    it('应该正确计算内容掌握度', () => {
      const cards = [
        createMockCard({ contentId: 'content-1', easeFactor: 2.5, repetitions: 5 }),
        createMockCard({ contentId: 'content-1', easeFactor: 2.0, repetitions: 3 }),
        createMockCard({ contentId: 'content-2', easeFactor: 1.5, repetitions: 1 }),
      ];

      const mastery = calculateContentMastery('content-1', cards);
      
      expect(mastery).toBeGreaterThan(0);
      expect(mastery).toBeLessThanOrEqual(100);
    });
  });

  describe('统计计算流程', () => {
    it('应该正确计算学习统计', () => {
      const sessions = [
        createMockSession({ duration: 300, correctCount: 8, totalCount: 10 }),
        createMockSession({ duration: 200, correctCount: 6, totalCount: 8 }),
      ];
      const contents = [mockContent];
      const cards: ReviewCard[] = [];

      const stats = calculateStatistics(sessions, contents, cards);

      expect(stats.totalStudyTime).toBe(500);
      expect(stats.totalCorrect).toBe(14);
      expect(stats.totalQuestions).toBe(18);
      expect(stats.accuracyRate).toBe(Math.round((14 / 18) * 100));
    });

    it('空数据应该返回零值统计', () => {
      const stats = calculateStatistics([], [], []);

      expect(stats.totalStudyTime).toBe(0);
      expect(stats.totalCorrect).toBe(0);
      expect(stats.totalQuestions).toBe(0);
      expect(stats.accuracyRate).toBe(0);
    });
  });
});

describe('数据同步流程集成测试', () => {
  describe('冲突解决', () => {
    it('应该保留较新的数据', () => {
      const older = new Date('2024-01-01');
      const newer = new Date('2024-01-02');

      const localData = {
        id: '1',
        title: 'local',
        chapters: [],
        keywords: [],
        concepts: [],
        createdAt: older,
        updatedAt: older,
      };
      const remoteData = {
        id: '1',
        title: 'remote',
        chapters: [],
        keywords: [],
        concepts: [],
        createdAt: older,
        updatedAt: newer,
      };

      const result = resolveContentConflict(localData, remoteData);
      
      expect(result.resolved.title).toBe('remote');
      expect(result.source).toBe('remote');
    });

    it('本地数据较新时应该保留本地数据', () => {
      const older = new Date('2024-01-01');
      const newer = new Date('2024-01-02');

      const localData = {
        id: '1',
        title: 'local',
        chapters: [],
        keywords: [],
        concepts: [],
        createdAt: older,
        updatedAt: newer,
      };
      const remoteData = {
        id: '1',
        title: 'remote',
        chapters: [],
        keywords: [],
        concepts: [],
        createdAt: older,
        updatedAt: older,
      };

      const result = resolveContentConflict(localData, remoteData);
      
      expect(result.resolved.title).toBe('local');
      expect(result.source).toBe('local');
    });
  });
});

describe('端到端学习流程', () => {
  it('完整学习流程：内容 -> 学习 -> 复习 -> 统计', () => {
    // 1. 生成学习材料
    const questions = generateQuizQuestions(mockKeywords);
    expect(questions.length).toBeGreaterThan(0);

    // 2. 模拟答题
    const answers = questions.map((q, i) => ({
      questionId: q.id,
      answer: i % 2 === 0 ? q.correctAnswer : q.options[0], // 交替正确/错误
      isCorrect: i % 2 === 0,
    }));

    // 3. 创建学习会话
    const correctCount = answers.filter(a => a.isCorrect).length;
    const session = createMockSession({
      correctCount,
      totalCount: questions.length,
      duration: 180,
    });

    // 4. 创建复习卡片并更新进度
    const cards = answers.map((a, i) => {
      const card = createMockCard({ id: `card-${i}` });
      return a.isCorrect 
        ? updateCardOnCorrect(card, 4)
        : updateCardOnIncorrect(card, 1);
    });

    // 5. 计算统计
    const stats = calculateStatistics([session], [mockContent], cards);

    // 验证
    expect(stats.totalCorrect).toBe(correctCount);
    expect(stats.totalQuestions).toBe(questions.length);
    expect(stats.totalStudyTime).toBe(180);

    // 6. 检查待复习卡片 - 错误的卡片 interval=1，nextReviewDate 是明天
    // 所以今天不会有到期卡片，这是正确的行为
    // 我们验证错误的卡片确实被重置了
    const incorrectCards = cards.filter((_, i) => !answers[i].isCorrect);
    incorrectCards.forEach(card => {
      expect(card.repetitions).toBe(0);
      expect(card.interval).toBe(1);
    });
    
    // 正确的卡片应该有进度
    const correctCards = cards.filter((_, i) => answers[i].isCorrect);
    correctCards.forEach(card => {
      expect(card.repetitions).toBe(1);
    });
  });
});
