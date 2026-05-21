/**
 * 企业级串行数据同步中台
 * 
 * 采用 FIFO (先进先出) 串行队列消费本地发件箱（Outbox Queue）中的事务日志。
 * 允许携带全局唯一的 transactionId，以支持服务端的强幂等拦截。
 */

import * as db from '../storage/indexedDB';
import type { OutboxTransaction } from '../../types';

// 同步状态
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// 同步结果
export interface SyncResult {
  success: boolean;
  syncedItems: number;
  errors: string[];
  timestamp: Date;
}

// 同步监听器
type SyncListener = (status: SyncStatus, result?: SyncResult) => void;
const listeners: Set<SyncListener> = new Set();

let syncStatus: SyncStatus = 'idle';
let lastSyncResult: SyncResult | null = null;
let isSyncing = false; // 排他锁，防止并发重入

const API_BASE = 'http://localhost:3001/api';

/**
 * 获取当前同步状态
 */
export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

/**
 * 获取最后同步结果
 */
export function getLastSyncResult(): SyncResult | null {
  return lastSyncResult;
}

/**
 * 添加同步状态监听器
 */
export function addSyncListener(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 通知所有监听器
 */
function notifyListeners(status: SyncStatus, result?: SyncResult) {
  syncStatus = status;
  if (result) lastSyncResult = result;
  listeners.forEach(listener => {
    try {
      listener(status, result);
    } catch (e) {
      console.error('[SyncService] Listener error:', e);
    }
  });
}

/**
 * 处理单个事务日志 (FIFO 消费)
 */
async function processTransaction(tx: OutboxTransaction): Promise<{ success: boolean; shouldRetry: boolean; error?: string }> {
  const { action, payload, id: transactionId } = tx;

  try {
    switch (action) {
      case 'SAVE_PROGRESS': {
        const { mode, currentIndex, totalItems, completedCount, type } = payload;
        const url = type === 'spelling' 
          ? `${API_BASE}/progress` 
          : `${API_BASE}/synomaster/progress`;
        
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, currentIndex, totalItems, completedCount, transactionId }),
        });

        if (!res.ok) {
          return { 
            success: false, 
            shouldRetry: res.status >= 500, // 5xx 服务端错误或网络失败可重试，4xx 为 poison pill 不重试
            error: `HTTP ${res.status} on SAVE_PROGRESS`
          };
        }
        break;
      }

      case 'DELETE_PROGRESS': {
        const { mode, type } = payload;
        const url = type === 'spelling'
          ? `${API_BASE}/progress/${mode}`
          : `${API_BASE}/synomaster/progress/${mode}`;

        const res = await fetch(url, {
          method: 'DELETE',
          headers: { 
            'Content-Type': 'application/json',
            'x-transaction-id': transactionId 
          },
          // 兼容性 body，某些后端需要
          body: JSON.stringify({ transactionId })
        });

        if (!res.ok) {
          return { 
            success: false, 
            shouldRetry: res.status >= 500, 
            error: `HTTP ${res.status} on DELETE_PROGRESS` 
          };
        }
        break;
      }

      case 'SAVE_FAVORITE': {
        const { itemId, favoriteDate, type } = payload;
        if (type === 'spelling') {
          const res = await fetch(`${API_BASE}/favorites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, favoriteDate, transactionId }),
          });

          if (!res.ok) {
            return { 
              success: false, 
              shouldRetry: res.status >= 500, 
              error: `HTTP ${res.status} on SAVE_FAVORITE` 
            };
          }
        }
        // quiz/fillblank 错题和收藏为本地 IndexedDB 存储，不需同步到云端
        break;
      }

      case 'DELETE_FAVORITE': {
        const { itemId, type } = payload;
        if (type === 'spelling') {
          const res = await fetch(`${API_BASE}/favorites/${itemId}`, {
            method: 'DELETE',
            headers: { 
              'Content-Type': 'application/json',
              'x-transaction-id': transactionId 
            },
            body: JSON.stringify({ transactionId })
          });

          if (!res.ok) {
            return { 
              success: false, 
              shouldRetry: res.status >= 500, 
              error: `HTTP ${res.status} on DELETE_FAVORITE` 
            };
          }
        }
        break;
      }

      case 'SAVE_WRONG':
      case 'MARK_MASTERED':
        // 本地离线逻辑已在仓储层应用，无需同步到服务器（当前 server.cjs 尚未开放错题 API）
        break;

      default:
        console.warn(`[SyncService] Unknown transaction action: ${action}`);
    }

    // 处理成功
    return { success: true, shouldRetry: false };
  } catch (err) {
    // 捕获网络错误 (TypeError: Failed to fetch) 等
    console.error(`[SyncService] Connection error processing transaction ${transactionId}:`, err);
    return { 
      success: false, 
      shouldRetry: true, // 网络故障，必须重试
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * 执行完整同步（串行消费发件箱队列）
 */
export async function syncAll(_userId?: string): Promise<SyncResult> {
  if (isSyncing) {
    console.log('[SyncService] Synchronous task already in progress. Skipping.');
    return {
      success: false,
      syncedItems: 0,
      errors: ['Sync already in progress'],
      timestamp: new Date(),
    };
  }

  isSyncing = true;
  notifyListeners('syncing');

  const errorsList: string[] = [];
  let syncedCount = 0;

  try {
    // 1. 获取所有未同步事务 (FIFO 顺序)
    const unsyncedTxs = await db.getUnsyncedOutboxTransactions();

    if (unsyncedTxs.length === 0) {
      console.log('[SyncService] Outbox queue is empty. Sync complete.');
      const result: SyncResult = {
        success: true,
        syncedItems: 0,
        errors: [],
        timestamp: new Date(),
      };
      notifyListeners('success', result);
      isSyncing = false;
      return result;
    }

    console.log(`[SyncService] Found ${unsyncedTxs.length} unsynced transactions. Processing FIFO...`);

    // 2. 依次串行处理每个事务
    for (const tx of unsyncedTxs) {
      const res = await processTransaction(tx);

      if (res.success) {
        // 标记为已同步
        await db.markTransactionSynced(tx.id);
        syncedCount++;
      } else {
        errorsList.push(`Tx ${tx.id} failed: ${res.error}`);
        
        // 如果是网络连接错误等需要重试的情况，则必须中断队列处理以维持因果顺序 (Causality)
        if (res.shouldRetry) {
          console.warn('[SyncService] Network error encountered. Suspending queue consumption to preserve causality.');
          break;
        } else {
          // 4xx Poison Pill: 记录错误，但标记为已同步并继续处理，防止死锁
          console.error(`[SyncService] Client error (poison pill) on transaction ${tx.id}. Skipping.`, res.error);
          await db.markTransactionSynced(tx.id);
          syncedCount++;
        }
      }
    }

    // 3. 构建最终同步结果
    const isPerfectSuccess = errorsList.length === 0 || syncedCount > 0;
    const result: SyncResult = {
      success: isPerfectSuccess,
      syncedItems: syncedCount,
      errors: errorsList,
      timestamp: new Date(),
    };

    if (isPerfectSuccess) {
      notifyListeners('success', result);
    } else {
      notifyListeners('error', result);
    }

    isSyncing = false;
    return result;
  } catch (err) {
    console.error('[SyncService] Fatal sync failure:', err);
    const result: SyncResult = {
      success: false,
      syncedItems: syncedCount,
      errors: [err instanceof Error ? err.message : 'Fatal sync failure'],
      timestamp: new Date(),
    };
    notifyListeners('error', result);
    isSyncing = false;
    return result;
  }
}

/**
 * 仅推送本地数据到云端（在 WAOL 架构中与 syncAll 行为一致）
 */
export async function pushToCloud(userId: string): Promise<SyncResult> {
  return syncAll(userId);
}

/**
 * 仅从云端拉取数据（本地发件箱只负责推送/同步本地突变）
 */
export async function pullFromCloud(_userId: string): Promise<SyncResult> {
  // 目前版本下只做空操作以保持兼容
  const result: SyncResult = {
    success: true,
    syncedItems: 0,
    errors: [],
    timestamp: new Date(),
  };
  notifyListeners('success', result);
  return result;
}

/**
 * 添加待同步项 (保持向下兼容 API，内部改为生成发件箱事务)
 */
export async function addToSyncQueue(item: any): Promise<void> {
  // 转换成 OutboxTransaction 结构存入
  const tx: OutboxTransaction = {
    id: item.id || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    action: item.action === 'delete' ? 'DELETE_PROGRESS' : 'SAVE_PROGRESS',
    payload: item.data || item,
    timestamp: Date.now(),
    isSynced: false,
  };
  await db.saveOutboxTransaction(tx);
}

/**
 * 获取待同步项数量
 */
export async function getPendingSyncCount(): Promise<number> {
  const txs = await db.getUnsyncedOutboxTransactions();
  return txs.length;
}

/**
 * 处理待同步队列
 */
export async function processSyncQueue(userId: string): Promise<SyncResult> {
  return syncAll(userId);
}
