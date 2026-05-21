/**
 * 拼写模块转换器
 * 
 * 负责在 Prisma DB Rows（通过 REST API）和前端领域实体之间进行双向转换。
 * toDomain 接受 unknown 类型 — 这是防腐层的核心设计。
 */

import type { SpellingItemEntity, SpellingFavoriteEntity, SpellingProgressEntity } from '../../domain/models';
import { PracticeMode } from '../../domain/models';
import {
  safeParseDate,
  safeParseJsonArray,
  parseDifficulty,
  safeString,
  safeNumber,
  safeParseEnum,
} from './hydrators';

// ==================== DB Row 原始形状（仅转换器内部使用） ====================

/** Prisma ChineseSpellingItem 的 API 响应形状 */
interface SpellingItemDbRow {
  id: string;
  english: string;
  chinese: string;
  category: string | null;
  tags: string | null;         // JSON 字符串
  difficulty: string | null;   // 裸字符串
  sequence: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** Prisma ChineseSpellingFavorite（含 include: { item: true }）的 API 响应形状 */
interface SpellingFavoriteDbRow {
  id: string;
  itemId: string;
  favoriteDate: string;
  createdAt: string | Date;
  item: SpellingItemDbRow;
}

/** Prisma ChineseSpellingProgress 的 API 响应形状 */
interface ProgressDbRow {
  id: string;
  mode: string;
  currentIndex: number;
  totalItems: number;
  completedCount: number;
  lastPracticedAt: string | Date;
}

// ==================== 转换器 ====================

export const SpellingTransformer = {
  // ——————————————————————————————
  // Item: DB → Domain
  // ——————————————————————————————

  /**
   * 将单个 DB Row 转换为领域实体
   * 接受 unknown — 任何损坏的字段都会被修复为默认值
   */
  toDomain(row: unknown): SpellingItemEntity {
    const r = (row ?? {}) as Partial<SpellingItemDbRow>;

    return Object.freeze({
      id: safeString(r.id, `fallback-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      english: safeString(r.english),
      chinese: safeString(r.chinese),
      category: safeString(r.category),
      tags: safeParseJsonArray(r.tags),
      difficulty: parseDifficulty(r.difficulty),
      sequence: safeNumber(r.sequence, 0),
      createdAt: safeParseDate(r.createdAt),
      updatedAt: safeParseDate(r.updatedAt),
    });
  },

  /**
   * 批量转换，从不中断 — 每行独立容错
   */
  toDomainList(rows: unknown): SpellingItemEntity[] {
    if (!Array.isArray(rows)) return [];
    return rows.map(row => SpellingTransformer.toDomain(row));
  },

  // ——————————————————————————————
  // Item: Domain → Persistence
  // ——————————————————————————————

  /**
   * 领域实体 → API 请求体（用于创建/更新）
   */
  toPersistence(entity: SpellingItemEntity): Record<string, unknown> {
    return {
      id: entity.id,
      english: entity.english,
      chinese: entity.chinese,
      category: entity.category || null,
      tags: entity.tags.length > 0 ? JSON.stringify([...entity.tags]) : null,
      difficulty: entity.difficulty,
      sequence: entity.sequence,
    };
  },

  /**
   * 创建请求的 payload（不含 id/timestamps）
   */
  toCreatePayload(
    data: Omit<SpellingItemEntity, 'id' | 'sequence' | 'createdAt' | 'updatedAt'>
  ): Record<string, unknown> {
    return {
      english: data.english,
      chinese: data.chinese,
      category: data.category || null,
      tags: data.tags.length > 0 ? [...data.tags] : undefined,
      difficulty: data.difficulty,
    };
  },

  // ——————————————————————————————
  // Favorite: DB → Domain
  // ——————————————————————————————

  favoriteToDomain(row: unknown): SpellingFavoriteEntity {
    const r = (row ?? {}) as Partial<SpellingFavoriteDbRow>;

    return Object.freeze({
      id: safeString(r.id, `fav-${Date.now()}`),
      itemId: safeString(r.itemId),
      item: SpellingTransformer.toDomain(r.item),
      favoriteDate: safeString(r.favoriteDate, new Date().toISOString().split('T')[0]),
      createdAt: safeParseDate(r.createdAt),
    });
  },

  favoriteToDomainList(rows: unknown): SpellingFavoriteEntity[] {
    if (!Array.isArray(rows)) return [];
    return rows.map(row => SpellingTransformer.favoriteToDomain(row));
  },

  // ——————————————————————————————
  // Progress: DB → Domain
  // ——————————————————————————————

  progressToDomain(row: unknown): SpellingProgressEntity | null {
    if (row === null || row === undefined) return null;
    const r = row as Partial<ProgressDbRow>;

    return Object.freeze({
      id: safeString(r.id, `prog-${Date.now()}`),
      mode: safeParseEnum(r.mode, [PracticeMode.Practice, PracticeMode.Challenge], PracticeMode.Practice),
      currentIndex: safeNumber(r.currentIndex, 0),
      totalItems: safeNumber(r.totalItems, 0),
      completedCount: safeNumber(r.completedCount, 0),
      lastPracticedAt: safeParseDate(r.lastPracticedAt),
    });
  },
};
