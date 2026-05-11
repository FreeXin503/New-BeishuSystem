import { useState, useCallback } from 'react';

export interface SynoProgress {
  mode: 'practice' | 'challenge';
  currentIndex: number;
  totalItems: number;
  completedCount: number;
  lastPracticedAt?: string;
}

export function useSynoProgress() {
  const [savedProgress, setSavedProgress] = useState<SynoProgress | null>(null);
  const [shuffleMode, setShuffleMode] = useState<'shuffle' | 'sequential'>('sequential');

  // 获取保存的进度
  const loadProgress = useCallback(async (mode: 'practice' | 'challenge') => {
    try {
      const response = await fetch(`http://localhost:3001/api/synomaster/progress/${mode}`);
      const data = await response.json();
      setSavedProgress(data || null);
      return data || null;
    } catch (error) {
      console.error('Failed to load progress:', error);
      setSavedProgress(null);
      return null;
    }
  }, []);

  // 保存进度
  const saveProgress = useCallback(async (
    mode: 'practice' | 'challenge',
    currentIndex: number,
    totalItems: number,
    completedCount: number
  ) => {
    try {
      await fetch('http://localhost:3001/api/synomaster/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          currentIndex,
          totalItems,
          completedCount
        })
      });
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, []);

  // 重置进度
  const resetProgress = useCallback(async (mode: 'practice' | 'challenge') => {
    try {
      await fetch(`http://localhost:3001/api/synomaster/progress/${mode}`, {
        method: 'DELETE'
      });
      setSavedProgress(null);
    } catch (error) {
      console.error('Failed to reset progress:', error);
    }
  }, []);

  // 清除保存的进度状态
  const clearSavedProgress = useCallback(() => {
    setSavedProgress(null);
  }, []);

  return {
    savedProgress,
    setSavedProgress,
    shuffleMode,
    setShuffleMode,
    loadProgress,
    saveProgress,
    resetProgress,
    clearSavedProgress
  };
}
