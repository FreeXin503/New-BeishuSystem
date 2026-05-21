/**
 * FillBlank 模块领域实体
 */

import { Difficulty } from './SpellingEntity';

// Re-export for convenience
export { Difficulty };

/** 填空题项目实体 */
export interface FillBlankItemEntity {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly hints: readonly string[];      // 空数组代替 undefined
  readonly difficulty: Difficulty;
  readonly category: string;
  readonly tags: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 填空题会话结果实体 */
export interface FillBlankSessionResultEntity {
  readonly sessionId: string;
  readonly totalItems: number;
  readonly correctAnswers: number;
  readonly accuracy: number;
  readonly totalTime: number;
  readonly averageTimePerItem: number;
  readonly hintsUsed: number;
  readonly category: string;
  readonly completedAt: Date;
}

/** 填空题收藏实体 */
export interface FillBlankFavoriteEntity {
  readonly id: string;
  readonly fillBlankItemId: string;
  readonly fillBlankItem: FillBlankItemEntity;
  readonly category: string;
  readonly notes: string;
  readonly tags: readonly string[];
  readonly createdAt: Date;
}

/** 填空题错题实体 */
export interface FillBlankWrongAnswerEntity {
  readonly id: string;
  readonly fillBlankItemId: string;
  readonly fillBlankItem: FillBlankItemEntity;
  readonly userAnswer: string;
  readonly correctAnswer: string;
  readonly category: string;
  readonly wrongCount: number;
  readonly firstWrongAt: Date;
  readonly lastWrongAt: Date;
  readonly mastered: boolean;
  readonly notes: string;
  readonly hints: readonly string[];
}

/** 填空题导入记录实体 */
export interface FillBlankImportRecordEntity {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly itemCount: number;
  readonly category: string;
  readonly tags: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
