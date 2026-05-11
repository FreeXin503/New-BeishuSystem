/**
 * 收藏题目服务
 */

import type { Question, FavoriteQuestion, FavoriteCategory, FavoriteStats, WrongAnswer } from '../../types';
import {
  getAllFavorites,
  saveFavorite,
  deleteFavorite,
  getFavoriteByQuestionId,
  getFavoritesByCategory,
  getAllFavoriteCategories,
  saveFavoriteCategory,
  deleteFavoriteCategory,
} from '../storage/indexedDB';

/**
 * 添加收藏
 */
export async function addFavorite(
  question: Question,
  category: string,
  sourceType: 'quiz' | 'wrong-answer' = 'quiz',
  sourceId?: string,
  notes?: string
): Promise<FavoriteQuestion> {
  // 检查是否已收藏
  const existing = await getFavoriteByQuestionId(question.id);
  
  if (existing) {
    // 更新分类
    const updated: FavoriteQuestion = {
      ...existing,
      category,
      notes: notes || existing.notes,
      updatedAt: new Date(),
    };
    await saveFavorite(updated);
    return updated;
  }
  
  // 创建新收藏
  const favorite: FavoriteQuestion = {
    id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    questionId: question.id,
    question,
    category,
    notes,
    sourceType,
    sourceId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  await saveFavorite(favorite);
  return favorite;
}

/**
 * 批量添加收藏（从错题本）
 */
export async function addFavoritesFromWrongAnswers(
  wrongAnswers: WrongAnswer[],
  category: string
): Promise<FavoriteQuestion[]> {
  const results: FavoriteQuestion[] = [];
  
  for (const wrong of wrongAnswers) {
    const favorite = await addFavorite(
      wrong.question,
      category,
      'wrong-answer',
      wrong.id
    );
    results.push(favorite);
  }
  
  return results;
}

/**
 * 取消收藏
 */
export async function removeFavorite(questionId: string): Promise<void> {
  const favorite = await getFavoriteByQuestionId(questionId);
  if (favorite) {
    await deleteFavorite(favorite.id);
  }
}

/**
 * 检查是否已收藏
 */
export async function isFavorited(questionId: string): Promise<boolean> {
  const favorite = await getFavoriteByQuestionId(questionId);
  return !!favorite;
}

/**
 * 切换收藏状态
 */
export async function toggleFavorite(
  question: Question,
  category: string = 'default',
  sourceType: 'quiz' | 'wrong-answer' = 'quiz',
  sourceId?: string
): Promise<boolean> {
  const existing = await getFavoriteByQuestionId(question.id);
  
  if (existing) {
    await deleteFavorite(existing.id);
    return false;
  } else {
    await addFavorite(question, category, sourceType, sourceId);
    return true;
  }
}

/**
 * 更新收藏分类
 */
export async function updateFavoriteCategory(
  questionId: string,
  newCategory: string
): Promise<void> {
  const favorite = await getFavoriteByQuestionId(questionId);
  if (!favorite) return;
  
  const updated: FavoriteQuestion = {
    ...favorite,
    category: newCategory,
    updatedAt: new Date(),
  };
  
  await saveFavorite(updated);
}

/**
 * 更新收藏笔记
 */
export async function updateFavoriteNotes(
  questionId: string,
  notes: string
): Promise<void> {
  const favorite = await getFavoriteByQuestionId(questionId);
  if (!favorite) return;
  
  const updated: FavoriteQuestion = {
    ...favorite,
    notes,
    updatedAt: new Date(),
  };
  
  await saveFavorite(updated);
}

/**
 * 获取收藏统计
 */
export async function getFavoriteStats(): Promise<FavoriteStats[]> {
  const allFavorites = await getAllFavorites();
  const categories = await getAllFavoriteCategories();
  
  const statsMap = new Map<string, FavoriteStats>();
  
  for (const fav of allFavorites) {
    const category = fav.category || 'default';
    const categoryInfo = categories.find(c => c.id === category);
    
    if (!statsMap.has(category)) {
      statsMap.set(category, {
        category,
        categoryName: categoryInfo?.name || (category === 'default' ? '默认分类' : category),
        count: 0,
      });
    }
    
    const stats = statsMap.get(category)!;
    stats.count++;
  }
  
  return Array.from(statsMap.values()).sort((a, b) => b.count - a.count);
}

// ==================== 收藏分类管理 ====================

/**
 * 创建收藏分类
 */
export async function createFavoriteCategory(
  name: string,
  description?: string,
  color?: string
): Promise<FavoriteCategory> {
  const categories = await getAllFavoriteCategories();
  const maxOrder = categories.reduce((max, c) => Math.max(max, c.order), 0);
  
  const category: FavoriteCategory = {
    id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    name,
    description,
    color,
    order: maxOrder + 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  await saveFavoriteCategory(category);
  return category;
}

/**
 * 更新收藏分类
 */
export async function updateFavoriteCategoryInfo(
  id: string,
  updates: { name?: string; description?: string; color?: string }
): Promise<void> {
  const categories = await getAllFavoriteCategories();
  const category = categories.find(c => c.id === id);
  if (!category) return;
  
  const updated: FavoriteCategory = {
    ...category,
    ...updates,
    updatedAt: new Date(),
  };
  
  await saveFavoriteCategory(updated);
}

/**
 * 删除收藏分类（将该分类下的收藏移到默认分类）
 */
export async function removeFavoriteCategory(id: string): Promise<void> {
  // 将该分类下的收藏移到默认分类
  const favorites = await getFavoritesByCategory(id);
  for (const fav of favorites) {
    await saveFavorite({
      ...fav,
      category: 'default',
      updatedAt: new Date(),
    });
  }
  
  await deleteFavoriteCategory(id);
}

/**
 * 获取所有收藏分类
 */
export async function getFavoriteCategories(): Promise<FavoriteCategory[]> {
  const categories = await getAllFavoriteCategories();
  return categories.sort((a, b) => a.order - b.order);
}

/**
 * 默认分类
 */
export const DEFAULT_FAVORITE_CATEGORY: FavoriteCategory = {
  id: 'default',
  name: '默认分类',
  description: '未分类的收藏题目',
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};
