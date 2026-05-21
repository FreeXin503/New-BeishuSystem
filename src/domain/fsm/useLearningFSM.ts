/**
 * React 绑定层 — 将 FSM 引擎桥接为 React hook
 * 
 * 使用 useReducer + useRef 确保：
 * - send() 始终引用最新状态（避免闭包过期）
 * - 状态 + 上下文在同一个 dispatch 中原子更新
 * - 外部事件处理函数不再需要 useCallback 依赖大量状态变量
 */

import { useReducer, useRef, useEffect, useCallback, useMemo } from 'react';
import { createLearningFSM } from './createLearningFSM';
import type {
  FSMConfig,
  FSMInstance,
  FSMEvent,
  UseFSMReturn,
} from './types';

/** 内部 reducer 状态 */
interface FSMReducerState<TState extends string, TContext> {
  state: TState;
  context: TContext;
  /** 单调递增的版本号，强制 React 重渲染 */
  version: number;
}

/** Reducer action */
type FSMReducerAction<TState extends string, TContext> =
  | { type: 'SYNC'; state: TState; context: TContext }
  | { type: 'RESET'; state: TState; context: TContext };

function fsmReducer<TState extends string, TContext>(
  prev: FSMReducerState<TState, TContext>,
  action: FSMReducerAction<TState, TContext>
): FSMReducerState<TState, TContext> {
  switch (action.type) {
    case 'SYNC':
      // 仅在状态或上下文实际变化时生成新对象
      if (prev.state === action.state && prev.context === action.context) {
        return prev;
      }
      return {
        state: action.state,
        context: action.context,
        version: prev.version + 1,
      };
    case 'RESET':
      return {
        state: action.state,
        context: action.context,
        version: prev.version + 1,
      };
    default:
      return prev;
  }
}

/**
 * React Hook：将 FSM 引擎绑定到 React 组件生命周期
 * 
 * @example
 * ```tsx
 * const { state, context, send, isState } = useLearningFSM(quizFSMConfig);
 * 
 * // UI 驱动
 * if (isState('QUESTION_ACTIVE')) {
 *   return <QuestionView onSubmit={() => send({ type: 'SUBMIT_ANSWER', payload: answer })} />;
 * }
 * ```
 */
export function useLearningFSM<
  TState extends string,
  TEvent extends string,
  TContext
>(
  config: FSMConfig<TState, TEvent, TContext>
): UseFSMReturn<TState, TEvent, TContext> {
  // 使用 ref 持有 FSM 实例，确保跨渲染周期稳定
  const fsmRef = useRef<FSMInstance<TState, TEvent, TContext> | null>(null);

  // 惰性初始化 FSM 实例
  if (fsmRef.current === null) {
    fsmRef.current = createLearningFSM(config);
  }

  const fsm = fsmRef.current;

  // Reducer 管理 React 侧的状态快照
  const [reducerState, dispatch] = useReducer(
    fsmReducer<TState, TContext>,
    {
      state: fsm.getState(),
      context: fsm.getContext(),
      version: 0,
    }
  );

  // 订阅 FSM 状态变更 → 同步到 React
  useEffect(() => {
    const unsubscribe = fsm.subscribe((newState, _oldState, context) => {
      dispatch({ type: 'SYNC', state: newState, context });
    });
    return unsubscribe;
  }, [fsm]);

  // 稳定引用的 send 函数 — 永不过期
  const send = useCallback(
    (event: FSMEvent<TEvent>): boolean => {
      return fsm.send(event);
    },
    [fsm]
  );

  // 稳定引用的 isState 函数
  const isState = useCallback(
    (...states: TState[]): boolean => {
      return states.includes(reducerState.state);
    },
    [reducerState.state]
  );

  // 稳定引用的 reset 函数
  const reset = useCallback(() => {
    fsm.reset();
    dispatch({
      type: 'RESET',
      state: fsm.getState(),
      context: fsm.getContext(),
    });
  }, [fsm]);

  // 稳定引用的 updateContext 函数
  const updateContext = useCallback(
    (updater: (ctx: TContext) => TContext): void => {
      fsm.updateContext(updater);
      dispatch({
        type: 'SYNC',
        state: fsm.getState(),
        context: fsm.getContext(),
      });
    },
    [fsm]
  );

  // 使用 useMemo 确保返回值引用稳定
  return useMemo(
    () => ({
      state: reducerState.state,
      context: reducerState.context,
      send,
      isState,
      reset,
      updateContext,
    }),
    [reducerState.state, reducerState.context, send, isState, reset, updateContext]
  );
}
