/**
 * FillBlank 统一仓储
 */

import type {
  FillBlankItemEntity,
  FillBlankSessionResultEntity,
  FillBlankFavoriteEntity,
  FillBlankWrongAnswerEntity,
  FillBlankImportRecordEntity,
} from '../../domain/models';
import { FillBlankTransformer } from '../transformers/FillBlankTransformer';
import * as db from '../../services/storage/indexedDB';

export const FillBlankRepository = {
  // ==================== Items ====================

  async getAllItems(): Promise<FillBlankItemEntity[]> {
    try {
      const raw = await db.getAllFillBlankItems();
      return FillBlankTransformer.itemToDomainList(raw);
    } catch (err) {
      console.error('[FillBlankRepository] getAllItems failed:', err);
      return [];
    }
  },

  async getItemById(id: string): Promise<FillBlankItemEntity | null> {
    try {
      const raw = await db.getFillBlankItemById(id);
      if (!raw) return null;
      return FillBlankTransformer.itemToDomain(raw);
    } catch (err) {
      console.error('[FillBlankRepository] getItemById failed:', err);
      return null;
    }
  },

  async saveItem(entity: FillBlankItemEntity): Promise<void> {
    try {
      const persistence = FillBlankTransformer.itemToPersistence(entity);
      await db.saveFillBlankItem(persistence as any);
    } catch (err) {
      console.error('[FillBlankRepository] saveItem failed:', err);
    }
  },

  async deleteItem(id: string): Promise<void> {
    try {
      await db.deleteFillBlankItem(id);
    } catch (err) {
      console.error('[FillBlankRepository] deleteItem failed:', err);
    }
  },

  async getItemsByCategory(category: string): Promise<FillBlankItemEntity[]> {
    try {
      const raw = await db.getFillBlankItemsByCategory(category);
      return FillBlankTransformer.itemToDomainList(raw);
    } catch (err) {
      console.error('[FillBlankRepository] getItemsByCategory failed:', err);
      return [];
    }
  },

  // ==================== Sessions ====================

  async getAllSessions(): Promise<FillBlankSessionResultEntity[]> {
    try {
      const raw = await db.getAllFillBlankSessions();
      return (raw as unknown[]).map(r => FillBlankTransformer.sessionToDomain(r));
    } catch (err) {
      console.error('[FillBlankRepository] getAllSessions failed:', err);
      return [];
    }
  },

  async saveSession(entity: FillBlankSessionResultEntity): Promise<void> {
    try {
      await db.saveFillBlankSession(entity as any);
    } catch (err) {
      console.error('[FillBlankRepository] saveSession failed:', err);
    }
  },

  // ==================== Favorites ====================

  async getAllFavorites(): Promise<FillBlankFavoriteEntity[]> {
    try {
      const raw = await db.getAllFillBlankFavorites();
      return (raw as unknown[]).map(r => FillBlankTransformer.favoriteToDomain(r));
    } catch (err) {
      console.error('[FillBlankRepository] getAllFavorites failed:', err);
      return [];
    }
  },

  async saveFavorite(entity: FillBlankFavoriteEntity): Promise<void> {
    try {
      await db.saveFillBlankFavorite(entity as any);
    } catch (err) {
      console.error('[FillBlankRepository] saveFavorite failed:', err);
    }
  },

  async deleteFavorite(id: string): Promise<void> {
    try {
      await db.deleteFillBlankFavorite(id);
    } catch (err) {
      console.error('[FillBlankRepository] deleteFavorite failed:', err);
    }
  },

  // ==================== Wrong Answers ====================

  async getAllWrongAnswers(): Promise<FillBlankWrongAnswerEntity[]> {
    try {
      const raw = await db.getAllFillBlankWrongAnswers();
      return (raw as unknown[]).map(r => FillBlankTransformer.wrongAnswerToDomain(r));
    } catch (err) {
      console.error('[FillBlankRepository] getAllWrongAnswers failed:', err);
      return [];
    }
  },

  async saveWrongAnswer(entity: FillBlankWrongAnswerEntity): Promise<void> {
    try {
      await db.saveFillBlankWrongAnswer(entity as any);
    } catch (err) {
      console.error('[FillBlankRepository] saveWrongAnswer failed:', err);
    }
  },

  async deleteWrongAnswer(id: string): Promise<void> {
    try {
      await db.deleteFillBlankWrongAnswer(id);
    } catch (err) {
      console.error('[FillBlankRepository] deleteWrongAnswer failed:', err);
    }
  },

  // ==================== Import Records ====================

  async getAllImportRecords(): Promise<FillBlankImportRecordEntity[]> {
    try {
      const raw = await db.getAllFillBlankImportRecords();
      return (raw as unknown[]).map(r => FillBlankTransformer.importRecordToDomain(r));
    } catch (err) {
      console.error('[FillBlankRepository] getAllImportRecords failed:', err);
      return [];
    }
  },

  async saveImportRecord(entity: FillBlankImportRecordEntity): Promise<void> {
    try {
      await db.saveFillBlankImportRecord(entity as any);
    } catch (err) {
      console.error('[FillBlankRepository] saveImportRecord failed:', err);
    }
  },

  async deleteImportRecord(id: string): Promise<void> {
    try {
      await db.deleteFillBlankImportRecord(id);
    } catch (err) {
      console.error('[FillBlankRepository] deleteImportRecord failed:', err);
    }
  },
};
