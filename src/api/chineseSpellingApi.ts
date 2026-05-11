import { prisma } from '../lib/prisma';
import type { ChineseSpellingItem, FavoriteItem } from '../types';

// 获取所有词汇
export async function getAllChineseSpellingItems(): Promise<ChineseSpellingItem[]> {
  const items = await prisma.chineseSpellingItem.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  return items.map(item => ({
    id: item.id,
    english: item.english,
    chinese: item.chinese,
    category: item.category || undefined,
    tags: item.tags ? JSON.parse(item.tags) : undefined,
    difficulty: item.difficulty as 'easy' | 'medium' | 'hard' | undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));
}

// 批量创建词汇
export async function createChineseSpellingItems(items: Omit<ChineseSpellingItem, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
  await prisma.chineseSpellingItem.createMany({
    data: items.map(item => ({
      english: item.english,
      chinese: item.chinese,
      category: item.category,
      tags: item.tags ? JSON.stringify(item.tags) : null,
      difficulty: item.difficulty
    }))
  });
}

// 删除词汇
export async function deleteChineseSpellingItem(id: string): Promise<void> {
  await prisma.chineseSpellingItem.delete({
    where: { id }
  });
}

// 清空所有词汇
export async function clearAllChineseSpellingItems(): Promise<void> {
  await prisma.chineseSpellingItem.deleteMany();
}

// 获取收藏列表
export async function getAllFavorites(): Promise<FavoriteItem[]> {
  const favorites = await prisma.chineseSpellingFavorite.findMany({
    include: { item: true },
    orderBy: { createdAt: 'desc' }
  });
  
  return favorites.map(fav => ({
    id: fav.item.id,
    english: fav.item.english,
    chinese: fav.item.chinese,
    category: fav.item.category || undefined,
    tags: fav.item.tags ? JSON.parse(fav.item.tags) : undefined,
    difficulty: fav.item.difficulty as 'easy' | 'medium' | 'hard' | undefined,
    createdAt: fav.item.createdAt,
    updatedAt: fav.item.updatedAt,
    favoriteDate: fav.favoriteDate
  }));
}

// 添加收藏
export async function addFavorite(itemId: string, favoriteDate: string): Promise<void> {
  await prisma.chineseSpellingFavorite.create({
    data: {
      itemId,
      favoriteDate
    }
  });
}

// 删除收藏
export async function removeFavorite(itemId: string): Promise<void> {
  await prisma.chineseSpellingFavorite.deleteMany({
    where: { itemId }
  });
}

// 清空收藏
export async function clearFavorites(): Promise<void> {
  await prisma.chineseSpellingFavorite.deleteMany();
}

// 检查是否已收藏
export async function isFavorited(itemId: string): Promise<boolean> {
  const favorite = await prisma.chineseSpellingFavorite.findFirst({
    where: { itemId }
  });
  return !!favorite;
}

// 按日期获取收藏
export async function getFavoritesByDate(date: string): Promise<FavoriteItem[]> {
  const favorites = await prisma.chineseSpellingFavorite.findMany({
    where: { favoriteDate: date },
    include: { item: true },
    orderBy: { createdAt: 'desc' }
  });
  
  return favorites.map(fav => ({
    id: fav.item.id,
    english: fav.item.english,
    chinese: fav.item.chinese,
    category: fav.item.category || undefined,
    tags: fav.item.tags ? JSON.parse(fav.item.tags) : undefined,
    difficulty: fav.item.difficulty as 'easy' | 'medium' | 'hard' | undefined,
    createdAt: fav.item.createdAt,
    updatedAt: fav.item.updatedAt,
    favoriteDate: fav.favoriteDate
  }));
}
