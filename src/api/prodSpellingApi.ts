import { prisma } from '../lib/prisma';
import type { ChineseSpellingItem, FavoriteItem } from '../types';
import type { ISpellingApi } from '../domain/contracts/ISpellingApi';

export class ProdSpellingApi implements ISpellingApi {
  async getAllChineseSpellingItems(): Promise<ChineseSpellingItem[]> {
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

  async createChineseSpellingItems(items: Omit<ChineseSpellingItem, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
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

  async deleteChineseSpellingItem(id: string): Promise<void> {
    await prisma.chineseSpellingItem.delete({
      where: { id }
    });
  }

  async clearAllChineseSpellingItems(): Promise<void> {
    await prisma.chineseSpellingItem.deleteMany();
  }

  async getAllFavorites(): Promise<FavoriteItem[]> {
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

  async addFavorite(itemId: string, favoriteDate: string): Promise<void> {
    await prisma.chineseSpellingFavorite.create({
      data: {
        itemId,
        favoriteDate
      }
    });
  }

  async removeFavorite(itemId: string): Promise<void> {
    await prisma.chineseSpellingFavorite.deleteMany({
      where: { itemId }
    });
  }

  async clearFavorites(): Promise<void> {
    await prisma.chineseSpellingFavorite.deleteMany();
  }

  async isFavorited(itemId: string): Promise<boolean> {
    const favorite = await prisma.chineseSpellingFavorite.findFirst({
      where: { itemId }
    });
    return !!favorite;
  }

  async getFavoritesByDate(date: string): Promise<FavoriteItem[]> {
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
}
