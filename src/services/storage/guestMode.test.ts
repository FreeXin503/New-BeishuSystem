/**
 * 游客模式存储属性测试
 * Property 9: 游客模式本地存储
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { ParsedContent, ReviewCard, UserSettings } from '../../types';

// Mock stores 在 vi.hoisted 中定义

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock indexedDB module - 使用 vi.hoisted
const { stores } = vi.hoisted(() => {
  const stores = {
    contents: new Map<string, unknown>(),
    reviewCards: new Map<string, unknown>(),
    studySessions: new Map<string, unknown>(),
    settings: new Map<string, unknown>(),
    pendingSync: new Map<string, unknown>(),
  };
  return { stores };
});

vi.mock('./indexedDB', () => {
  return {
    openDatabase: vi.fn().mockResolvedValue({}),
    getAllContents: vi.fn(async () => Array.from(stores.contents.values())),
    getContentById: vi.fn(async (id: string) => stores.contents.get(id) || null),
    saveContent: vi.fn(async (content: { id: string }) => {
      stores.contents.set(content.id, content);
    }),
    deleteContent: vi.fn(async (id: string) => {
      stores.contents.delete(id);
    }),
    getAllReviewCards: vi.fn(async () => Array.from(stores.reviewCards.values())),
    getReviewCardById: vi.fn(async (id: string) => stores.reviewCards.get(id) || null),
    saveReviewCard: vi.fn(async (card: { id: string }) => {
      stores.reviewCards.set(card.id, card);
    }),
    deleteReviewCard: vi.fn(async (id: string) => {
      stores.reviewCards.delete(id);
    }),
    getReviewCardsByContentId: vi.fn(async (contentId: string) => {
      return Array.from(stores.reviewCards.values())
        .filter((card: unknown) => (card as { contentId: string }).contentId === contentId);
    }),
    getAllStudySessions: vi.fn(async () => Array.from(stores.studySessions.values())),
    saveStudySession: vi.fn(async (session: { id: string }) => {
      stores.studySessions.set(session.id, session);
    }),
    getSettings: vi.fn(async () => {
      const settings = stores.settings.get('user-settings');
      return settings ? (settings as { value: UserSettings }).value : null;
    }),
    saveSettings: vi.fn(async (settings: UserSettings) => {
      stores.settings.set('user-settings', { key: 'user-settings', value: settings });
    }),
    clearAllData: vi.fn(async () => {
      stores.contents.clear();
      stores.reviewCards.clear();
      stores.studySessions.clear();
      stores.pendingSync.clear();
    }),
    getAllPendingSync: vi.fn(async () => Array.from(stores.pendingSync.values())),
    addPendingSync: vi.fn(async (item: { id: string }) => {
      stores.pendingSync.set(item.id, item);
    }),
    clearPendingSync: vi.fn(async () => {
      stores.pendingSync.clear();
    }),
    deletePendingSyncItem: vi.fn(async (id: string) => {
      stores.pendingSync.delete(id);
    }),
    closeDatabase: vi.fn(),
  };
});

import {
  createGuestUser,
  getGuestUser,
  getOrCreateGuestUser,
  clearGuestUser,
  isGuestMode,
  saveGuestContent,
  getGuestContents,
  getGuestContentById,
  deleteGuestContent,
  saveGuestReviewCard,
  getGuestReviewCards,
  getGuestDueCards,
  saveGuestSettings,
  getGuestSettings,
  getDefaultSettings,
  exportGuestData,
  clearAllGuestData,
  hasGuestData,
} from './guestMode';

// 清理函数
function clearMockStores() {
  stores.contents.clear();
  stores.reviewCards.clear();
  stores.studySessions.clear();
  stores.settings.clear();
  stores.pendingSync.clear();
}

// Arbitrary generators
const contentArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  chapters: fc.array(fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    content: fc.string({ minLength: 1, maxLength: 500 }),
    keywords: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
    order: fc.nat({ max: 100 }),
  }), { minLength: 1, maxLength: 5 }),
  keywords: fc.array(fc.record({
    term: fc.string({ minLength: 1, maxLength: 30 }),
    definition: fc.string({ minLength: 1, maxLength: 200 }),
    importance: fc.constantFrom('high', 'medium', 'low') as fc.Arbitrary<'high' | 'medium' | 'low'>,
  }), { minLength: 0, maxLength: 10 }),
  concepts: fc.array(fc.record({
    name: fc.string({ minLength: 1, maxLength: 30 }),
    definition: fc.string({ minLength: 1, maxLength: 200 }),
    relatedTerms: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
  }), { minLength: 0, maxLength: 5 }),
  createdAt: fc.date(),
  updatedAt: fc.date(),
}) as fc.Arbitrary<ParsedContent>;

const reviewCardArb = fc.record({
  id: fc.uuid(),
  contentId: fc.uuid(),
  userId: fc.string({ minLength: 1, maxLength: 50 }),
  cardType: fc.constantFrom('fill-blank', 'quiz', 'matching') as fc.Arbitrary<'fill-blank' | 'quiz' | 'matching'>,
  cardData: fc.record({
    type: fc.constant('fill-blank'),
    text: fc.string({ minLength: 1, maxLength: 200 }),
    blanks: fc.array(fc.record({
      id: fc.uuid(),
      position: fc.nat({ max: 100 }),
      length: fc.nat({ max: 20 }),
      answer: fc.string({ minLength: 1, maxLength: 30 }),
    }), { minLength: 1, maxLength: 5 }),
  }),
  easeFactor: fc.double({ min: 1.3, max: 2.5 }),
  interval: fc.nat({ max: 365 }),
  repetitions: fc.nat({ max: 100 }),
  nextReviewDate: fc.date(),
  lastReviewDate: fc.option(fc.date(), { nil: null }),
  createdAt: fc.date(),
}) as fc.Arbitrary<ReviewCard>;

const settingsArb = fc.record({
  theme: fc.constantFrom('light', 'dark') as fc.Arbitrary<'light' | 'dark'>,
  speechRate: fc.double({ min: 0.5, max: 2.0 }),
  dailyGoal: fc.nat({ max: 120 }),
  notificationsEnabled: fc.boolean(),
}) as fc.Arbitrary<UserSettings>;

describe('游客模式存储属性测试 (Property 9)', () => {
  beforeEach(() => {
    localStorageMock.clear();
    clearMockStores();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('游客用户管理', () => {
    it('Property 9.1: 创建的游客用户应有唯一ID且isGuest为true', () => {
      fc.assert(
        fc.property(fc.nat(), () => {
          localStorageMock.clear();
          
          const user = createGuestUser();
          
          expect(user.id).toMatch(/^guest-\d+-[a-z0-9]+$/);
          expect(user.isGuest).toBe(true);
          expect(user.email).toBe('');
          expect(user.createdAt).toBeInstanceOf(Date);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 9.2: getOrCreateGuestUser 应保持幂等性', () => {
      fc.assert(
        fc.property(fc.nat(), () => {
          localStorageMock.clear();
          
          const user1 = getOrCreateGuestUser();
          const user2 = getOrCreateGuestUser();
          
          expect(user1.id).toBe(user2.id);
          expect(user1.isGuest).toBe(user2.isGuest);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 9.3: clearGuestUser 后 getGuestUser 应返回 null', () => {
      fc.assert(
        fc.property(fc.nat(), () => {
          localStorageMock.clear();
          
          createGuestUser();
          expect(getGuestUser()).not.toBeNull();
          
          clearGuestUser();
          expect(getGuestUser()).toBeNull();
          expect(isGuestMode()).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('内容存储', () => {
    it('Property 9.4: 保存的内容应能被正确读取', async () => {
      await fc.assert(
        fc.asyncProperty(contentArb, async (content) => {
          await saveGuestContent(content);
          
          const retrieved = await getGuestContentById(content.id);
          expect(retrieved).not.toBeNull();
          expect(retrieved!.id).toBe(content.id);
          expect(retrieved!.title).toBe(content.title);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 9.5: 删除内容后应无法读取', async () => {
      await fc.assert(
        fc.asyncProperty(contentArb, async (content) => {
          await saveGuestContent(content);
          await deleteGuestContent(content.id);
          
          const retrieved = await getGuestContentById(content.id);
          expect(retrieved).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('Property 9.6: 多个内容应能独立存储和读取', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(contentArb, { minLength: 1, maxLength: 5 }),
          async (contents) => {
            // 清理
            clearMockStores();
            
            // 保存所有内容
            for (const content of contents) {
              await saveGuestContent(content);
            }
            
            // 验证所有内容都能读取
            const allContents = await getGuestContents();
            expect(allContents.length).toBe(contents.length);
            
            for (const content of contents) {
              const retrieved = await getGuestContentById(content.id);
              expect(retrieved).not.toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('复习卡片存储', () => {
    it('Property 9.7: 保存的复习卡片应能被正确读取', async () => {
      await fc.assert(
        fc.asyncProperty(reviewCardArb, async (card) => {
          await saveGuestReviewCard(card);
          
          const allCards = await getGuestReviewCards();
          const found = allCards.find(c => c.id === card.id);
          
          expect(found).not.toBeNull();
          expect(found!.contentId).toBe(card.contentId);
          expect(found!.cardType).toBe(card.cardType);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 9.8: 待复习卡片应只返回到期的卡片', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(reviewCardArb, { minLength: 1, maxLength: 10 }),
          async (cards) => {
            // 清理
            clearMockStores();
            
            const now = new Date();
            
            // 修改一些卡片为过期
            const modifiedCards = cards.map((card, i) => ({
              ...card,
              nextReviewDate: i % 2 === 0 
                ? new Date(now.getTime() - 86400000) // 过期
                : new Date(now.getTime() + 86400000), // 未到期
            }));
            
            for (const card of modifiedCards) {
              await saveGuestReviewCard(card);
            }
            
            const dueCards = await getGuestDueCards();
            
            // 所有返回的卡片都应该是到期的
            for (const card of dueCards) {
              expect(new Date(card.nextReviewDate).getTime()).toBeLessThanOrEqual(now.getTime());
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('设置存储', () => {
    it('Property 9.9: 保存的设置应能被正确读取', async () => {
      await fc.assert(
        fc.asyncProperty(settingsArb, async (settings) => {
          await saveGuestSettings(settings);
          
          const retrieved = await getGuestSettings();
          expect(retrieved).not.toBeNull();
          expect(retrieved!.theme).toBe(settings.theme);
          expect(retrieved!.dailyGoal).toBe(settings.dailyGoal);
          expect(retrieved!.notificationsEnabled).toBe(settings.notificationsEnabled);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 9.10: 默认设置应有合理的值', () => {
      fc.assert(
        fc.property(fc.nat(), () => {
          const defaults = getDefaultSettings();
          
          expect(['light', 'dark']).toContain(defaults.theme);
          expect(defaults.speechRate).toBeGreaterThanOrEqual(0.5);
          expect(defaults.speechRate).toBeLessThanOrEqual(2.0);
          expect(defaults.dailyGoal).toBeGreaterThan(0);
          expect(typeof defaults.notificationsEnabled).toBe('boolean');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('数据导出与清理', () => {
    it('Property 9.11: 导出的数据应包含所有存储的数据', async () => {
      await fc.assert(
        fc.asyncProperty(
          contentArb,
          reviewCardArb,
          settingsArb,
          async (content, card, settings) => {
            // 清理
            clearMockStores();
            localStorageMock.clear();
            
            createGuestUser();
            await saveGuestContent(content);
            await saveGuestReviewCard(card);
            await saveGuestSettings(settings);
            
            const exported = await exportGuestData();
            
            expect(exported.user).not.toBeNull();
            expect(exported.contents.length).toBe(1);
            expect(exported.reviewCards.length).toBe(1);
            expect(exported.settings).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 9.12: clearAllGuestData 应清除所有数据', async () => {
      await fc.assert(
        fc.asyncProperty(
          contentArb,
          reviewCardArb,
          async (content, card) => {
            // 清理
            clearMockStores();
            localStorageMock.clear();
            
            createGuestUser();
            await saveGuestContent(content);
            await saveGuestReviewCard(card);
            
            expect(await hasGuestData()).toBe(true);
            
            await clearAllGuestData();
            
            expect(getGuestUser()).toBeNull();
            expect(await hasGuestData()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
