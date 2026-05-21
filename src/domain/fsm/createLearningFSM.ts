/**
 * 通用学习状态机引擎
 * 
 * 轻量、无框架依赖的有限状态机核心实现。
 * 通过 send(event) 机制触发状态转移，严格禁止非法越级转移。
 */

import type {
  FSMConfig,
  FSMInstance,
  FSMEvent,
  TransitionEntry,
  StateListener,
} from './types';

/**
 * 默认的非法转移处理器 — 静默拦截并记录 Telemetry 日志
 */
function defaultIllegalTransitionHandler<TState extends string, TEvent extends string>(
  currentState: TState,
  event: FSMEvent<TEvent>,
  machineId: string
): void {
  console.warn(
    `[FSM:${machineId}] Illegal transition blocked: ` +
    `state="${currentState}" + event="${event.type}" → no valid transition defined`
  );
}

/**
 * 规范化转移条目：支持简写（直接写目标状态字符串）和完整对象两种形式
 */
function normalizeTransitionEntry<TState extends string, TEvent extends string, TContext>(
  entry: TransitionEntry<TState, TEvent, TContext> | TState | undefined
): TransitionEntry<TState, TEvent, TContext> | null {
  if (entry === undefined || entry === null) return null;
  if (typeof entry === 'string') {
    return { target: entry as TState };
  }
  return entry;
}

/**
 * 创建一个学习状态机实例
 * 
 * @example
 * ```ts
 * const fsm = createLearningFSM({
 *   id: 'quiz',
 *   initial: 'IDLE',
 *   context: { score: 0 },
 *   transitions: {
 *     IDLE: { START_SESSION: 'LOADING_MATERIAL' },
 *     LOADING_MATERIAL: { FETCH_SUCCESS: 'QUESTION_ACTIVE' },
 *     // ...
 *   },
 * });
 * 
 * fsm.send({ type: 'START_SESSION' }); // → LOADING_MATERIAL
 * fsm.send({ type: 'SUBMIT_ANSWER' }); // → blocked! (illegal from LOADING_MATERIAL)
 * ```
 */
export function createLearningFSM<
  TState extends string,
  TEvent extends string,
  TContext
>(config: FSMConfig<TState, TEvent, TContext>): FSMInstance<TState, TEvent, TContext> {
  // ——— 内部可变状态 ———
  let currentState: TState = config.initial;
  let currentContext: TContext = { ...config.context };
  let listeners: Set<StateListener<TState, TContext>> = new Set();
  let isProcessing = false; // 防止递归 send

  const onIllegalTransition = config.onIllegalTransition ?? defaultIllegalTransitionHandler;

  /**
   * 通知所有订阅者
   */
  function notifyListeners(oldState: TState): void {
    for (const listener of listeners) {
      try {
        listener(currentState, oldState, currentContext);
      } catch (err) {
        console.error(`[FSM:${config.id}] Listener error:`, err);
      }
    }
  }

  /**
   * 执行状态进入/离开效果
   */
  function executeEffects(type: 'onEnter' | 'onExit', state: TState): void {
    const stateEffects = config.effects?.[state];
    if (!stateEffects) return;

    const effectFn = stateEffects[type];
    if (!effectFn) return;

    try {
      const result = effectFn(currentContext, state);
      if (result !== undefined && result !== null) {
        currentContext = result as TContext;
      }
    } catch (err) {
      console.error(`[FSM:${config.id}] Effect error (${type} ${state}):`, err);
    }
  }

  /**
   * 尝试执行自动转移
   */
  function tryAutoTransition(): void {
    const autoEvent = config.autoTransitions?.[currentState as string];
    if (autoEvent) {
      // 使用 microtask 避免同步递归
      queueMicrotask(() => {
        instance.send(autoEvent);
      });
    }
  }

  const instance: FSMInstance<TState, TEvent, TContext> = {
    getState(): TState {
      return currentState;
    },

    getContext(): TContext {
      return currentContext;
    },

    send(event: FSMEvent<TEvent>): boolean {
      // 防止递归 send 导致状态混乱
      if (isProcessing) {
        console.warn(
          `[FSM:${config.id}] Reentrant send blocked: ` +
          `event="${event.type}" while processing another transition`
        );
        return false;
      }

      isProcessing = true;

      try {
        // 1. 查询当前状态下的转移表
        const stateTransitions = config.transitions[currentState];
        if (!stateTransitions) {
          onIllegalTransition(currentState, event, config.id);
          return false;
        }

        // 2. 查找事件对应的转移条目
        const rawEntry = stateTransitions[event.type as TEvent];
        const entry = normalizeTransitionEntry<TState, TEvent, TContext>(rawEntry);

        if (!entry) {
          onIllegalTransition(currentState, event, config.id);
          return false;
        }

        // 3. 执行守卫检查
        if (entry.guard && !entry.guard(currentContext, event)) {
          console.warn(
            `[FSM:${config.id}] Transition guard rejected: ` +
            `state="${currentState}" + event="${event.type}"`
          );
          return false;
        }

        // 4. 记录旧状态
        const oldState = currentState;

        // 5. 执行离开效果
        executeEffects('onExit', oldState);

        // 6. 执行 reduce（上下文更新）
        if (entry.reduce) {
          try {
            currentContext = entry.reduce(currentContext, event);
          } catch (err) {
            console.error(`[FSM:${config.id}] Reduce error:`, err);
          }
        }

        // 7. 转移到新状态
        currentState = entry.target;

        // 8. 执行进入效果
        executeEffects('onEnter', currentState);

        // 9. 通知订阅者
        notifyListeners(oldState);

        // 10. 尝试自动转移
        tryAutoTransition();

        return true;
      } finally {
        isProcessing = false;
      }
    },

    isState(...states: TState[]): boolean {
      return states.includes(currentState);
    },

    subscribe(listener: StateListener<TState, TContext>): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    reset(): void {
      const oldState = currentState;
      executeEffects('onExit', currentState);
      currentState = config.initial;
      currentContext = { ...config.context };
      executeEffects('onEnter', currentState);
      notifyListeners(oldState);
    },

    updateContext(updater: (ctx: TContext) => TContext): void {
      currentContext = updater(currentContext);
      // 上下文更新不触发状态转移，但通知订阅者
      notifyListeners(currentState);
    },
  };

  // 初始状态的进入效果
  executeEffects('onEnter', config.initial);

  return instance;
}
