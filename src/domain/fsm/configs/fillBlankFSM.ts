/**
 * FillBlank 填空题专项 FSM 配置
 * 
 * 将 FillBlank.tsx 的分散状态整合为一台状态机。
 */

import type { FSMConfig, FSMEvent } from '../types';

// ==================== 状态定义 ====================

export type FillBlankState =
  | 'IDLE'
  | 'LOADING_MATERIAL'
  | 'QUESTION_ACTIVE'
  | 'ANSWER_SUBMITTED'
  | 'EVALUATING'
  | 'EXPLANATION_ACTIVE'
  | 'SESSION_SUMMARY';

// ==================== 事件定义 ====================

export type FillBlankEventType =
  | 'START_SESSION'
  | 'FETCH_SUCCESS'
  | 'UPDATE_BLANK'
  | 'VALIDATE_BLANK'
  | 'SHOW_HINT'
  | 'SUBMIT_ALL'
  | 'REQUEST_NEXT'
  | 'FINISH_SESSION'
  | 'ABORT_SESSION';

export type FillBlankEvent = FSMEvent<FillBlankEventType>;

// ==================== 上下文定义 ====================

export interface BlankEntry {
  id: string;
  value: string;
  validated: boolean;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  score: number;
  showHint: boolean;
  hint: string;
}

export interface FillBlankContext {
  text: string;
  blanks: BlankEntry[];
  startTime: number;

  // 统计
  totalBlanks: number;
  completedBlanks: number;
  correctBlanks: number;
}

function createInitialFillBlankContext(): FillBlankContext {
  return {
    text: '',
    blanks: [],
    startTime: Date.now(),
    totalBlanks: 0,
    completedBlanks: 0,
    correctBlanks: 0,
  };
}

// ==================== FSM 配置 ====================

export function createFillBlankFSMConfig(): FSMConfig<FillBlankState, FillBlankEventType, FillBlankContext> {
  return {
    id: 'fillBlank',
    initial: 'IDLE',
    context: createInitialFillBlankContext(),

    transitions: {
      IDLE: {
        START_SESSION: 'LOADING_MATERIAL',
      },

      LOADING_MATERIAL: {
        FETCH_SUCCESS: {
          target: 'QUESTION_ACTIVE',
          guard: (_ctx, event) => {
            const payload = event.payload as { text: string; blanks: any[] };
            return !!(payload?.text) && Array.isArray(payload?.blanks) && payload.blanks.length > 0;
          },
          reduce: (_ctx, event) => {
            const payload = event.payload as {
              text: string;
              blanks: Array<{ id: string; answer: string; hint?: string }>;
            };

            const blankEntries: BlankEntry[] = payload.blanks.map(b => ({
              id: b.id,
              value: '',
              validated: false,
              isCorrect: false,
              correctAnswer: b.answer,
              explanation: '',
              score: 0,
              showHint: false,
              hint: b.hint ?? '',
            }));

            return {
              text: payload.text,
              blanks: blankEntries,
              startTime: Date.now(),
              totalBlanks: blankEntries.length,
              completedBlanks: 0,
              correctBlanks: 0,
            };
          },
        },
        ABORT_SESSION: { target: 'IDLE' },
      },

      QUESTION_ACTIVE: {
        UPDATE_BLANK: {
          target: 'QUESTION_ACTIVE',
          reduce: (ctx, event) => {
            const payload = event.payload as { blankId: string; value: string };
            if (!payload) return ctx;

            const blanks = ctx.blanks.map(b =>
              b.id === payload.blankId ? { ...b, value: payload.value } : b
            );
            return { ...ctx, blanks };
          },
        },
        VALIDATE_BLANK: {
          target: 'QUESTION_ACTIVE',
          reduce: (ctx, event) => {
            const payload = event.payload as { blankId: string };
            if (!payload) return ctx;

            const blanks = ctx.blanks.map(b => {
              if (b.id !== payload.blankId) return b;

              const normalized = (s: string) => s.trim().toLowerCase();
              const isCorrect = normalized(b.value) === normalized(b.correctAnswer);

              return {
                ...b,
                validated: true,
                isCorrect,
                score: isCorrect ? 100 : 0,
              };
            });

            const completedBlanks = blanks.filter(b => b.validated).length;
            const correctBlanks = blanks.filter(b => b.validated && b.isCorrect).length;

            return { ...ctx, blanks, completedBlanks, correctBlanks };
          },
        },
        SHOW_HINT: {
          target: 'QUESTION_ACTIVE',
          reduce: (ctx, event) => {
            const payload = event.payload as { blankId: string };
            if (!payload) return ctx;

            const blanks = ctx.blanks.map(b =>
              b.id === payload.blankId ? { ...b, showHint: true } : b
            );
            return { ...ctx, blanks };
          },
        },
        SUBMIT_ALL: {
          target: 'EXPLANATION_ACTIVE',
          reduce: (ctx) => {
            // 验证所有未验证的空位
            const blanks = ctx.blanks.map(b => {
              if (b.validated) return b;

              const normalized = (s: string) => s.trim().toLowerCase();
              const isCorrect = normalized(b.value) === normalized(b.correctAnswer);

              return {
                ...b,
                validated: true,
                isCorrect,
                score: isCorrect ? 100 : 0,
              };
            });

            const completedBlanks = blanks.filter(b => b.validated).length;
            const correctBlanks = blanks.filter(b => b.validated && b.isCorrect).length;

            return { ...ctx, blanks, completedBlanks, correctBlanks };
          },
        },
        ABORT_SESSION: {
          target: 'IDLE',
          reduce: () => createInitialFillBlankContext(),
        },
      },

      EXPLANATION_ACTIVE: {
        REQUEST_NEXT: {
          target: 'QUESTION_ACTIVE',
          reduce: () => createInitialFillBlankContext(),
        },
        FINISH_SESSION: {
          target: 'SESSION_SUMMARY',
        },
        ABORT_SESSION: {
          target: 'IDLE',
          reduce: () => createInitialFillBlankContext(),
        },
      },

      SESSION_SUMMARY: {
        START_SESSION: {
          target: 'LOADING_MATERIAL',
          reduce: () => createInitialFillBlankContext(),
        },
        ABORT_SESSION: {
          target: 'IDLE',
          reduce: () => createInitialFillBlankContext(),
        },
      },
    },
  };
}
