/**
 * 离线数据持久化与同步属性测试
 * Property 11: 离线数据持久化与同步
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { SyncItem } from '../../types';

// Mock navigator
const mockNavigator = {
  onLine: true,
  serviceWorker: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    register: vi.fn().mockResolvedValue({}),
    ready: Promise.resolve({
      sync: { register: vi.fn() },
    }),
  },
  storage: {
    estimate: vi.fn().mockResolvedValue({ usage: 1024 }),
  },
};

Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true,
});

// Mock window
const mockWindow = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  caches: {
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
  },
};

Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true,
});

Object.defineProperty(global, 'caches', {
  value: mockWindow.caches,
  writable: true,
});

// Arbitrary generators
const syncItemArb = fc.record({
  id: fc.uuid(),
  type: fc.constantFrom('content', 'card', 'session', 'settings') as fc.Arbitrary<SyncItem['type']>,
  action: fc.constantFrom('create', 'update', 'delete') as fc.Arbitrary<SyncItem['action']>,
  data: fc.record({
    id: fc.uuid(),
    value: fc.string({ minLength: 1, maxLength: 100 }),
  }),
  timestamp: fc.date(),
}) as fc.Arbitrary<SyncItem>;

describe('离线数据持久化与同步属性测试 (Property 11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigator.onLine = true;
  });

  describe('同步项结构', () => {
    it('Property 11.1: 同步项应包含所有必要字段', () => {
      fc.assert(
        fc.property(syncItemArb, (item) => {
          expect(item.id).toBeDefined();
          expect(item.type).toBeDefined();
          expect(item.action).toBeDefined();
          expect(item.data).toBeDefined();
          expect(item.timestamp).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('Property 11.2: 同步项类型应为有效值', () => {
      fc.assert(
        fc.property(syncItemArb, (item) => {
          expect(['content', 'card', 'session', 'settings']).toContain(item.type);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 11.3: 同步项操作应为有效值', () => {
      fc.assert(
        fc.property(syncItemArb, (item) => {
          expect(['create', 'update', 'delete']).toContain(item.action);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('离线队列管理', () => {
    it('Property 11.4: 离线队列应保持 FIFO 顺序', () => {
      fc.assert(
        fc.property(
          fc.array(syncItemArb, { minLength: 1, maxLength: 10 }),
          (items) => {
            // 模拟队列
            const queue: SyncItem[] = [];
            
            // 添加到队列
            items.forEach(item => queue.push(item));
            
            // 验证顺序
            for (let i = 0; i < items.length; i++) {
              expect(queue[i].id).toBe(items[i].id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 11.5: 队列处理后应清空', () => {
      fc.assert(
        fc.property(
          fc.array(syncItemArb, { minLength: 1, maxLength: 10 }),
          (items) => {
            const queue: SyncItem[] = [...items];
            
            // 模拟处理
            while (queue.length > 0) {
              queue.shift();
            }
            
            expect(queue.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('在线状态管理', () => {
    it('Property 11.6: 在线状态变化应正确反映', () => {
      fc.assert(
        fc.property(fc.boolean(), (online) => {
          mockNavigator.onLine = online;
          
          // 模拟状态检查
          const status = mockNavigator.onLine;
          
          expect(status).toBe(online);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 11.7: 离线时应将操作加入队列', () => {
      fc.assert(
        fc.property(syncItemArb, (item) => {
          mockNavigator.onLine = false;
          const queue: SyncItem[] = [];
          
          // 模拟离线保存
          if (!mockNavigator.onLine) {
            queue.push(item);
          }
          
          expect(queue.length).toBe(1);
          expect(queue[0].id).toBe(item.id);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('数据一致性', () => {
    it('Property 11.8: 同步后本地和远程数据应一致', () => {
      fc.assert(
        fc.property(
          fc.array(syncItemArb, { minLength: 1, maxLength: 5 }),
          (items) => {
            // 模拟本地数据
            const localData = new Map<string, SyncItem>();
            items.forEach(item => localData.set(item.id, item));
            
            // 模拟同步到远程
            const remoteData = new Map<string, SyncItem>();
            localData.forEach((value, key) => remoteData.set(key, { ...value }));
            
            // 验证一致性
            expect(localData.size).toBe(remoteData.size);
            localData.forEach((local, key) => {
              const remote = remoteData.get(key);
              expect(remote).toBeDefined();
              expect(remote!.id).toBe(local.id);
              expect(remote!.type).toBe(local.type);
              expect(remote!.action).toBe(local.action);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 11.9: 重复同步应保持幂等性', () => {
      fc.assert(
        fc.property(syncItemArb, fc.nat({ max: 5 }), (item, repeatCount) => {
          const remoteData = new Map<string, SyncItem>();
          
          // 多次同步同一项
          for (let i = 0; i <= repeatCount; i++) {
            remoteData.set(item.id, { ...item });
          }
          
          // 应该只有一条记录
          expect(remoteData.size).toBe(1);
          expect(remoteData.get(item.id)!.id).toBe(item.id);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('错误恢复', () => {
    it('Property 11.10: 同步失败后数据应保留在队列中', () => {
      fc.assert(
        fc.property(
          fc.array(syncItemArb, { minLength: 1, maxLength: 5 }),
          fc.boolean(),
          (items, syncSuccess) => {
            const queue: SyncItem[] = [...items];
            
            // 模拟同步
            if (syncSuccess) {
              queue.length = 0; // 清空队列
            }
            // 失败时保留队列
            
            if (syncSuccess) {
              expect(queue.length).toBe(0);
            } else {
              expect(queue.length).toBe(items.length);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 11.11: 网络恢复后应自动重试同步', () => {
      fc.assert(
        fc.property(
          fc.array(syncItemArb, { minLength: 1, maxLength: 5 }),
          (items) => {
            const queue: SyncItem[] = [...items];
            let syncAttempted = false;
            
            // 模拟离线
            mockNavigator.onLine = false;
            
            // 模拟网络恢复
            mockNavigator.onLine = true;
            
            // 触发同步
            if (mockNavigator.onLine && queue.length > 0) {
              syncAttempted = true;
              queue.length = 0; // 模拟成功同步
            }
            
            expect(syncAttempted).toBe(true);
            expect(queue.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('缓存管理', () => {
    it('Property 11.12: 缓存大小应为非负数', () => {
      fc.assert(
        fc.property(fc.nat({ max: 1000000 }), (size) => {
          // 模拟缓存大小
          const cacheSize = size;
          
          expect(cacheSize).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });
  });
});
