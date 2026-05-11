import { describe, it, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { useThemeStore } from './useThemeStore';
import type { Theme } from '../types';

// 重置 store 状态
const resetStore = () => {
  useThemeStore.setState({ theme: 'light' });
};

describe('Theme Store', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  /**
   * Feature: politics-study-system, Property 14: 主题切换幂等性
   * *For any* 初始主题状态，连续切换主题两次应回到原始状态。
   * **Validates: Requirements 13.1**
   */
  it('Property 14: 主题切换幂等性 - 连续切换两次应回到原始状态', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (initialTheme) => {
          // 设置初始主题
          useThemeStore.getState().setTheme(initialTheme);
          const originalTheme = useThemeStore.getState().theme;
          
          // 切换两次
          useThemeStore.getState().toggleTheme();
          useThemeStore.getState().toggleTheme();
          
          // 应该回到原始状态
          return useThemeStore.getState().theme === originalTheme;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: politics-study-system, Property 14: 主题切换幂等性
   * 单次切换应改变主题
   */
  it('Property 14: 单次切换应改变主题', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (initialTheme) => {
          useThemeStore.getState().setTheme(initialTheme);
          const originalTheme = useThemeStore.getState().theme;
          
          useThemeStore.getState().toggleTheme();
          
          return useThemeStore.getState().theme !== originalTheme;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: politics-study-system, Property 14: 主题切换幂等性
   * setTheme 应该正确设置主题
   */
  it('setTheme 应该正确设置指定的主题', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (targetTheme) => {
          useThemeStore.getState().setTheme(targetTheme);
          return useThemeStore.getState().theme === targetTheme;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 主题只能是 'light' 或 'dark'
   */
  it('主题值只能是 light 或 dark', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        (toggleCount) => {
          resetStore();
          
          for (let i = 0; i < toggleCount; i++) {
            useThemeStore.getState().toggleTheme();
          }
          
          const theme = useThemeStore.getState().theme;
          return theme === 'light' || theme === 'dark';
        }
      ),
      { numRuns: 100 }
    );
  });
});
