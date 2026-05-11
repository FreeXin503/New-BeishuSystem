/**
 * 离线管理服务
 * 管理离线状态和数据同步
 */

import { syncAll, addToSyncQueue } from '../sync/syncService';
import type { SyncItem } from '../../types';

// 在线状态
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

// 状态监听器
type OnlineStatusListener = (online: boolean) => void;
const statusListeners: Set<OnlineStatusListener> = new Set();

// 同步监听器
type SyncListener = () => void;
const syncListeners: Set<SyncListener> = new Set();

/**
 * 初始化离线管理器
 */
export function initOfflineManager(): void {
  if (typeof window === 'undefined') return;
  
  // 监听在线状态变化
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // 监听 Service Worker 消息
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleSWMessage);
  }
  
  // 初始化状态
  isOnline = navigator.onLine;
}

/**
 * 清理离线管理器
 */
export function cleanupOfflineManager(): void {
  if (typeof window === 'undefined') return;
  
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.removeEventListener('message', handleSWMessage);
  }
}

/**
 * 处理上线事件
 */
async function handleOnline(): Promise<void> {
  isOnline = true;
  notifyStatusListeners(true);
  
  // 触发同步
  await triggerSync();
}

/**
 * 处理离线事件
 */
function handleOffline(): void {
  isOnline = false;
  notifyStatusListeners(false);
}

/**
 * 处理 Service Worker 消息
 */
function handleSWMessage(event: MessageEvent): void {
  if (event.data && event.data.type === 'SYNC_REQUIRED') {
    triggerSync();
  }
}

/**
 * 通知状态监听器
 */
function notifyStatusListeners(online: boolean): void {
  statusListeners.forEach((listener) => listener(online));
}

/**
 * 通知同步监听器
 */
function notifySyncListeners(): void {
  syncListeners.forEach((listener) => listener());
}

/**
 * 获取在线状态
 */
export function getOnlineStatus(): boolean {
  return isOnline;
}

/**
 * 添加在线状态监听器
 */
export function addOnlineStatusListener(listener: OnlineStatusListener): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

/**
 * 添加同步监听器
 */
export function addSyncListener(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

/**
 * 触发同步
 */
export async function triggerSync(): Promise<void> {
  if (!isOnline) {
    console.log('[Offline] 离线状态，跳过同步');
    return;
  }
  
  // 获取当前用户（使用本地认证）
  const { getCurrentUser } = await import('../auth/authService');
  const user = await getCurrentUser();
  
  if (!user || user.isGuest) {
    console.log('[Offline] 未登录或游客模式，跳过同步');
    return;
  }
  
  try {
    await syncAll(user.id);
    notifySyncListeners();
  } catch (error) {
    console.error('[Offline] 同步失败:', error);
  }
}

/**
 * 保存离线数据（自动添加到同步队列）
 */
export async function saveOfflineData(
  type: SyncItem['type'],
  action: SyncItem['action'],
  data: unknown
): Promise<void> {
  const syncItem: SyncItem = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    action,
    data,
    timestamp: new Date(),
  };
  
  await addToSyncQueue(syncItem);
  
  // 如果在线，立即尝试同步
  if (isOnline) {
    triggerSync();
  }
}

/**
 * 注册 Service Worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('[Offline] Service Worker 不支持');
    return null;
  }
  
  try {
    // 在开发环境中跳过 Service Worker 注册
    if (import.meta.env.DEV) {
      console.log('[Offline] 开发环境跳过 Service Worker 注册');
      return null;
    }
    
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    
    console.log('[Offline] Service Worker 注册成功');
    
    // 监听更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新版本可用
            console.log('[Offline] 新版本可用');
          }
        });
      }
    });
    
    return registration;
  } catch (error) {
    console.error('[Offline] Service Worker 注册失败:', error);
    return null;
  }
}

/**
 * 请求后台同步
 */
export async function requestBackgroundSync(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('sync' in ServiceWorkerRegistration.prototype)) {
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-data');
    return true;
  } catch {
    return false;
  }
}

/**
 * 清除所有缓存
 */
export async function clearAllCaches(): Promise<void> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
}

/**
 * 获取缓存大小
 */
export async function getCacheSize(): Promise<number> {
  if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
    return 0;
  }
  
  const estimate = await navigator.storage.estimate();
  return estimate.usage || 0;
}

/**
 * 检查是否支持离线功能
 */
export function isOfflineSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'caches' in window &&
    'indexedDB' in window
  );
}
