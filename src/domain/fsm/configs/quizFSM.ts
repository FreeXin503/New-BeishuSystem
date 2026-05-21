/**
 * Quiz 选择题专项 FSM 配置
 * 
 * 将 Quiz.tsx 的 6 个 useState 整合为一台状态机。
 */

import type { FSMConfig, FSMEvent } from '../types';
import type { QuestionEntity, ValidationResultVO } from '../../models';

// ==================== 状态定义 ====================

export type QuizState =
  | 'IDLE'
  | 'LOADING_MATERIAL'
  | 'QUESTION_ACTIVE'
  | 'ANSWER_SUBMITTED'
  | 'EVALUATING'
  | 'EXPLANATION_ACTIVE'
  | 'SESSION_SUMMARY';

// ==================== 事件定义 ====================

export type QuizEventType =
  | 'START_SESSION'
  | 'FETCH_SUCCESS'
  | 'SELECT_ANSWER'
  | 'SUBMIT_ANSWER'
  | 'REQUEST_NEXT'
  | 'FINISH_SESSION'
  | 'ABORT_SESSION';

export type QuizEvent = FSMEvent<QuizEventType>;

// ==================== 上下文定义 ====================

export interface QuizContext {
  questions: QuestionEntity[];
  currentIndex: number;
  selectedAnswer: string | null;
  results: (ValidationResultVO | null)[];
  startTime: number;

  // 派生统计（避免 UI 层重复计算）
  correctCount: number;
  answeredCount: number;
}

function createInitialQuizContext(): QuizContext {
  return {
    questions: [],
    currentIndex: 0,
    selectedAnswer: null,
    results: [],
    startTime: Date.now(),
    correctCount: 0,
    answeredCount: 0,
  };
}

// ==================== 纯函数工具 ====================

function validateAnswer(question: QuestionEntity, answer: string): ValidationResultVO {
  const normalizeAnswer = (s: string) => s.trim().toUpperCase();
  const isCorrect = normalizeAnswer(answer) === normalizeAnswer(question.correctAnswer);

  return Object.freeze({
    isCorrect,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    score: isCorrect ? 100 : 0,
  });
}

function recalcStats(results: (ValidationResultVO | null)[]): { correctCount: number; answeredCount: number } {
  let correctCount = 0;
  let answeredCount = 0;
  for (const r of results) {
    if (r !== null) {
      answeredCount++;
      if (r.isCorrect) correctCount++;
    }
  }
  return { correctCount, answeredCount };
}

// ==================== FSM 配置 ====================

export function createQuizFSMConfig(): FSMConfig<QuizState, QuizEventType, QuizContext> {
  return {
    id: 'quiz',
    initial: 'IDLE',
    context: createInitialQuizContext(),

    transitions: {
      IDLE: {
        START_SESSION: 'LOADING_MATERIAL',
      },

      LOADING_MATERIAL: {
        FETCH_SUCCESS: {
          target: 'QUESTION_ACTIVE',
          guard: (_ctx, event) => {
            const payload = event.payload as { questions: QuestionEntity[] };
            return Array.isArray(payload?.questions) && payload.questions.length > 0;
          },
          reduce: (_ctx, event) => {
            const payload = event.payload as { questions: QuestionEntity[] };
            const questions = payload.questions;
            return {
              questions,
              currentIndex: 0,
              selectedAnswer: null,
              results: new Array(questions.length).fill(null),
              startTime: Date.now(),
              correctCount: 0,
              answeredCount: 0,
            };
          },
        },
        ABORT_SESSION: { target: 'IDLE' },
      },

      QUESTION_ACTIVE: {
        SELECT_ANSWER: {
          target: 'QUESTION_ACTIVE', // 保持同一状态，仅更新上下文
          reduce: (ctx, event) => {
            const payload = event.payload as { answer: string };
            return { ...ctx, selectedAnswer: payload?.answer ?? null };
          },
        },
        SUBMIT_ANSWER: {
          target: 'EXPLANATION_ACTIVE',
          guard: (ctx) => ctx.selectedAnswer !== null,
          reduce: (ctx) => {
            const question = ctx.questions[ctx.currentIndex];
            if (!question || ctx.selectedAnswer === null) return ctx;

            const result = validateAnswer(question, ctx.selectedAnswer);
            const newResults = [...ctx.results];
            newResults[ctx.currentIndex] = result;
            const stats = recalcStats(newResults);

            return {
              ...ctx,
              results: newResults,
              ...stats,
            };
          },
        },
        ABORT_SESSION: {
          target: 'IDLE',
          reduce: () => createInitialQuizContext(),
        },
      },

      EXPLANATION_ACTIVE: {
        REQUEST_NEXT: {
          target: 'QUESTION_ACTIVE',
          guard: (ctx) => ctx.currentIndex < ctx.questions.length - 1,
          reduce: (ctx) => ({
            ...ctx,
            currentIndex: ctx.currentIndex + 1,
            selectedAnswer: null,
          }),
        },
        FINISH_SESSION: {
          target: 'SESSION_SUMMARY',
        },
        ABORT_SESSION: {
          target: 'IDLE',
          reduce: () => createInitialQuizContext(),
        },
      },

      SESSION_SUMMARY: {
        START_SESSION: {
          target: 'LOADING_MATERIAL',
          reduce: () => createInitialQuizContext(),
        },
        ABORT_SESSION: {
          target: 'IDLE',
          reduce: () => createInitialQuizContext(),
        },
      },
    },
  };
}
