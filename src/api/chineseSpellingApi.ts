import { getService } from '../lib/di';
import type { ChineseSpellingItem, FavoriteItem } from '../types';

// 获取所有词汇
export async function getAllChineseSpellingItems(): Promise<ChineseSpellingItem[]> {
  return getService('spellingApi').getAllChineseSpellingItems();
}

// 批量创建词汇
export async function createChineseSpellingItems(items: Omit<ChineseSpellingItem, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
  return getService('spellingApi').createChineseSpellingItems(items);
}

// 删除词汇
export async function deleteChineseSpellingItem(id: string): Promise<void> {
  return getService('spellingApi').deleteChineseSpellingItem(id);
}

// 清空所有词汇
export async function clearAllChineseSpellingItems(): Promise<void> {
  return getService('spellingApi').clearAllChineseSpellingItems();
}

// 获取收藏列表
export async function getAllFavorites(): Promise<FavoriteItem[]> {
  return getService('spellingApi').getAllFavorites();
}

// 添加收藏
export async function addFavorite(itemId: string, favoriteDate: string): Promise<void> {
  return getService('spellingApi').addFavorite(itemId, favoriteDate);
}

// 删除收藏
export async function removeFavorite(itemId: string): Promise<void> {
  return getService('spellingApi').removeFavorite(itemId);
}

// 清空收藏
export async function clearFavorites(): Promise<void> {
  return getService('spellingApi').clearFavorites();
}

// 检查是否已收藏
export async function isFavorited(itemId: string): Promise<boolean> {
  return getService('spellingApi').isFavorited(itemId);
}

// 按日期获取收藏
export async function getFavoritesByDate(date: string): Promise<FavoriteItem[]> {
  return getService('spellingApi').getFavoritesByDate(date);
}
