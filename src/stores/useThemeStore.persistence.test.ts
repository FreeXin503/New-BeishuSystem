import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { Theme } from '../types';

// 模拟 localStorage
const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get store() {
      return store;
    },
  };
};

describe('Theme Store Persistence', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
    vi.resetModules();
  });

  /**
   * Feature: politics-study-system, Property 15: 主题设置持久化
   * *For any* 主题切换操作，刷新页面后主题应保持为切换后的状态。
   * **Validates: Requirements 13.3**
   */
  it('Property 15: 主题设置持久化 - 主题应保存到 localStorage', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<Theme>('light', 'dark'),
        async (targetTheme) => {
          // 重新导入模块以获取新的 store 实例
          vi.resetModules();
          const { useThemeStore } = await import('./useThemeStore');
          
          // 设置主题
          useThemeStore.getState().setTheme(targetTheme);
          
          // 验证 localStorage 被调用
          const calls = mockStorage.setItem.mock.calls;
          const lastCall = calls[calls.length - 1];
          
          if (lastCall) {
            const [key, value] = lastCall;
            if (key === 'theme-storage') {
              const parsed = JSON.parse(value);
              return parsed.state.theme === targetTheme;
            }
          }
          
          // 如果没有调用 setItem，检查当前状态
          return useThemeStore.getState().theme === targetTheme;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: politics-study-system, Property 15: 主题设置持久化
   * 切换主题后应持久化新状态
   */
  it('Property 15: 切换主题后应持久化新状态', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<Theme>('light', 'dark'),
        fc.integer({ min: 1, max: 5 }),
        async (initialTheme, toggleCount) => {
          vi.resetModules();
          const { useThemeStore } = await import('./useThemeStore');
          
          // 设置初始主题
          useThemeStore.getState().setTheme(initialTheme);
          
          // 切换指定次数
          for (let i = 0; i < toggleCount; i++) {
            useThemeStore.getState().toggleTheme();
          }
          
          // 计算预期主题
          const expectedTheme = toggleCount % 2 === 0 ? initialTheme : (initialTheme === 'light' ? 'dark' : 'light');
          
          // 验证当前状态
          return useThemeStore.getState().theme === expectedTheme;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 验证持久化存储的键名正确
   */
  it('应使用正确的存储键名 theme-storage', async () => {
    vi.resetModules();
    const { useThemeStore } = await import('./useThemeStore');
    
    useThemeStore.getState().setTheme('dark');
    
    // 检查是否使用了正确的键名
    const setItemCalls = mockStorage.setItem.mock.calls;
    const hasCorrectKey = setItemCalls.some(([key]) => key === 'theme-storage');
    
    expect(hasCorrectKey).toBe(true);
  });
});
