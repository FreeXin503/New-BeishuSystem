import type { ChineseSpellingItem, FavoriteItem } from '../../types';

export interface ISpellingApi {
  getAllChineseSpellingItems(): Promise<ChineseSpellingItem[]>;
  createChineseSpellingItems(items: Omit<ChineseSpellingItem, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void>;
  deleteChineseSpellingItem(id: string): Promise<void>;
  clearAllChineseSpellingItems(): Promise<void>;
  getAllFavorites(): Promise<FavoriteItem[]>;
  addFavorite(itemId: string, favoriteDate: string): Promise<void>;
  removeFavorite(itemId: string): Promise<void>;
  clearFavorites(): Promise<void>;
  isFavorited(itemId: string): Promise<boolean>;
  getFavoritesByDate(date: string): Promise<FavoriteItem[]>;
}
