/**
 * 云端同步服务
 * 本地模式：仅使用 IndexedDB 存储，不进行云端同步
 */

import * as db from '../storage/indexedDB';
import type { SyncItem } from '../../types';

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
  listeners.forEach(listener => listener(status, result));
}

/**
 * 执行完整同步（本地模式：仅清理同步队列）
 */
export async function syncAll(_userId: string): Promise<SyncResult> {
  notifyListeners('syncing');

  try {
    // 本地模式：清除待同步队列
    await db.clearPendingSync();

    const result: SyncResult = {
      success: true,
      syncedItems: 0,
      errors: [],
      timestamp: new Date(),
    };

    notifyListeners('success', result);
    return result;
  } catch (err) {
    const result: SyncResult = {
      success: false,
      syncedItems: 0,
      errors: [err instanceof Error ? err.message : '同步失败'],
      timestamp: new Date(),
    };

    notifyListeners('error', result);
    return result;
  }
}

/**
 * 仅推送本地数据到云端（本地模式：无操作）
 */
export async function pushToCloud(_userId: string): Promise<SyncResult> {
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
 * 仅从云端拉取数据（本地模式：无操作）
 */
export async function pullFromCloud(_userId: string): Promise<SyncResult> {
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
 * 添加待同步项
 */
export async function addToSyncQueue(item: SyncItem): Promise<void> {
  await db.addPendingSync(item);
}

/**
 * 获取待同步项数量
 */
export async function getPendingSyncCount(): Promise<number> {
  const items = await db.getAllPendingSync();
  return items.length;
}

/**
 * 处理待同步队列
 */
export async function processSyncQueue(userId: string): Promise<SyncResult> {
  const pendingItems = await db.getAllPendingSync();
  
  if (pendingItems.length === 0) {
    return {
      success: true,
      syncedItems: 0,
      errors: [],
      timestamp: new Date(),
    };
  }

  return syncAll(userId);
}
