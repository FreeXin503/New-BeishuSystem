/**
 * 中文拼写专项 FSM 配置
 * 
 * 将 ChineseSpellingPage 的 28 个 useState 整合为一台状态机。
 */

import type { FSMConfig, FSMEvent } from '../types';
import type { SpellingItemEntity } from '../../models';
import type { SpellingSessionResultEntity } from '../../models/SpellingEntity';
import { PracticeMode } from '../../models';
import {
  checkChineseSpellingAnswer,
  nextChineseSpellingItem,
  initializeChineseSpellingGame,
  generateChineseSpellingSessionResult,
} from '../../../services/learning/chineseSpelling';
import type { ChineseSpellingGameState } from '../../../types';

// ==================== 状态定义 ====================

export type SpellingState =
  | 'IDLE'                   // 主界面/菜单
  | 'IMPORTING'              // 导入界面
  | 'LOADING_MATERIAL'       // 选择开始方式
  | 'QUESTION_ACTIVE'        // 答题中
  | 'ANSWER_SUBMITTED'       // 已提交（自动流转）
  | 'EVALUATING'             // 判定中（自动流转）
  | 'EXPLANATION_ACTIVE'     // 显示结果
  | 'SESSION_SUMMARY';       // 会话结算

// ==================== 事件定义 ====================

export type SpellingEventType =
  | 'START_SESSION'
  | 'FETCH_SUCCESS'
  | 'SUBMIT_ANSWER'
  | 'REQUEST_NEXT'
  | 'REQUEST_RETRY'
  | 'REQUEST_BACK'
  | 'FINISH_SESSION'
  | 'OPEN_IMPORT'
  | 'CLOSE_IMPORT'
  | 'ABORT_SESSION';

export type SpellingEvent = FSMEvent<SpellingEventType>;

// ==================== 上下文定义 ====================

export interface HistoryEntry {
  gameState: ChineseSpellingGameState;
  remainingItems: SpellingItemEntity[];
}

export interface SpellingContext {
  // 练习核心数据
  gameState: ChineseSpellingGameState | null;
  remainingItems: SpellingItemEntity[];
  userAnswer: string;
  isCorrect: boolean;
  hintLevel: number;
  showHint: boolean;

  // 模式 & 配置
  mode: PracticeMode;
  maxHealth: number;

  // 会话统计
  historyStack: HistoryEntry[];
  sessionResult: SpellingSessionResultEntity | null;

  // 供 UI 读取（注入自外部）
  totalItemCount: number;
}

// ==================== 工厂函数 ====================

function createInitialContext(): SpellingContext {
  return {
    gameState: null,
    remainingItems: [],
    userAnswer: '',
    isCorrect: false,
    hintLevel: 0,
    showHint: false,
    mode: PracticeMode.Practice,
    maxHealth: 5,
    historyStack: [],
    sessionResult: null,
    totalItemCount: 0,
  };
}

// ==================== FSM 配置 ====================

export function createSpellingFSMConfig(): FSMConfig<SpellingState, SpellingEventType, SpellingContext> {
  return {
    id: 'chineseSpelling',
    initial: 'IDLE',
    context: createInitialContext(),

    transitions: {
      // ——— IDLE ———
      IDLE: {
        START_SESSION: {
          target: 'LOADING_MATERIAL',
          reduce: (ctx, event) => {
            const payload = event.payload as {
              mode: PracticeMode;
              maxHealth: number;
            };
            return {
              ...ctx,
              mode: payload?.mode ?? PracticeMode.Practice,
              maxHealth: payload?.maxHealth ?? 5,
            };
          },
        },
        OPEN_IMPORT: { target: 'IMPORTING' },
      },

      // ——— IMPORTING ———
      IMPORTING: {
        CLOSE_IMPORT: { target: 'IDLE' },
      },

      // ——— LOADING_MATERIAL ———
      LOADING_MATERIAL: {
        FETCH_SUCCESS: {
          target: 'QUESTION_ACTIVE',
          reduce: (ctx, event) => {
            const payload = event.payload as {
              items: SpellingItemEntity[];
              startIndex?: number;
            };
            const items = payload?.items ?? [];
            const startIndex = payload?.startIndex ?? 0;
            const sliced = items.slice(startIndex);

            if (sliced.length === 0) {
              return ctx; // guard will reject
            }

            const gameState = initializeChineseSpellingGame(
              sliced as any,
              ctx.mode,
              ctx.maxHealth
            );

            return {
              ...ctx,
              gameState,
              remainingItems: sliced,
              userAnswer: '',
              isCorrect: false,
              hintLevel: 0,
              showHint: false,
              historyStack: [],
              sessionResult: null,
              totalItemCount: items.length,
            };
          },
          guard: (_ctx, event) => {
            const payload = event.payload as { items: SpellingItemEntity[] };
            const items = payload?.items ?? [];
            return items.length > 0;
          },
        },
        ABORT_SESSION: { target: 'IDLE' },
      },

      // ——— QUESTION_ACTIVE ———
      QUESTION_ACTIVE: {
        SUBMIT_ANSWER: {
          target: 'ANSWER_SUBMITTED',
          reduce: (ctx, event) => {
            const payload = event.payload as { answer: string };
            return { ...ctx, userAnswer: payload?.answer ?? '' };
          },
          guard: (ctx, event) => {
            // 必须有当前题目且答案非空
            const payload = event.payload as { answer: string };
            return !!(ctx.gameState?.currentItem) && !!(payload?.answer?.trim());
          },
        },
        ABORT_SESSION: {
          target: 'IDLE',
          reduce: (ctx) => ({
            ...ctx,
            gameState: null,
            remainingItems: [],
            historyStack: [],
            sessionResult: null,
          }),
        },
        REQUEST_BACK: {
          target: 'QUESTION_ACTIVE',
          guard: (ctx) => ctx.historyStack.length > 0,
          reduce: (ctx) => {
            if (ctx.historyStack.length === 0) return ctx;
            const prev = ctx.historyStack[ctx.historyStack.length - 1];
            if (!prev?.gameState?.currentItem) return ctx;

            const resetState = {
              ...prev.gameState,
              isAnswered: false,
              isCorrect: false,
              currentAnswer: '',
            };

            return {
              ...ctx,
              gameState: resetState,
              remainingItems: prev.remainingItems,
              historyStack: ctx.historyStack.slice(0, -1),
              userAnswer: '',
              isCorrect: false,
              hintLevel: 0,
              showHint: false,
            };
          },
        },
      },

      // ——— ANSWER_SUBMITTED (auto-transition to EVALUATING) ———
      ANSWER_SUBMITTED: {},

      // ——— EVALUATING (auto-transition to EXPLANATION_ACTIVE) ———
      EVALUATING: {},

      // ——— EXPLANATION_ACTIVE ———
      EXPLANATION_ACTIVE: {
        REQUEST_NEXT: {
          target: 'QUESTION_ACTIVE',
          guard: (_ctx, _event) => !!((_ctx as SpellingContext).gameState),
          reduce: (ctx) => {
            if (!ctx.gameState) return ctx;

            // 保存历史
            const newHistory = [...ctx.historyStack, {
              gameState: ctx.gameState,
              remainingItems: ctx.remainingItems,
            }];

            const result = nextChineseSpellingItem(ctx.gameState, ctx.remainingItems as any);

            if (result.isCompleted) {
              // 将在 guard 外处理，通过 FINISH_SESSION
              return ctx; // guard 会让这条路不走
            }

            return {
              ...ctx,
              gameState: result.gameState,
              remainingItems: result.remainingItems as unknown as SpellingItemEntity[],
              historyStack: newHistory,
              userAnswer: '',
              isCorrect: false,
              hintLevel: 0,
              showHint: false,
            };
          },
        },
        REQUEST_RETRY: {
          target: 'QUESTION_ACTIVE',
          reduce: (ctx) => ({
            ...ctx,
            userAnswer: '',
            isCorrect: false,
            hintLevel: 0,
            showHint: false,
          }),
        },
        FINISH_SESSION: {
          target: 'SESSION_SUMMARY',
          reduce: (ctx) => {
            if (!ctx.gameState) return ctx;

            const sessionResult = generateChineseSpellingSessionResult(
              ctx.gameState,
              ctx.totalItemCount,
              'general'
            ) as unknown as SpellingSessionResultEntity;

            return {
              ...ctx,
              sessionResult,
              gameState: null,
              remainingItems: [],
              historyStack: [],
            };
          },
        },
        ABORT_SESSION: {
          target: 'IDLE',
          reduce: (ctx) => ({
            ...ctx,
            gameState: null,
            remainingItems: [],
            historyStack: [],
            sessionResult: null,
          }),
        },
      },

      // ——— SESSION_SUMMARY ———
      SESSION_SUMMARY: {
        START_SESSION: {
          target: 'LOADING_MATERIAL',
          reduce: (ctx, event) => {
            const payload = event.payload as {
              mode: PracticeMode;
              maxHealth: number;
            };
            return {
              ...ctx,
              mode: payload?.mode ?? ctx.mode,
              maxHealth: payload?.maxHealth ?? ctx.maxHealth,
              sessionResult: null,
            };
          },
        },
        ABORT_SESSION: {
          target: 'IDLE',
          reduce: (ctx) => ({
            ...ctx,
            sessionResult: null,
          }),
        },
      },
    },

    // ——— 自动转移 ———
    autoTransitions: {
      ANSWER_SUBMITTED: { type: 'SUBMIT_ANSWER' as SpellingEventType } as any,
      EVALUATING: { type: 'SUBMIT_ANSWER' as SpellingEventType } as any,
    },

    // ——— 状态进入效果 ———
    effects: {
      ANSWER_SUBMITTED: {
        onEnter: (ctx) => {
          // 立即评估答案
          if (!ctx.gameState) return ctx;
          const newGameState = checkChineseSpellingAnswer(ctx.gameState, ctx.userAnswer);
          return {
            ...ctx,
            gameState: newGameState,
            isCorrect: newGameState.isCorrect,
          };
        },
      },
    },
  };
}
