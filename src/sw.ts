/**
 * Service Worker
 * 实现离线缓存和资源管理
 */

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// 需要预缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// 缓存策略
type CacheStrategy = 'cache-first' | 'network-first' | 'stale-while-revalidate';

/**
 * 安装事件 - 预缓存静态资源
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] 预缓存静态资源');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // 跳过等待，立即激活
  self.skipWaiting();
});

/**
 * 激活事件 - 清理旧缓存
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[SW] 删除旧缓存:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // 立即控制所有页面
  self.clients.claim();
});

/**
 * 获取缓存策略
 */
function getCacheStrategy(request: Request): CacheStrategy {
  const url = new URL(request.url);
  
  // API 请求使用 network-first
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    return 'network-first';
  }
  
  // 静态资源使用 cache-first
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/) ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')
  ) {
    return 'cache-first';
  }
  
  // 其他请求使用 stale-while-revalidate
  return 'stale-while-revalidate';
}

/**
 * Cache First 策略
 */
async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // 返回离线页面或错误响应
    return new Response('离线状态', { status: 503 });
  }
}

/**
 * Network First 策略
 */
async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: '离线状态' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Stale While Revalidate 策略
 */
async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cache = caches.open(DYNAMIC_CACHE);
      cache.then((c) => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => {
    // 网络失败时返回缓存
    return cached || new Response('离线状态', { status: 503 });
  });
  
  return cached || fetchPromise;
}

/**
 * Fetch 事件 - 拦截网络请求
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // 跳过非 GET 请求
  if (request.method !== 'GET') {
    return;
  }
  
  // 跳过 chrome-extension 等非 http(s) 请求
  if (!request.url.startsWith('http')) {
    return;
  }
  
  const strategy = getCacheStrategy(request);
  
  switch (strategy) {
    case 'cache-first':
      event.respondWith(cacheFirst(request));
      break;
    case 'network-first':
      event.respondWith(networkFirst(request));
      break;
    case 'stale-while-revalidate':
      event.respondWith(staleWhileRevalidate(request));
      break;
  }
});

/**
 * 消息事件 - 处理来自主线程的消息
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      })
    );
  }
});

/**
 * 后台同步事件
 */
self.addEventListener('sync', ((event: SyncEvent) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
}) as EventListener);

// SyncEvent 类型定义
interface SyncEvent extends ExtendableEvent {
  tag: string;
}

/**
 * 同步数据
 */
async function syncData(): Promise<void> {
  // 通知主线程进行数据同步
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_REQUIRED' });
  });
}

export {};
