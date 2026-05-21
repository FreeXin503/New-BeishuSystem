import type { ChineseSpellingItem, FavoriteItem } from '../../types';
import type { ISpellingApi } from '../../domain/contracts/ISpellingApi';

const SPELLING_ITEMS_KEY = 'mock-politics-spelling-items';
const SPELLING_FAVORITES_KEY = 'mock-politics-spelling-favorites';

const INITIAL_ITEMS: ChineseSpellingItem[] = [
  {
    id: 'mock-item-1',
    english: 'democracy',
    chinese: '民主',
    category: '政治学',
    tags: ['核心概念', '基础'],
    difficulty: 'easy',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01')
  },
  {
    id: 'mock-item-2',
    english: 'socialism with Chinese characteristics',
    chinese: '中国特色社会主义',
    category: '毛中特',
    tags: ['必考', '重难点'],
    difficulty: 'hard',
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02')
  },
  {
    id: 'mock-item-3',
    english: 'governance',
    chinese: '治理，统治',
    category: '政治学',
    tags: ['国家治理', '基础'],
    difficulty: 'medium',
    createdAt: new Date('2026-01-03'),
    updatedAt: new Date('2026-01-03')
  },
  {
    id: 'mock-item-4',
    english: 'rule of law',
    chinese: '法治',
    category: '思修',
    tags: ['核心概念'],
    difficulty: 'easy',
    createdAt: new Date('2026-01-04'),
    updatedAt: new Date('2026-01-04')
  },
  {
    id: 'mock-item-5',
    english: 'the CPC Central Committee',
    chinese: '党中央',
    category: '毛中特',
    tags: ['组织机构', '常用语'],
    difficulty: 'medium',
    createdAt: new Date('2026-01-05'),
    updatedAt: new Date('2026-01-05')
  },
  {
    id: 'mock-item-6',
    english: 'modernization',
    chinese: '现代化',
    category: '政治学',
    tags: ['核心要点'],
    difficulty: 'medium',
    createdAt: new Date('2026-01-06'),
    updatedAt: new Date('2026-01-06')
  },
  {
    id: 'mock-item-7',
    english: 'community with a shared future for mankind',
    chinese: '人类命运共同体',
    category: '习思想',
    tags: ['必背', '高频'],
    difficulty: 'hard',
    createdAt: new Date('2026-01-07'),
    updatedAt: new Date('2026-01-07')
  },
  {
    id: 'mock-item-8',
    english: 'productive forces',
    chinese: '生产力',
    category: '马原',
    tags: ['基础理论'],
    difficulty: 'easy',
    createdAt: new Date('2026-01-08'),
    updatedAt: new Date('2026-01-08')
  }
];

interface StoredFavorite {
  itemId: string;
  favoriteDate: string;
}

export class MockSpellingApi implements ISpellingApi {
  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized() {
    if (!localStorage.getItem(SPELLING_ITEMS_KEY)) {
      localStorage.setItem(SPELLING_ITEMS_KEY, JSON.stringify(INITIAL_ITEMS));
    }
    if (!localStorage.getItem(SPELLING_FAVORITES_KEY)) {
      localStorage.setItem(SPELLING_FAVORITES_KEY, JSON.stringify([]));
    }
  }

  private getItems(): ChineseSpellingItem[] {
    this.ensureInitialized();
    const data = localStorage.getItem(SPELLING_ITEMS_KEY);
    if (!data) return [];
    try {
      const parsed: any[] = JSON.parse(data);
      return parsed.map(item => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt)
      }));
    } catch {
      return [];
    }
  }

  private saveItems(items: ChineseSpellingItem[]): void {
    localStorage.setItem(SPELLING_ITEMS_KEY, JSON.stringify(items));
  }

  private getStoredFavorites(): StoredFavorite[] {
    this.ensureInitialized();
    const data = localStorage.getItem(SPELLING_FAVORITES_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private saveStoredFavorites(favs: StoredFavorite[]): void {
    localStorage.setItem(SPELLING_FAVORITES_KEY, JSON.stringify(favs));
  }

  async getAllChineseSpellingItems(): Promise<ChineseSpellingItem[]> {
    const items = this.getItems();
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createChineseSpellingItems(items: Omit<ChineseSpellingItem, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    const current = this.getItems();
    const newItems = items.map((item, idx) => ({
      id: `mock-item-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
      english: item.english,
      chinese: item.chinese,
      category: item.category,
      tags: item.tags,
      difficulty: item.difficulty,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    this.saveItems([...current, ...newItems]);
  }

  async deleteChineseSpellingItem(id: string): Promise<void> {
    const current = this.getItems();
    this.saveItems(current.filter(item => item.id !== id));
    // Also remove from favorites if favorited
    await this.removeFavorite(id);
  }

  async clearAllChineseSpellingItems(): Promise<void> {
    this.saveItems([]);
    this.saveStoredFavorites([]);
  }

  async getAllFavorites(): Promise<FavoriteItem[]> {
    const items = this.getItems();
    const favs = this.getStoredFavorites();
    const result: FavoriteItem[] = [];

    favs.forEach(fav => {
      const matched = items.find(i => i.id === fav.itemId);
      if (matched) {
        result.push({
          ...matched,
          favoriteDate: fav.favoriteDate
        });
      }
    });

    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async addFavorite(itemId: string, favoriteDate: string): Promise<void> {
    const favs = this.getStoredFavorites();
    if (!favs.some(f => f.itemId === itemId)) {
      favs.push({ itemId, favoriteDate });
      this.saveStoredFavorites(favs);
    }
  }

  async removeFavorite(itemId: string): Promise<void> {
    const favs = this.getStoredFavorites();
    this.saveStoredFavorites(favs.filter(f => f.itemId !== itemId));
  }

  async clearFavorites(): Promise<void> {
    this.saveStoredFavorites([]);
  }

  async isFavorited(itemId: string): Promise<boolean> {
    const favs = this.getStoredFavorites();
    return favs.some(f => f.itemId === itemId);
  }

  async getFavoritesByDate(date: string): Promise<FavoriteItem[]> {
    const items = this.getItems();
    const favs = this.getStoredFavorites();
    const filteredFavs = favs.filter(f => f.favoriteDate === date);
    const result: FavoriteItem[] = [];

    filteredFavs.forEach(fav => {
      const matched = items.find(i => i.id === fav.itemId);
      if (matched) {
        result.push({
          ...matched,
          favoriteDate: fav.favoriteDate
        });
      }
    });

    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
