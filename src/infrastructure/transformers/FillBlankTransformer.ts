/**
 * FillBlank 模块转换器
 */

import type {
  FillBlankItemEntity,
  FillBlankSessionResultEntity,
  FillBlankFavoriteEntity,
  FillBlankWrongAnswerEntity,
  FillBlankImportRecordEntity,
} from '../../domain/models';
import {
  safeParseDate,
  safeParseJsonArray,
  parseDifficulty,
  safeString,
  safeNumber,
  safeBoolean,
} from './hydrators';

export const FillBlankTransformer = {
  // ——— FillBlankItem ———

  itemToDomain(raw: unknown): FillBlankItemEntity {
    const r = (raw ?? {}) as Record<string, unknown>;

    return Object.freeze({
      id: safeString(r.id, `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      question: safeString(r.question),
      answer: safeString(r.answer),
      hints: safeParseJsonArray(r.hints),
      difficulty: parseDifficulty(r.difficulty),
      category: safeString(r.category),
      tags: safeParseJsonArray(r.tags),
      createdAt: safeParseDate(r.createdAt),
      updatedAt: safeParseDate(r.updatedAt),
    });
  },

  itemToDomainList(rows: unknown): FillBlankItemEntity[] {
    if (!Array.isArray(rows)) return [];
    return rows.map(row => FillBlankTransformer.itemToDomain(row));
  },

  itemToPersistence(entity: FillBlankItemEntity): Record<string, unknown> {
    return {
      id: entity.id,
      question: entity.question,
      answer: entity.answer,
      hints: [...entity.hints],
      difficulty: entity.difficulty,
      category: entity.category,
      tags: [...entity.tags],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },

  // ——— FillBlankSessionResult ———

  sessionToDomain(raw: unknown): FillBlankSessionResultEntity {
    const r = (raw ?? {}) as Record<string, unknown>;

    return Object.freeze({
      sessionId: safeString(r.sessionId, `fbs-${Date.now()}`),
      totalItems: safeNumber(r.totalItems, 0),
      correctAnswers: safeNumber(r.correctAnswers, 0),
      accuracy: safeNumber(r.accuracy, 0),
      totalTime: safeNumber(r.totalTime, 0),
      averageTimePerItem: safeNumber(r.averageTimePerItem, 0),
      hintsUsed: safeNumber(r.hintsUsed, 0),
      category: safeString(r.category),
      completedAt: safeParseDate(r.completedAt),
    });
  },

  // ——— FillBlankFavorite ———

  favoriteToDomain(raw: unknown): FillBlankFavoriteEntity {
    const r = (raw ?? {}) as Record<string, unknown>;

    return Object.freeze({
      id: safeString(r.id, `fbf-${Date.now()}`),
      fillBlankItemId: safeString(r.fillBlankItemId),
      fillBlankItem: FillBlankTransformer.itemToDomain(r.fillBlankItem),
      category: safeString(r.category),
      notes: safeString(r.notes),
      tags: safeParseJsonArray(r.tags),
      createdAt: safeParseDate(r.createdAt),
    });
  },

  // ——— FillBlankWrongAnswer ———

  wrongAnswerToDomain(raw: unknown): FillBlankWrongAnswerEntity {
    const r = (raw ?? {}) as Record<string, unknown>;

    return Object.freeze({
      id: safeString(r.id, `fbw-${Date.now()}`),
      fillBlankItemId: safeString(r.fillBlankItemId),
      fillBlankItem: FillBlankTransformer.itemToDomain(r.fillBlankItem),
      userAnswer: safeString(r.userAnswer),
      correctAnswer: safeString(r.correctAnswer),
      category: safeString(r.category),
      wrongCount: safeNumber(r.wrongCount, 1),
      firstWrongAt: safeParseDate(r.firstWrongAt),
      lastWrongAt: safeParseDate(r.lastWrongAt),
      mastered: safeBoolean(r.mastered, false),
      notes: safeString(r.notes),
      hints: safeParseJsonArray(r.hints),
    });
  },

  // ——— FillBlankImportRecord ———

  importRecordToDomain(raw: unknown): FillBlankImportRecordEntity {
    const r = (raw ?? {}) as Record<string, unknown>;

    return Object.freeze({
      id: safeString(r.id, `fbi-${Date.now()}`),
      name: safeString(r.name),
      description: safeString(r.description),
      itemCount: safeNumber(r.itemCount, 0),
      category: safeString(r.category),
      tags: safeParseJsonArray(r.tags),
      createdAt: safeParseDate(r.createdAt),
      updatedAt: safeParseDate(r.updatedAt),
    });
  },
};
