/**
 * FSM 配置模块公共 API
 */

export {
  createSpellingFSMConfig,
  type SpellingState,
  type SpellingEventType,
  type SpellingEvent,
  type SpellingContext,
  type HistoryEntry,
} from './chineseSpellingFSM';

export {
  createQuizFSMConfig,
  type QuizState,
  type QuizEventType,
  type QuizEvent,
  type QuizContext,
} from './quizFSM';

export {
  createFillBlankFSMConfig,
  type FillBlankState,
  type FillBlankEventType,
  type FillBlankEvent,
  type FillBlankContext,
  type BlankEntry,
} from './fillBlankFSM';
