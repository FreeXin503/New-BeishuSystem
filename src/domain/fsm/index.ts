/**
 * FSM 模块公共 API
 */

export { createLearningFSM } from './createLearningFSM';
export { useLearningFSM } from './useLearningFSM';
export type {
  // 标准状态 & 事件
  LearningState,
  LearningEventType,
  // 泛型核心类型
  FSMEvent,
  FSMConfig,
  FSMInstance,
  TransitionEntry,
  TransitionTable,
  StateEffects,
  EffectMap,
  StateListener,
  IllegalTransitionHandler,
  // React 绑定
  UseFSMReturn,
} from './types';

// FSM 配置
export {
  createSpellingFSMConfig,
  createQuizFSMConfig,
  createFillBlankFSMConfig,
} from './configs';

export type {
  SpellingState,
  SpellingEventType,
  SpellingEvent,
  SpellingContext,
  QuizState,
  QuizEventType,
  QuizEvent,
  QuizContext,
  FillBlankState,
  FillBlankEventType,
  FillBlankEvent,
  FillBlankContext,
  BlankEntry,
} from './configs';
