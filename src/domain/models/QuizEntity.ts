/**
 * Quiz 模块领域实体
 */

// ==================== 强枚举 ====================

/** 题目类型 */
export enum QuestionType {
  Choice = 'choice',
  Judgment = 'judgment',
}

// ==================== 领域实体 ====================

/** 题目实体 */
export interface QuestionEntity {
  readonly id: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly correctAnswer: string;
  readonly explanation: string;
  readonly type: QuestionType;
}

/** 题库存档实体 */
export interface QuizArchiveEntity {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly questions: readonly QuestionEntity[];
  readonly category: string;
  readonly tags: readonly string[];
  readonly totalCount: number;
  readonly practiceCount: number;
  readonly bestScore: number;
  readonly lastPracticeAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 错题记录实体 */
export interface WrongAnswerEntity {
  readonly id: string;
  readonly questionId: string;
  readonly archiveId: string;
  readonly question: QuestionEntity;
  readonly userAnswer: string;
  readonly wrongCount: number;
  readonly lastWrongAt: Date;
  readonly category: string;
  readonly tags: readonly string[];
  readonly notes: string;
  readonly mastered: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 收藏题目实体 */
export interface FavoriteQuestionEntity {
  readonly id: string;
  readonly questionId: string;
  readonly question: QuestionEntity;
  readonly category: string;
  readonly notes: string;
  readonly sourceType: 'quiz' | 'wrong-answer';
  readonly sourceId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 收藏分类实体 */
export interface FavoriteCategoryEntity {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly color: string;
  readonly order: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Quiz 会话结果实体 */
export interface QuizSessionResultEntity {
  readonly id: string;
  readonly archiveId: string;
  readonly title: string;
  readonly totalQuestions: number;
  readonly correctAnswers: number;
  readonly score: number;
  readonly completedAt: Date;
  readonly wrongItems: readonly { question: QuestionEntity; userAnswer: string }[];
}

/** 验证结果值对象 */
export interface ValidationResultVO {
  readonly isCorrect: boolean;
  readonly correctAnswer: string;
  readonly explanation: string;
  readonly score: number;
}
