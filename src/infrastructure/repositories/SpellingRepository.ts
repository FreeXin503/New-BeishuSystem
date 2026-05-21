/**
 * 拼写词汇统一仓储
 * 
 * 对外界（UI / Hook）吞吐的必须是提纯后的 Entity，
 * 内部隐藏 Transformer 的转换细节和 API 调用实现。
 */

import type {
  SpellingItemEntity,
  SpellingFavoriteEntity,
  SpellingProgressEntity,
} from '../../domain/models';
import { PracticeMode } from '../../domain/models';
import { SpellingTransformer } from '../transformers/SpellingTransformer';

const API_BASE = 'http://localhost:3001/api';

/**
 * 安全的 fetch 包装 — 网络错误不会抛到调用方
 */
async function safeFetch<T>(
  url: string,
  options?: RequestInit,
  fallback?: T
): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      console.error(`[SpellingRepository] HTTP ${res.status}: ${url}`);
      return fallback as T;
    }
    return await res.json();
  } catch (err) {
    console.error(`[SpellingRepository] Network error: ${url}`, err);
    return fallback as T;
  }
}

export const SpellingRepository = {
  // ==================== Items ====================

  /**
   * 获取所有词汇（已转换为领域实体）
   */
  async getAllItems(): Promise<SpellingItemEntity[]> {
    const raw = await safeFetch<unknown[]>(`${API_BASE}/items`, undefined, []);
    return SpellingTransformer.toDomainList(raw);
  },

  /**
   * 批量创建词汇
   */
  async createItems(
    items: Array<{ english: string; chinese: string; category?: string; tags?: string[]; difficulty?: string }>
  ): Promise<{ success: boolean; count: number }> {
    const result = await safeFetch<{ success: boolean; count: number }>(
      `${API_BASE}/items`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      },
      { success: false, count: 0 }
    );
    return result;
  },

  /**
   * 删除单个词汇
   */
  async deleteItem(id: string): Promise<void> {
    await safeFetch(`${API_BASE}/items/${id}`, { method: 'DELETE' });
  },

  /**
   * 清空所有词汇
   */
  async clearAllItems(): Promise<void> {
    await safeFetch(`${API_BASE}/items`, { method: 'DELETE' });
  },

  // ==================== Favorites ====================

  /**
   * 获取所有收藏（已转换为领域实体）
   */
  async getAllFavorites(): Promise<SpellingFavoriteEntity[]> {
    const raw = await safeFetch<unknown[]>(`${API_BASE}/favorites`, undefined, []);
    return SpellingTransformer.favoriteToDomainList(raw);
  },

  /**
   * 获取指定日期的收藏
   */
  async getFavoritesByDate(date: string): Promise<SpellingFavoriteEntity[]> {
    const raw = await safeFetch<unknown[]>(`${API_BASE}/favorites/${date}`, undefined, []);
    return SpellingTransformer.favoriteToDomainList(raw);
  },

  /**
   * 添加收藏
   */
  async addFavorite(itemId: string, favoriteDate: string): Promise<void> {
    await safeFetch(`${API_BASE}/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, favoriteDate }),
    });
  },

  /**
   * 删除收藏
   */
  async removeFavorite(itemId: string): Promise<void> {
    await safeFetch(`${API_BASE}/favorites/${itemId}`, { method: 'DELETE' });
  },

  /**
   * 清空所有收藏
   */
  async clearAllFavorites(): Promise<void> {
    await safeFetch(`${API_BASE}/favorites`, { method: 'DELETE' });
  },

  // ==================== Progress ====================

  /**
   * 获取练习进度
   */
  async getProgress(mode: PracticeMode): Promise<SpellingProgressEntity | null> {
    const raw = await safeFetch<unknown>(`${API_BASE}/progress/${mode}`, undefined, null);
    return SpellingTransformer.progressToDomain(raw);
  },

  /**
   * 保存练习进度
   */
  async saveProgress(data: {
    mode: PracticeMode;
    currentIndex: number;
    totalItems: number;
    completedCount: number;
  }): Promise<void> {
    await safeFetch(`${API_BASE}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  /**
   * 重置练习进度
   */
  async deleteProgress(mode: PracticeMode): Promise<void> {
    await safeFetch(`${API_BASE}/progress/${mode}`, { method: 'DELETE' });
  },
};
