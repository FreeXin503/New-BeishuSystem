/**
 * Quiz 统一仓储
 * 
 * 封装 IndexedDB 的 Quiz Archive、Wrong Answers、Favorites CRUD，
 * 对外仅暴露 Entity 类型。
 */

import type {
  QuizArchiveEntity,
  WrongAnswerEntity,
  FavoriteQuestionEntity,
  FavoriteCategoryEntity,
  QuizSessionResultEntity,
} from '../../domain/models';
import { QuizTransformer } from '../transformers/QuizTransformer';
import * as db from '../../services/storage/indexedDB';

export const QuizRepository = {
  // ==================== Archives ====================

  async getAllArchives(): Promise<QuizArchiveEntity[]> {
    try {
      const raw = await db.getAllQuizArchives();
      return QuizTransformer.archiveToDomainList(raw);
    } catch (err) {
      console.error('[QuizRepository] getAllArchives failed:', err);
      return [];
    }
  },

  async getArchiveById(id: string): Promise<QuizArchiveEntity | null> {
    try {
      const raw = await db.getQuizArchiveById(id);
      if (!raw) return null;
      return QuizTransformer.archiveToDomain(raw);
    } catch (err) {
      console.error('[QuizRepository] getArchiveById failed:', err);
      return null;
    }
  },

  async saveArchive(entity: QuizArchiveEntity): Promise<void> {
    try {
      const persistence = QuizTransformer.archiveToPersistence(entity);
      await db.saveQuizArchive(persistence as any);
    } catch (err) {
      console.error('[QuizRepository] saveArchive failed:', err);
    }
  },

  async deleteArchive(id: string): Promise<void> {
    try {
      await db.deleteQuizArchive(id);
    } catch (err) {
      console.error('[QuizRepository] deleteArchive failed:', err);
    }
  },

  // ==================== Wrong Answers ====================

  async getAllWrongAnswers(): Promise<WrongAnswerEntity[]> {
    try {
      const raw = await db.getAllWrongAnswers();
      return QuizTransformer.wrongAnswerToDomainList(raw);
    } catch (err) {
      console.error('[QuizRepository] getAllWrongAnswers failed:', err);
      return [];
    }
  },

  async saveWrongAnswer(entity: WrongAnswerEntity): Promise<void> {
    try {
      const persistence = QuizTransformer.wrongAnswerToPersistence(entity);
      await db.saveWrongAnswer(persistence as any);
    } catch (err) {
      console.error('[QuizRepository] saveWrongAnswer failed:', err);
    }
  },

  async deleteWrongAnswer(id: string): Promise<void> {
    try {
      await db.deleteWrongAnswer(id);
    } catch (err) {
      console.error('[QuizRepository] deleteWrongAnswer failed:', err);
    }
  },

  // ==================== Favorites ====================

  async getAllFavorites(): Promise<FavoriteQuestionEntity[]> {
    try {
      const raw = await db.getAllFavorites();
      return (raw as unknown[]).map(r => QuizTransformer.favoriteQuestionToDomain(r));
    } catch (err) {
      console.error('[QuizRepository] getAllFavorites failed:', err);
      return [];
    }
  },

  async saveFavorite(entity: FavoriteQuestionEntity): Promise<void> {
    try {
      await db.saveFavorite(entity as any);
    } catch (err) {
      console.error('[QuizRepository] saveFavorite failed:', err);
    }
  },

  async deleteFavorite(id: string): Promise<void> {
    try {
      await db.deleteFavorite(id);
    } catch (err) {
      console.error('[QuizRepository] deleteFavorite failed:', err);
    }
  },

  // ==================== Favorite Categories ====================

  async getAllFavoriteCategories(): Promise<FavoriteCategoryEntity[]> {
    try {
      const raw = await db.getAllFavoriteCategories();
      return (raw as unknown[]).map(r => QuizTransformer.favoriteCategoryToDomain(r));
    } catch (err) {
      console.error('[QuizRepository] getAllFavoriteCategories failed:', err);
      return [];
    }
  },

  // ==================== Quiz Sessions ====================

  async getAllSessions(): Promise<QuizSessionResultEntity[]> {
    try {
      const raw = await db.getAllQuizSessions();
      return (raw as unknown[]).map(r => QuizTransformer.sessionResultToDomain(r));
    } catch (err) {
      console.error('[QuizRepository] getAllSessions failed:', err);
      return [];
    }
  },

  async saveSession(entity: QuizSessionResultEntity): Promise<void> {
    try {
      await db.saveQuizSession(entity as any);
    } catch (err) {
      console.error('[QuizRepository] saveSession failed:', err);
    }
  },
};
