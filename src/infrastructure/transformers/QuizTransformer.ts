/**
 * Quiz 模块转换器
 * 
 * 处理 IndexedDB 存储对象和领域实体之间的双向转换。
 */

import type {
  QuestionEntity,
  QuizArchiveEntity,
  WrongAnswerEntity,
  FavoriteQuestionEntity,
  FavoriteCategoryEntity,
  QuizSessionResultEntity,
} from '../../domain/models';
import { QuestionType } from '../../domain/models';
import {
  safeParseDate,
  safeParseDateOrNull,
  safeParseJsonArray,
  safeString,
  safeNumber,
  safeBoolean,
  safeParseEnum,
} from './hydrators';

export const QuizTransformer = {
  // ——— Question ———

  questionToDomain(raw: unknown): QuestionEntity {
    const r = (raw ?? {}) as Record<string, unknown>;

    return Object.freeze({
      id: safeString(r.id, `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      question: safeString(r.question),
      options: Object.freeze(
        Array.isArray(r.options) ? r.options.map(o => String(o ?? '')) : []
      ),
      correctAnswer: safeString(r.correctAnswer),
      explanation: safeString(r.explanation),
      type: safeParseEnum(
        r.type,
        [QuestionType.Choice, QuestionType.Judgment],
        QuestionType.Choice
      ),
    });
  },

  // ——— QuizArchive ———

  archiveToDomain(raw: unknown): QuizArchiveEntity {
    const r = (raw ?? {}) as Record<string, unknown>;

    return Object.freeze({
      id: safeString(r.id, `arch-${Date.now()}`),
      title: safeString(r.title),
      description: safeString(r.description),
      questions: Object.freeze(
        Array.isArray(r.questions)
          ? r.questions.map(q => QuizTransformer.questionToDomain(q))
          : []
      ),
      category: safeString(r.category),
      tags: safeParseJsonArray(r.tags),
      totalCount: safeNumber(r.totalCount, 0),
      practiceCount: safeNumber(r.practiceCount, 0),
      bestScore: safeNumber(r.bestScore, 0),
      lastPracticeAt: safeParseDateOrNull(r.lastPracticeAt),
      createdAt: safeParseDate(r.createdAt),
      updatedAt: safeParseDate(r.updatedAt),
    });
  },

  archiveToDomainList(rows: unknown): QuizArchiveEntity[] {
    if (!Array.isArray(rows)) return [];
    return rows.map(row => QuizTransformer.archiveToDomain(row));
  },

  archiveToPersistence(entity: QuizArchiveEntity): Record<string, unknown> {
    return {
      id: entity.id,
      title: entity.title,
      description: entity.description || undefined,
      questions: [...entity.questions.map(q => ({ ...q, options: [...q.options] }))],
      category: entity.category,
      tags: [...entity.tags],
      totalCount: entity.totalCount,
      practiceCount: entity.practiceCount,
      bestScore: entity.bestScore,
      lastPracticeAt: entity.lastPracticeAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },

  // ——— WrongAnswer ———

  wrongAnswerToDomain(raw: unknown): WrongAnswerEntity {
    const r = (raw ?? {}) as Record<string, unknown>;

    return Object.freeze({
      id: safeString(r.id, `wa-${Date.now()}`),
      questionId: safeString(r.questionId),
      archiveId: safeString(r.archiveId),
      question: QuizTransformer.questionToDomain(r.question),
      userAnswer: safeString(r.userAnswer),
      wrongCount: safeNumber(r.wrongCount, 1),
      lastWrongAt: safeParseDate(r.lastWrongAt),
      category: safeString(r.category),
      tags: safeParseJsonArray(r.tags),
      notes: safeString(r.notes),
      mastered: safeBoolean(r.mastered, false),
      createdAt: safeParseDate(r.createdAt),
      updatedAt: safeParseDate(r.updatedAt),
    });
  },

  wrongAnswerToDomainList(rows: unknown): WrongAnswerEntity[] {
    if (!Array.isArray(rows)) return [];
    return rows.map(row => QuizTransformer.wrongAnswerToDomain(row));
  },

  wrongAnswerToPersistence(entity: WrongAnswerEntity): Record<string, unknown> {
    return {
      ...entity,
      question: { ...entity.question, options: [...entity.question.options] },
      tags: [...entity.tags],
    };
  },

  // ——— FavoriteQuestion ———

  favoriteQuestionToDomain(raw: unknown): FavoriteQuestionEntity {
    const r = (raw ?? {}) as Record<string, unknown>;

    return Object.freeze({
      id: safeString(r.id, `fq-${Date.now()}`),
      questionId: safeString(r.questionId),
      question: QuizTransformer.questionToDomain(r.question),
      category: safeString(r.category),
      notes: safeString(r.notes),
      sourceType: safeParseEnum(r.sourceType as string, ['quiz', 'wrong-answer'] as const, 'quiz'),
      sourceId: safeString(r.sourceId),
      createdAt: safeParseDate(r.createdAt),
      updatedAt: safeParseDate(r.updatedAt),
    });
  },

  // ——— FavoriteCategory ———

  favoriteCategoryToDomain(raw: unknown): FavoriteCategoryEntity {
    const r = (raw ?? {}) as Record<string, unknown>;

    return Object.freeze({
      id: safeString(r.id, `fc-${Date.now()}`),
      name: safeString(r.name),
      description: safeString(r.description),
      color: safeString(r.color, '#6366f1'),
      order: safeNumber(r.order, 0),
      createdAt: safeParseDate(r.createdAt),
      updatedAt: safeParseDate(r.updatedAt),
    });
  },

  // ——— QuizSessionResult ———

  sessionResultToDomain(raw: unknown): QuizSessionResultEntity {
    const r = (raw ?? {}) as Record<string, unknown>;

    return Object.freeze({
      id: safeString(r.id, `qs-${Date.now()}`),
      archiveId: safeString(r.archiveId),
      title: safeString(r.title),
      totalQuestions: safeNumber(r.totalQuestions, 0),
      correctAnswers: safeNumber(r.correctAnswers, 0),
      score: safeNumber(r.score, 0),
      completedAt: safeParseDate(r.completedAt),
      wrongItems: Object.freeze(
        Array.isArray(r.wrongItems)
          ? r.wrongItems.map((wi: any) => ({
              question: QuizTransformer.questionToDomain(wi?.question),
              userAnswer: safeString(wi?.userAnswer),
            }))
          : []
      ),
    });
  },
};
