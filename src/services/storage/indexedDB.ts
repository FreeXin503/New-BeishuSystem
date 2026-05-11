/**
 * IndexedDB 存储服务
 */

import type { ParsedContent, ReviewCard, StudySession, UserSettings, SyncItem, ScoreRecord, LogicChain, QuizArchive, WrongAnswer, FillBlankItem, FillBlankSessionResult, FillBlankFavorite, FillBlankWrongAnswer, FavoriteQuestion, FavoriteCategory, FillBlankImportRecord } from '../../types';

const DB_NAME = 'politics-study-db';
const DB_VERSION = 8;

// Store 名称
const STORES = {
  CONTENTS: 'contents',
  REVIEW_CARDS: 'reviewCards',
  STUDY_SESSIONS: 'studySessions',
  SETTINGS: 'settings',
  PENDING_SYNC: 'pendingSync',
  SCORE_RECORDS: 'scoreRecords',
  LOGIC_CHAINS: 'logicChains',
  QUIZ_ARCHIVES: 'quizArchives',
  WRONG_ANSWERS: 'wrongAnswers',
  CUSTOM_CATEGORIES: 'customCategories',
  FAVORITES: 'favorites',
  FAVORITE_CATEGORIES: 'favoriteCategories',
  FILL_BLANK_ITEMS: 'fillBlankItems',
  FILL_BLANK_SESSIONS: 'fillBlankSessions',
  FILL_BLANK_FAVORITES: 'fillBlankFavorites',
  FILL_BLANK_WRONG_ANSWERS: 'fillBlankWrongAnswers',
  FILL_BLANK_IMPORT_RECORDS: 'fillBlankImportRecords',
} as const;

let db: IDBDatabase | null = null;

/**
 * 打开数据库
 */
export async function openDatabase(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error('IndexedDB open timeout'));
    }, 8000);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(request.error);
    };

    request.onblocked = () => {
      window.clearTimeout(timeoutId);
      reject(new Error('IndexedDB open blocked by an existing connection'));
    };
    
    request.onsuccess = () => {
      window.clearTimeout(timeoutId);
      db = request.result;

      // If a newer version of the DB is requested elsewhere, close this connection
      // so the upgrade can proceed.
      db.onversionchange = () => {
        db?.close();
        db = null;
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // 创建 stores
      if (!database.objectStoreNames.contains(STORES.CONTENTS)) {
        database.createObjectStore(STORES.CONTENTS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.REVIEW_CARDS)) {
        const cardStore = database.createObjectStore(STORES.REVIEW_CARDS, { keyPath: 'id' });
        cardStore.createIndex('contentId', 'contentId', { unique: false });
        cardStore.createIndex('nextReviewDate', 'nextReviewDate', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.STUDY_SESSIONS)) {
        const sessionStore = database.createObjectStore(STORES.STUDY_SESSIONS, { keyPath: 'id' });
        sessionStore.createIndex('contentId', 'contentId', { unique: false });
        sessionStore.createIndex('startedAt', 'startedAt', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
        database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(STORES.PENDING_SYNC)) {
        database.createObjectStore(STORES.PENDING_SYNC, { keyPath: 'id' });
      }
      // 新增：得分记录存储
      if (!database.objectStoreNames.contains(STORES.SCORE_RECORDS)) {
        const scoreStore = database.createObjectStore(STORES.SCORE_RECORDS, { keyPath: 'id' });
        scoreStore.createIndex('userId', 'userId', { unique: false });
        scoreStore.createIndex('sessionId', 'sessionId', { unique: false });
        scoreStore.createIndex('contentId', 'contentId', { unique: false });
      }
      // 新增：逻辑链存储
      if (!database.objectStoreNames.contains(STORES.LOGIC_CHAINS)) {
        const chainStore = database.createObjectStore(STORES.LOGIC_CHAINS, { keyPath: 'id' });
        chainStore.createIndex('contentId', 'contentId', { unique: false });
      }
      // 新增：题库存档
      if (!database.objectStoreNames.contains(STORES.QUIZ_ARCHIVES)) {
        const archiveStore = database.createObjectStore(STORES.QUIZ_ARCHIVES, { keyPath: 'id' });
        archiveStore.createIndex('category', 'category', { unique: false });
        archiveStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // 新增：错题本
      if (!database.objectStoreNames.contains(STORES.WRONG_ANSWERS)) {
        const wrongStore = database.createObjectStore(STORES.WRONG_ANSWERS, { keyPath: 'id' });
        wrongStore.createIndex('archiveId', 'archiveId', { unique: false });
        wrongStore.createIndex('category', 'category', { unique: false });
        wrongStore.createIndex('mastered', 'mastered', { unique: false });
        wrongStore.createIndex('questionId', 'questionId', { unique: false });
      }
      // 新增：自定义分类
      if (!database.objectStoreNames.contains(STORES.CUSTOM_CATEGORIES)) {
        database.createObjectStore(STORES.CUSTOM_CATEGORIES, { keyPath: 'value' });
      }
      // 新增：收藏题目
      if (!database.objectStoreNames.contains(STORES.FAVORITES)) {
        const favStore = database.createObjectStore(STORES.FAVORITES, { keyPath: 'id' });
        favStore.createIndex('questionId', 'questionId', { unique: false });
        favStore.createIndex('category', 'category', { unique: false });
      }
      // 新增：收藏分类
      if (!database.objectStoreNames.contains(STORES.FAVORITE_CATEGORIES)) {
        database.createObjectStore(STORES.FAVORITE_CATEGORIES, { keyPath: 'id' });
      }
      // 新增：填空题项目
      if (!database.objectStoreNames.contains(STORES.FILL_BLANK_ITEMS)) {
        const fillBlankStore = database.createObjectStore(STORES.FILL_BLANK_ITEMS, { keyPath: 'id' });
        fillBlankStore.createIndex('category', 'category', { unique: false });
        fillBlankStore.createIndex('difficulty', 'difficulty', { unique: false });
        fillBlankStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // 新增：填空题会话记录
      if (!database.objectStoreNames.contains(STORES.FILL_BLANK_SESSIONS)) {
        const sessionStore = database.createObjectStore(STORES.FILL_BLANK_SESSIONS, { keyPath: 'id' });
        sessionStore.createIndex('sessionId', 'sessionId', { unique: false });
        sessionStore.createIndex('category', 'category', { unique: false });
        sessionStore.createIndex('completedAt', 'completedAt', { unique: false });
      }
      // 新增：填空题收藏
      if (!database.objectStoreNames.contains(STORES.FILL_BLANK_FAVORITES)) {
        const favStore = database.createObjectStore(STORES.FILL_BLANK_FAVORITES, { keyPath: 'id' });
        favStore.createIndex('fillBlankItemId', 'fillBlankItemId', { unique: false });
        favStore.createIndex('category', 'category', { unique: false });
        favStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // 新增：填空题错题
      if (!database.objectStoreNames.contains(STORES.FILL_BLANK_WRONG_ANSWERS)) {
        const wrongStore = database.createObjectStore(STORES.FILL_BLANK_WRONG_ANSWERS, { keyPath: 'id' });
        wrongStore.createIndex('fillBlankItemId', 'fillBlankItemId', { unique: false });
        wrongStore.createIndex('category', 'category', { unique: false });
        wrongStore.createIndex('mastered', 'mastered', { unique: false });
        wrongStore.createIndex('lastWrongAt', 'lastWrongAt', { unique: false });
      }
      // 新增：填空题导入记录
      if (!database.objectStoreNames.contains(STORES.FILL_BLANK_IMPORT_RECORDS)) {
        const importStore = database.createObjectStore(STORES.FILL_BLANK_IMPORT_RECORDS, { keyPath: 'id' });
        importStore.createIndex('createdAt', 'createdAt', { unique: false });
        importStore.createIndex('category', 'category', { unique: false });
      }
    };
  });
}

/**
 * 通用 CRUD 操作
 */
async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getById<T>(storeName: string, id: string): Promise<T | null> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function put<T>(storeName: string, item: T): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteById(storeName: string, id: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clear(storeName: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==================== Contents ====================

export async function getAllContents(): Promise<ParsedContent[]> {
  return getAll<ParsedContent>(STORES.CONTENTS);
}

export async function getContentById(id: string): Promise<ParsedContent | null> {
  return getById<ParsedContent>(STORES.CONTENTS, id);
}

export async function saveContent(content: ParsedContent): Promise<void> {
  return put(STORES.CONTENTS, content);
}

export async function deleteContent(id: string): Promise<void> {
  return deleteById(STORES.CONTENTS, id);
}

// ==================== Review Cards ====================

export async function getAllReviewCards(): Promise<ReviewCard[]> {
  return getAll<ReviewCard>(STORES.REVIEW_CARDS);
}

export async function getReviewCardById(id: string): Promise<ReviewCard | null> {
  return getById<ReviewCard>(STORES.REVIEW_CARDS, id);
}

export async function saveReviewCard(card: ReviewCard): Promise<void> {
  return put(STORES.REVIEW_CARDS, card);
}

export async function deleteReviewCard(id: string): Promise<void> {
  return deleteById(STORES.REVIEW_CARDS, id);
}

export async function getReviewCardsByContentId(contentId: string): Promise<ReviewCard[]> {
  const store = await getStore(STORES.REVIEW_CARDS);
  const index = store.index('contentId');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(contentId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== Study Sessions ====================

export async function getAllStudySessions(): Promise<StudySession[]> {
  return getAll<StudySession>(STORES.STUDY_SESSIONS);
}

export async function saveStudySession(session: StudySession): Promise<void> {
  return put(STORES.STUDY_SESSIONS, session);
}

// ==================== Settings ====================

export async function getSettings(): Promise<UserSettings | null> {
  const result = await getById<{ key: string; value: UserSettings }>(STORES.SETTINGS, 'user-settings');
  return result?.value || null;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  return put(STORES.SETTINGS, { key: 'user-settings', value: settings });
}

// ==================== Pending Sync ====================

export async function getAllPendingSync(): Promise<SyncItem[]> {
  return getAll<SyncItem>(STORES.PENDING_SYNC);
}

export async function addPendingSync(item: SyncItem): Promise<void> {
  return put(STORES.PENDING_SYNC, item);
}

export async function clearPendingSync(): Promise<void> {
  return clear(STORES.PENDING_SYNC);
}

export async function deletePendingSyncItem(id: string): Promise<void> {
  return deleteById(STORES.PENDING_SYNC, id);
}

// ==================== 清理 ====================

export async function clearAllData(): Promise<void> {
  await clear(STORES.CONTENTS);
  await clear(STORES.REVIEW_CARDS);
  await clear(STORES.STUDY_SESSIONS);
  await clear(STORES.PENDING_SYNC);
  await clear(STORES.SCORE_RECORDS);
  await clear(STORES.LOGIC_CHAINS);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ==================== Score Records ====================

export async function getAllScoreRecords(): Promise<ScoreRecord[]> {
  return getAll<ScoreRecord>(STORES.SCORE_RECORDS);
}

export async function saveScoreRecord(record: ScoreRecord): Promise<void> {
  return put(STORES.SCORE_RECORDS, record);
}

export async function saveScoreRecords(records: ScoreRecord[]): Promise<void> {
  for (const record of records) {
    await put(STORES.SCORE_RECORDS, record);
  }
}

export async function getScoreRecordsBySession(sessionId: string): Promise<ScoreRecord[]> {
  const store = await getStore(STORES.SCORE_RECORDS);
  const index = store.index('sessionId');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(sessionId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getScoreRecordsByUser(userId: string): Promise<ScoreRecord[]> {
  const store = await getStore(STORES.SCORE_RECORDS);
  const index = store.index('userId');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(userId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== Logic Chains ====================

export async function getAllLogicChains(): Promise<LogicChain[]> {
  return getAll<LogicChain>(STORES.LOGIC_CHAINS);
}

export async function saveLogicChain(chain: LogicChain): Promise<void> {
  return put(STORES.LOGIC_CHAINS, chain);
}

export async function getLogicChainsByContent(contentId: string): Promise<LogicChain[]> {
  const store = await getStore(STORES.LOGIC_CHAINS);
  const index = store.index('contentId');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(contentId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteLogicChain(id: string): Promise<void> {
  return deleteById(STORES.LOGIC_CHAINS, id);
}

// ==================== Quiz Archives ====================

export async function getAllQuizArchives(): Promise<QuizArchive[]> {
  return getAll<QuizArchive>(STORES.QUIZ_ARCHIVES);
}

export async function getQuizArchiveById(id: string): Promise<QuizArchive | null> {
  return getById<QuizArchive>(STORES.QUIZ_ARCHIVES, id);
}

export async function saveQuizArchive(archive: QuizArchive): Promise<void> {
  return put(STORES.QUIZ_ARCHIVES, archive);
}

export async function deleteQuizArchive(id: string): Promise<void> {
  return deleteById(STORES.QUIZ_ARCHIVES, id);
}

export async function getQuizArchivesByCategory(category: string): Promise<QuizArchive[]> {
  const store = await getStore(STORES.QUIZ_ARCHIVES);
  const index = store.index('category');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(category);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== Wrong Answers ====================

export async function getAllWrongAnswers(): Promise<WrongAnswer[]> {
  return getAll<WrongAnswer>(STORES.WRONG_ANSWERS);
}

export async function getWrongAnswerById(id: string): Promise<WrongAnswer | null> {
  return getById<WrongAnswer>(STORES.WRONG_ANSWERS, id);
}

export async function saveWrongAnswer(wrongAnswer: WrongAnswer): Promise<void> {
  return put(STORES.WRONG_ANSWERS, wrongAnswer);
}

export async function deleteWrongAnswer(id: string): Promise<void> {
  return deleteById(STORES.WRONG_ANSWERS, id);
}

export async function getWrongAnswersByArchive(archiveId: string): Promise<WrongAnswer[]> {
  const store = await getStore(STORES.WRONG_ANSWERS);
  const index = store.index('archiveId');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(archiveId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getWrongAnswersByCategory(category: string): Promise<WrongAnswer[]> {
  const store = await getStore(STORES.WRONG_ANSWERS);
  const index = store.index('category');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(category);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getUnmasteredWrongAnswers(): Promise<WrongAnswer[]> {
  const all = await getAllWrongAnswers();
  return all.filter(w => !w.mastered);
}

export async function getWrongAnswerByQuestionId(questionId: string): Promise<WrongAnswer | null> {
  const store = await getStore(STORES.WRONG_ANSWERS);
  const index = store.index('questionId');
  
  return new Promise((resolve, reject) => {
    const request = index.get(questionId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// ==================== Custom Categories ====================

export interface CustomCategory {
  value: string;
  label: string;
  createdAt: Date;
}

export async function getAllCustomCategories(): Promise<CustomCategory[]> {
  return getAll<CustomCategory>(STORES.CUSTOM_CATEGORIES);
}

export async function saveCustomCategory(category: CustomCategory): Promise<void> {
  return put(STORES.CUSTOM_CATEGORIES, category);
}

export async function deleteCustomCategory(value: string): Promise<void> {
  return deleteById(STORES.CUSTOM_CATEGORIES, value);
}

// ==================== Favorites ====================

export async function getAllFavorites(): Promise<FavoriteQuestion[]> {
  return getAll<FavoriteQuestion>(STORES.FAVORITES);
}

export async function getFavoriteById(id: string): Promise<FavoriteQuestion | null> {
  return getById<FavoriteQuestion>(STORES.FAVORITES, id);
}

export async function saveFavorite(favorite: FavoriteQuestion): Promise<void> {
  return put(STORES.FAVORITES, favorite);
}

export async function deleteFavorite(id: string): Promise<void> {
  return deleteById(STORES.FAVORITES, id);
}

export async function getFavoritesByCategory(category: string): Promise<FavoriteQuestion[]> {
  const store = await getStore(STORES.FAVORITES);
  const index = store.index('category');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(category);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getFavoriteByQuestionId(questionId: string): Promise<FavoriteQuestion | null> {
  const store = await getStore(STORES.FAVORITES);
  const index = store.index('questionId');
  
  return new Promise((resolve, reject) => {
    const request = index.get(questionId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// ==================== Favorite Categories ====================

export async function getAllFavoriteCategories(): Promise<FavoriteCategory[]> {
  return getAll<FavoriteCategory>(STORES.FAVORITE_CATEGORIES);
}

export async function getFavoriteCategoryById(id: string): Promise<FavoriteCategory | null> {
  return getById<FavoriteCategory>(STORES.FAVORITE_CATEGORIES, id);
}

export async function saveFavoriteCategory(category: FavoriteCategory): Promise<void> {
  return put(STORES.FAVORITE_CATEGORIES, category);
}

export async function deleteFavoriteCategory(id: string): Promise<void> {
  return deleteById(STORES.FAVORITE_CATEGORIES, id);
}

// ==================== Fill Blank Items ====================

export async function getAllFillBlankItems(): Promise<FillBlankItem[]> {
  return getAll<FillBlankItem>(STORES.FILL_BLANK_ITEMS);
}

export async function getFillBlankItemById(id: string): Promise<FillBlankItem | null> {
  return getById<FillBlankItem>(STORES.FILL_BLANK_ITEMS, id);
}

export async function saveFillBlankItem(item: FillBlankItem): Promise<void> {
  return put(STORES.FILL_BLANK_ITEMS, item);
}

export async function deleteFillBlankItem(id: string): Promise<void> {
  return deleteById(STORES.FILL_BLANK_ITEMS, id);
}

export async function getFillBlankItemsByCategory(category: string): Promise<FillBlankItem[]> {
  const store = await getStore(STORES.FILL_BLANK_ITEMS);
  const index = store.index('category');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(category);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getFillBlankItemsByDifficulty(difficulty: string): Promise<FillBlankItem[]> {
  const store = await getStore(STORES.FILL_BLANK_ITEMS);
  const index = store.index('difficulty');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(difficulty);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== Fill Blank Sessions ====================

export async function getAllFillBlankSessions(): Promise<FillBlankSessionResult[]> {
  return getAll<FillBlankSessionResult>(STORES.FILL_BLANK_SESSIONS);
}

export async function saveFillBlankSession(session: FillBlankSessionResult): Promise<void> {
  return put(STORES.FILL_BLANK_SESSIONS, session);
}

export async function getFillBlankSessionsByCategory(category: string): Promise<FillBlankSessionResult[]> {
  const store = await getStore(STORES.FILL_BLANK_SESSIONS);
  const index = store.index('category');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(category);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== Fill Blank Favorites ====================

export async function getAllFillBlankFavorites(): Promise<FillBlankFavorite[]> {
  return getAll<FillBlankFavorite>(STORES.FILL_BLANK_FAVORITES);
}

export async function saveFillBlankFavorite(favorite: FillBlankFavorite): Promise<void> {
  return put(STORES.FILL_BLANK_FAVORITES, favorite);
}

export async function deleteFillBlankFavorite(id: string): Promise<void> {
  return deleteById(STORES.FILL_BLANK_FAVORITES, id);
}

export async function getFillBlankFavoritesByCategory(category: string): Promise<FillBlankFavorite[]> {
  const store = await getStore(STORES.FILL_BLANK_FAVORITES);
  const index = store.index('category');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(category);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getFillBlankFavoritesByItemId(itemId: string): Promise<FillBlankFavorite[]> {
  const store = await getStore(STORES.FILL_BLANK_FAVORITES);
  const index = store.index('fillBlankItemId');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(itemId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== Fill Blank Wrong Answers ====================

export async function getAllFillBlankWrongAnswers(): Promise<FillBlankWrongAnswer[]> {
  return getAll<FillBlankWrongAnswer>(STORES.FILL_BLANK_WRONG_ANSWERS);
}

export async function saveFillBlankWrongAnswer(wrongAnswer: FillBlankWrongAnswer): Promise<void> {
  return put(STORES.FILL_BLANK_WRONG_ANSWERS, wrongAnswer);
}

export async function deleteFillBlankWrongAnswer(id: string): Promise<void> {
  return deleteById(STORES.FILL_BLANK_WRONG_ANSWERS, id);
}

export async function getFillBlankWrongAnswersByCategory(category: string): Promise<FillBlankWrongAnswer[]> {
  const store = await getStore(STORES.FILL_BLANK_WRONG_ANSWERS);
  const index = store.index('category');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(category);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getFillBlankWrongAnswersByItemId(itemId: string): Promise<FillBlankWrongAnswer[]> {
  const store = await getStore(STORES.FILL_BLANK_WRONG_ANSWERS);
  const index = store.index('fillBlankItemId');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(itemId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getUnmasteredFillBlankWrongAnswers(): Promise<FillBlankWrongAnswer[]> {
  const store = await getStore(STORES.FILL_BLANK_WRONG_ANSWERS);
  const index = store.index('mastered');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(IDBKeyRange.only(false));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== 填空题导入记录 CRUD ====================

export async function saveFillBlankImportRecord(record: FillBlankImportRecord): Promise<void> {
  const store = await getStore(STORES.FILL_BLANK_IMPORT_RECORDS, 'readwrite');
  
  return new Promise((resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllFillBlankImportRecords(): Promise<FillBlankImportRecord[]> {
  const store = await getStore(STORES.FILL_BLANK_IMPORT_RECORDS);
  const index = store.index('createdAt');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll();
    request.onsuccess = () => resolve(request.result.reverse());
    request.onerror = () => reject(request.error);
  });
}

export async function getFillBlankImportRecord(id: string): Promise<FillBlankImportRecord | null> {
  const store = await getStore(STORES.FILL_BLANK_IMPORT_RECORDS);
  
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFillBlankImportRecord(id: string): Promise<void> {
  const store = await getStore(STORES.FILL_BLANK_IMPORT_RECORDS, 'readwrite');
  
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
