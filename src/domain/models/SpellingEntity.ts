/**
 * 拼写模块领域实体
 * 
 * 类型纯净、完全对前端友好的数据接口。
 * - tags 是原生 string[]（非 JSON 字符串）
 * - difficulty 是强枚举（非裸 string）
 * - 所有可选字段使用有意义的默认值代替 undefined
 */

// ==================== 强枚举 ====================

/** 难度等级 */
export enum Difficulty {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard',
}

/** 练习模式 */
export enum PracticeMode {
  Practice = 'practice',
  Challenge = 'challenge',
}

// ==================== 领域实体 ====================

/** 拼写词汇实体 */
export interface SpellingItemEntity {
  readonly id: string;
  readonly english: string;
  readonly chinese: string;
  readonly category: string;             // 空字符串代替 undefined/null
  readonly tags: readonly string[];      // 原生数组，非 JSON 字符串
  readonly difficulty: Difficulty;       // 强枚举
  readonly sequence: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 拼写收藏实体 */
export interface SpellingFavoriteEntity {
  readonly id: string;
  readonly itemId: string;
  readonly item: SpellingItemEntity;
  readonly favoriteDate: string;          // YYYY-MM-DD
  readonly createdAt: Date;
}

/** 练习进度实体 */
export interface SpellingProgressEntity {
  readonly id: string;
  readonly mode: PracticeMode;
  readonly currentIndex: number;
  readonly totalItems: number;
  readonly completedCount: number;
  readonly lastPracticedAt: Date;
}

/** 拼写会话结果实体 */
export interface SpellingSessionResultEntity {
  readonly sessionId: string;
  readonly totalItems: number;
  readonly correctAnswers: number;
  readonly accuracy: number;
  readonly totalTime: number;
  readonly averageTimePerItem: number;
  readonly mode: PracticeMode;
  readonly category: string;
  readonly completedAt: Date;
  readonly finalHealth?: number;
  readonly maxHealth?: number;
}
