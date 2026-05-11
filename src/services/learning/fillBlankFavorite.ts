/**
 * 填空题收藏服务
 */

import type { FillBlankItem, FillBlankFavorite } from '../../types';
import {
  getAllFillBlankFavorites as getAllFavorites,
  saveFillBlankFavorite,
  deleteFillBlankFavorite,
  getFillBlankFavoritesByCategory as getFavoritesByCategory,
  getFillBlankFavoritesByItemId as getFavoritesByItemId,
} from '../storage/indexedDB';

// 默认分类
export const DEFAULT_FILL_BLANK_CATEGORIES = [
  { value: 'general', label: '通用' },
  { value: 'politics', label: '政治' },
  { value: 'history', label: '历史' },
  { value: 'philosophy', label: '哲学' },
  { value: 'economics', label: '经济学' },
  { value: 'law', label: '法学' },
  { value: 'custom', label: '自定义' },
];

/**
 * 获取分类标签
 */
export function getFillBlankCategoryLabel(category: string): string {
  const found = DEFAULT_FILL_BLANK_CATEGORIES.find(cat => cat.value === category);
  return found?.label || category;
}

/**
 * 添加填空题到收藏夹
 */
export async function addFillBlankToFavorites(
  fillBlankItem: FillBlankItem,
  category: string = 'default',
  notes?: string,
  tags?: string[]
): Promise<FillBlankFavorite> {
  // 检查是否已经收藏
  const existing = await getFavoritesByItemId(fillBlankItem.id);
  if (existing.length > 0) {
    throw new Error('该填空题已经在收藏夹中');
  }

  const favorite: FillBlankFavorite = {
    id: `fill-blank-fav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    fillBlankItemId: fillBlankItem.id,
    fillBlankItem,
    category,
    notes,
    createdAt: new Date(),
    tags,
  };

  await saveFillBlankFavorite(favorite);
  return favorite;
}

/**
 * 从收藏夹移除填空题
 */
export async function removeFillBlankFromFavorites(favoriteId: string): Promise<void> {
  await deleteFillBlankFavorite(favoriteId);
}

/**
 * 切换填空题收藏状态
 */
export async function toggleFillBlankFavorite(
  fillBlankItem: FillBlankItem,
  category: string = 'default',
  notes?: string,
  tags?: string[]
): Promise<{ added: boolean; favorite?: FillBlankFavorite }> {
  try {
    const favorite = await addFillBlankToFavorites(fillBlankItem, category, notes, tags);
    return { added: true, favorite };
  } catch (error) {
    // 如果已经收藏，则取消收藏
    const existing = await getFavoritesByItemId(fillBlankItem.id);
    if (existing.length > 0) {
      await removeFillBlankFromFavorites(existing[0].id);
      return { added: false };
    }
    throw error;
  }
}

/**
 * 获取所有收藏的填空题
 */
export async function getAllFillBlankFavoritesList(): Promise<FillBlankFavorite[]> {
  return getAllFavorites();
}

/**
 * 根据分类获取收藏的填空题
 */
export async function getFillBlankFavoritesByCategory(category: string): Promise<FillBlankFavorite[]> {
  return getFavoritesByCategory(category);
}

/**
 * 检查填空题是否已收藏
 */
export async function isFillBlankFavorited(fillBlankItemId: string): Promise<boolean> {
  const favorites = await getFavoritesByItemId(fillBlankItemId);
  return favorites.length > 0;
}

/**
 * 更新收藏笔记
 */
export async function updateFillBlankFavoriteNotes(favoriteId: string, notes: string): Promise<void> {
  const favorites = await getAllFillBlankFavoritesList();
  const favorite = favorites.find((f: FillBlankFavorite) => f.id === favoriteId);
  
  if (!favorite) {
    throw new Error('收藏项不存在');
  }

  favorite.notes = notes;
  await saveFillBlankFavorite(favorite);
}

/**
 * 更新收藏标签
 */
export async function updateFillBlankFavoriteTags(favoriteId: string, tags: string[]): Promise<void> {
  const favorites = await getAllFillBlankFavoritesList();
  const favorite = favorites.find((f: FillBlankFavorite) => f.id === favoriteId);
  
  if (!favorite) {
    throw new Error('收藏项不存在');
  }

  favorite.tags = tags;
  await saveFillBlankFavorite(favorite);
}

/**
 * 批量添加填空题到收藏夹
 */
export async function addFillBlankFavoritesFromItems(
  fillBlankItems: FillBlankItem[],
  category: string = 'default'
): Promise<FillBlankFavorite[]> {
  const results: FillBlankFavorite[] = [];
  
  for (const item of fillBlankItems) {
    try {
      const favorite = await addFillBlankToFavorites(item, category);
      results.push(favorite);
    } catch (error) {
      // 忽略已收藏的项目
      console.warn(`填空题 ${item.id} 已收藏，跳过`);
    }
  }
  
  return results;
}

/**
 * 搜索收藏的填空题
 */
export async function searchFillBlankFavorites(query: string): Promise<FillBlankFavorite[]> {
  const allFavorites = await getAllFillBlankFavoritesList();
  const lowerQuery = query.toLowerCase();
  
  return allFavorites.filter(favorite => 
    favorite.fillBlankItem.question.toLowerCase().includes(lowerQuery) ||
    favorite.fillBlankItem.answer.toLowerCase().includes(lowerQuery) ||
    (favorite.notes && favorite.notes.toLowerCase().includes(lowerQuery)) ||
    (favorite.tags && favorite.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery)))
  );
}

/**
 * 获取收藏统计
 */
export async function getFillBlankFavoriteStats(): Promise<{ total: number; byCategory: Record<string, number> }> {
  const allFavorites = await getAllFillBlankFavoritesList();
  const stats = {
    total: allFavorites.length,
    byCategory: {} as Record<string, number>,
  };
  
  allFavorites.forEach((favorite: FillBlankFavorite) => {
    stats.byCategory[favorite.category] = (stats.byCategory[favorite.category] || 0) + 1;
  });
  
  return stats;
}
