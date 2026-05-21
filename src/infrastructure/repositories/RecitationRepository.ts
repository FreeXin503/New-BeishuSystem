/**
 * 统一回诵/练习事务仓储
 * 
 * 实现企业级“事务预写发件箱日志（Write-Ahead Outbox Log）”机制。
 * 所有突变写操作首先生成 UUID 并持久化写入 IndexedDB 中的 outbox_transactions 队列，
 * 然后立即执行本地状态更新以保障 UI 无延迟响应，最后在网络可用时触发后台同步。
 */

import * as db from '../../services/storage/indexedDB';
import type { OutboxTransaction, WrongAnswer, FillBlankWrongAnswer } from '../../types';

// 简易且鲁棒的 UUID v4 生成器
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 预写事务日志到发件箱
 */
async function writeToOutbox(
  action: OutboxTransaction['action'],
  payload: any
): Promise<string> {
  const txId = generateUUID();
  const tx: OutboxTransaction = {
    id: txId,
    action,
    payload,
    timestamp: Date.now(),
    isSynced: false,
  };
  
  await db.saveOutboxTransaction(tx);
  return txId;
}

/**
 * 异步触发同步
 */
function triggerSyncAsync() {
  // 动态导入以防任何可能的循环依赖，并且不会阻塞主线程写操作
  import('../../services/offline/offlineManager')
    .then((m) => {
      m.triggerSync().catch((err) => {
        console.error('[RecitationRepository] Auto triggerSync failed:', err);
      });
    })
    .catch((err) => {
      console.error('[RecitationRepository] Failed to import offlineManager:', err);
    });
}

export const RecitationRepository = {
  // ==================== 标记掌握 (MARK_MASTERED) ====================

  /**
   * 标记错题为已掌握/未掌握
   */
  async markWrongAnswerMastered(
    id: string,
    mastered: boolean,
    type: 'quiz' | 'fillblank' = 'quiz'
  ): Promise<string> {
    // 1. 预写发件箱日志
    const txId = await writeToOutbox('MARK_MASTERED', { id, mastered, type });

    // 2. 立即更新本地状态 (Local-First)
    try {
      if (type === 'quiz') {
        const wrong = await db.getWrongAnswerById(id);
        if (wrong) {
          const updated: WrongAnswer = {
            ...wrong,
            mastered,
            updatedAt: new Date(),
          };
          await db.saveWrongAnswer(updated);
        } else {
          // 尝试回退按 questionId 查询
          const wrongByQ = await db.getWrongAnswerByQuestionId(id);
          if (wrongByQ) {
            const updated: WrongAnswer = {
              ...wrongByQ,
              mastered,
              updatedAt: new Date(),
            };
            await db.saveWrongAnswer(updated);
          }
        }
      } else {
        // 填空题错题
        const wrongs = await db.getFillBlankWrongAnswersByItemId(id);
        if (wrongs && wrongs.length > 0) {
          for (const wrong of wrongs) {
            const updated: FillBlankWrongAnswer = {
              ...wrong,
              mastered,
              lastWrongAt: new Date(),
            };
            await db.saveFillBlankWrongAnswer(updated);
          }
        } else {
          // 尝试直接按 ID 查找
          const all = await db.getAllFillBlankWrongAnswers();
          const match = all.find(w => w.id === id);
          if (match) {
            const updated: FillBlankWrongAnswer = {
              ...match,
              mastered,
              lastWrongAt: new Date(),
            };
            await db.saveFillBlankWrongAnswer(updated);
          }
        }
      }
    } catch (err) {
      console.error('[RecitationRepository] Local write failed for MARK_MASTERED:', err);
    }

    // 3. 异步触发同步
    triggerSyncAsync();

    return txId;
  },

  // ==================== 生成错题 (SAVE_WRONG) ====================

  /**
   * 生成并保存错题
   */
  async saveWrongAnswer(
    wrongAnswer: WrongAnswer | FillBlankWrongAnswer,
    type: 'quiz' | 'fillblank' = 'quiz'
  ): Promise<string> {
    // 1. 预写发件箱日志
    const txId = await writeToOutbox('SAVE_WRONG', { wrongAnswer, type });

    // 2. 立即更新本地状态
    try {
      if (type === 'quiz') {
        await db.saveWrongAnswer(wrongAnswer as WrongAnswer);
      } else {
        await db.saveFillBlankWrongAnswer(wrongAnswer as FillBlankWrongAnswer);
      }
    } catch (err) {
      console.error('[RecitationRepository] Local write failed for SAVE_WRONG:', err);
    }

    // 3. 异步触发同步
    triggerSyncAsync();

    return txId;
  },

  // ==================== 进度打卡 (SAVE_PROGRESS) ====================

  /**
   * 保存练习/拼写进度
   */
  async saveProgress(data: {
    mode: string;
    currentIndex: number;
    totalItems: number;
    completedCount: number;
    type: 'spelling' | 'synomaster';
  }): Promise<string> {
    // 1. 预写发件箱日志
    const txId = await writeToOutbox('SAVE_PROGRESS', data);

    // 2. 立即更新本地状态 (写入 localStorage 缓存作为离线第一体验)
    try {
      const cacheKey = `offline_progress_${data.type}_${data.mode}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        ...data,
        lastPracticedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    } catch (err) {
      console.error('[RecitationRepository] Local write failed for SAVE_PROGRESS:', err);
    }

    // 3. 异步触发同步
    triggerSyncAsync();

    return txId;
  },

  /**
   * 重置/删除练习进度
   */
  async deleteProgress(
    mode: string,
    type: 'spelling' | 'synomaster'
  ): Promise<string> {
    // 1. 预写发件箱日志
    const txId = await writeToOutbox('DELETE_PROGRESS', { mode, type });

    // 2. 立即更新本地状态
    try {
      const cacheKey = `offline_progress_${type}_${mode}`;
      localStorage.removeItem(cacheKey);
    } catch (err) {
      console.error('[RecitationRepository] Local write failed for DELETE_PROGRESS:', err);
    }

    // 3. 异步触发同步
    triggerSyncAsync();

    return txId;
  },

  // ==================== 收藏 (SAVE_FAVORITE / DELETE_FAVORITE) ====================

  /**
   * 添加收藏
   */
  async addFavorite(
    itemId: string,
    favoriteDate: string,
    type: 'spelling' | 'quiz' | 'fillblank' = 'spelling'
  ): Promise<string> {
    // 1. 预写发件箱日志
    const txId = await writeToOutbox('SAVE_FAVORITE', { itemId, favoriteDate, type });

    // 2. 立即更新本地状态
    try {
      if (type === 'spelling') {
        const cacheKey = `offline_fav_spelling_${itemId}`;
        localStorage.setItem(cacheKey, JSON.stringify({ itemId, favoriteDate, createdAt: new Date().toISOString() }));
      } else if (type === 'quiz') {
        await db.saveFavorite({
          id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          questionId: itemId,
          category: 'quiz',
          createdAt: new Date(),
        } as any);
      } else {
        await db.saveFillBlankFavorite({
          id: `fav-fb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          fillBlankItemId: itemId,
          category: 'fillblank',
          createdAt: new Date(),
        } as any);
      }
    } catch (err) {
      console.error('[RecitationRepository] Local write failed for SAVE_FAVORITE:', err);
    }

    // 3. 异步触发同步
    triggerSyncAsync();

    return txId;
  },

  /**
   * 删除收藏
   */
  async removeFavorite(
    itemId: string,
    type: 'spelling' | 'quiz' | 'fillblank' = 'spelling'
  ): Promise<string> {
    // 1. 预写发件箱日志
    const txId = await writeToOutbox('DELETE_FAVORITE', { itemId, type });

    // 2. 立即更新本地状态
    try {
      if (type === 'spelling') {
        const cacheKey = `offline_fav_spelling_${itemId}`;
        localStorage.removeItem(cacheKey);
      } else if (type === 'quiz') {
        const fav = await db.getFavoriteByQuestionId(itemId);
        if (fav) {
          await db.deleteFavorite(fav.id);
        }
      } else {
        const favs = await db.getFillBlankFavoritesByItemId(itemId);
        if (favs && favs.length > 0) {
          for (const fav of favs) {
            await db.deleteFillBlankFavorite(fav.id);
          }
        }
      }
    } catch (err) {
      console.error('[RecitationRepository] Local write failed for DELETE_FAVORITE:', err);
    }

    // 3. 异步触发同步
    triggerSyncAsync();

    return txId;
  },
};
