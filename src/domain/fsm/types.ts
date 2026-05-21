/**
 * 通用学习状态机类型定义
 * 零框架依赖，纯 TypeScript
 */

// ==================== 标准业务流状态 ====================

/** 学习会话的标准有限状态 */
export type LearningState =
  | 'IDLE'                 // 就绪（主菜单）
  | 'LOADING_MATERIAL'     // 加载材料中
  | 'QUESTION_ACTIVE'      // 题目呈现
  | 'ANSWER_SUBMITTED'     // 已提交答案
  | 'EVALUATING'           // 判定中
  | 'EXPLANATION_ACTIVE'   // 呈现解析
  | 'SESSION_SUMMARY';     // 会话结算

/** 标准输入事件类型 */
export type LearningEventType =
  | 'START_SESSION'
  | 'FETCH_SUCCESS'
  | 'SUBMIT_ANSWER'
  | 'REQUEST_NEXT'
  | 'FINISH_SESSION';

// ==================== 泛型 FSM 核心类型 ====================

/** 带 payload 的事件 */
export interface FSMEvent<TType extends string = string, TPayload = unknown> {
  readonly type: TType;
  readonly payload?: TPayload;
}

/** 状态转移条目 */
export interface TransitionEntry<TState extends string, TEvent extends string, TContext> {
  /** 目标状态 */
  readonly target: TState;
  /** 可选的守卫函数：返回 false 时拦截转移 */
  readonly guard?: (context: TContext, event: FSMEvent<TEvent>) => boolean;
  /** 可选的副作用：转移成功后执行的同步上下文更新 */
  readonly reduce?: (context: TContext, event: FSMEvent<TEvent>) => TContext;
}

/** 状态转移表 — 定义合法转移的白名单 */
export type TransitionTable<TState extends string, TEvent extends string, TContext> = {
  readonly [S in TState]?: {
    readonly [E in TEvent]?: TransitionEntry<TState, TEvent, TContext> | TState;
  };
};

/** 进入/离开状态时的副作用 */
export interface StateEffects<TState extends string, TContext> {
  readonly onEnter?: (context: TContext, state: TState) => TContext | void;
  readonly onExit?: (context: TContext, state: TState) => TContext | void;
}

/** 状态效果映射 */
export type EffectMap<TState extends string, TContext> = {
  readonly [S in TState]?: StateEffects<TState, TContext>;
};

/** 非法转移日志回调 */
export type IllegalTransitionHandler<TState extends string, TEvent extends string> = (
  currentState: TState,
  event: FSMEvent<TEvent>,
  machineId: string
) => void;

/** 状态变更监听器 */
export type StateListener<TState extends string, TContext> = (
  newState: TState,
  oldState: TState,
  context: TContext
) => void;

// ==================== FSM 配置 & 实例 ====================

/** 状态机配置 */
export interface FSMConfig<
  TState extends string,
  TEvent extends string,
  TContext
> {
  /** 状态机唯一标识（用于日志） */
  readonly id: string;
  /** 初始状态 */
  readonly initial: TState;
  /** 初始上下文 */
  readonly context: TContext;
  /** 状态转移表 */
  readonly transitions: TransitionTable<TState, TEvent, TContext>;
  /** 可选的状态进入/离开效果 */
  readonly effects?: EffectMap<TState, TContext>;
  /** 自动转移配置：进入某状态后自动触发下一个事件 */
  readonly autoTransitions?: Readonly<Record<string, FSMEvent<TEvent>>>;
  /** 非法转移回调 */
  readonly onIllegalTransition?: IllegalTransitionHandler<TState, TEvent>;
}

/** 状态机实例 — 运行时 API */
export interface FSMInstance<
  TState extends string,
  TEvent extends string,
  TContext
> {
  /** 获取当前状态 */
  getState(): TState;
  /** 获取当前上下文 */
  getContext(): TContext;
  /** 发送事件触发状态转移。返回 true 表示转移成功 */
  send(event: FSMEvent<TEvent>): boolean;
  /** 判断当前是否处于指定状态之一 */
  isState(...states: TState[]): boolean;
  /** 订阅状态变更。返回取消订阅函数 */
  subscribe(listener: StateListener<TState, TContext>): () => void;
  /** 重置到初始状态 */
  reset(): void;
  /** 直接更新上下文（不触发状态转移），用于外部数据注入 */
  updateContext(updater: (ctx: TContext) => TContext): void;
}

// ==================== React Hook 返回类型 ====================

/** useLearningFSM hook 返回值 */
export interface UseFSMReturn<
  TState extends string,
  TEvent extends string,
  TContext
> {
  /** 当前状态 */
  readonly state: TState;
  /** 当前上下文 */
  readonly context: TContext;
  /** 发送事件 */
  readonly send: (event: FSMEvent<TEvent>) => boolean;
  /** 判断当前状态 */
  readonly isState: (...states: TState[]) => boolean;
  /** 重置状态机 */
  readonly reset: () => void;
  /** 更新上下文 */
  readonly updateContext: (updater: (ctx: TContext) => TContext) => void;
}
