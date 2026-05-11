/**
 * 中文拼写游戏逻辑
 */

import type { ChineseSpellingItem, ChineseSpellingGameState, ChineseSpellingSessionResult } from '../../types';

// 初始化中文拼写游戏
export function initializeChineseSpellingGame(
  items: ChineseSpellingItem[], 
  mode: 'practice' | 'challenge' = 'practice',
  maxHealth: number = 5
): ChineseSpellingGameState {
  if (items.length === 0) {
    throw new Error('没有可练习的中文拼写项目');
  }

  const firstItem = items[0];

  return {
    currentItem: firstItem,
    currentAnswer: '',
    isAnswered: false,
    isCorrect: false,
    showHint: false,
    hintLevel: 0,
    score: 0,
    streak: 0,
    totalAttempts: 0,
    correctAttempts: 0,
    startTime: new Date(),
    mode,
    health: mode === 'challenge' ? maxHealth : undefined,
    maxHealth: mode === 'challenge' ? maxHealth : undefined,
  };
}

// 解析逗号分隔格式的中文拼写数据
export function parseChineseSpellingText(text: string): ChineseSpellingItem[] {
  try {
    const lines = text.trim().split('\n');
    const now = new Date();
    const items: ChineseSpellingItem[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // 解析格式：english,chinese
      const parts = trimmedLine.split(',');
      if (parts.length < 2) {
        console.warn('跳过格式错误的行:', line);
        continue;
      }

      const english = parts[0].trim();
      const chinese = parts.slice(1).join(',').trim(); // 支持中文中包含逗号的情况

      if (!english || !chinese) {
        console.warn('跳过空的英文或中文:', line);
        continue;
      }

      const item: ChineseSpellingItem = {
        id: `cs-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        english,
        chinese,
        createdAt: now,
        updatedAt: now,
      };

      items.push(item);
    }

    return items;
  } catch (error) {
    console.error('解析中文拼写文本失败:', error);
    throw new Error('文本格式错误，请检查格式：每行应为 "英文,中文"');
  }
}

// 生成中文拼写提示
export function generateChineseSpellingHint(
  gameState: ChineseSpellingGameState,
  hintLevel: number
): string {
  if (!gameState.currentItem) return '';

  const { chinese } = gameState.currentItem;

  switch (hintLevel) {
    case 1:
      // 显示首字
      return chinese.charAt(0);
    case 2:
      // 显示拼音（简单实现，实际可能需要拼音库）
      return `拼音: ${chinese.split('').map(char => char).join(' ')}`;
    case 3:
      // 显示完整答案
      return chinese;
    default:
      return '';
  }
}

// 检查中文拼写答案
export function checkChineseSpellingAnswer(
  gameState: ChineseSpellingGameState, 
  userAnswer: string
): ChineseSpellingGameState {
  if (!gameState.currentItem) return gameState;

  // 标准化答案：去除空格、标点符号等
  const normalizeAnswer = (text: string): string => {
    return text
      .trim()
      .replace(/\s+/g, '')
      .replace(/[，。！？；：""''（）【】《》]/g, '');
  };

  const normalizedUserAnswer = normalizeAnswer(userAnswer);
  const normalizedCorrectAnswer = normalizeAnswer(gameState.currentItem.chinese);
  const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;

  const newHealth = gameState.mode === 'challenge' && !isCorrect 
    ? (gameState.health || 0) - 1 
    : gameState.health;

  return {
    ...gameState,
    currentAnswer: userAnswer,
    isAnswered: true,
    isCorrect,
    score: isCorrect ? gameState.score + 10 : gameState.score,
    streak: isCorrect ? gameState.streak + 1 : 0,
    totalAttempts: gameState.totalAttempts + 1,
    correctAttempts: isCorrect ? gameState.correctAttempts + 1 : gameState.correctAttempts,
    health: newHealth,
  };
}

// 下一个中文拼写项目
export function nextChineseSpellingItem(
  gameState: ChineseSpellingGameState, 
  remainingItems: ChineseSpellingItem[]
): {
  gameState: ChineseSpellingGameState;
  remainingItems: ChineseSpellingItem[];
  isCompleted: boolean;
} {
  if (remainingItems.length === 0) {
    return {
      gameState,
      remainingItems,
      isCompleted: true,
    };
  }

  // 检查挑战模式下血量是否耗尽
  if (gameState.mode === 'challenge' && (gameState.health || 0) <= 0) {
    return {
      gameState,
      remainingItems,
      isCompleted: true,
    };
  }

  const nextItem = remainingItems[0];
  const newRemaining = [...remainingItems];
  newRemaining.shift();

  return {
    gameState: {
      ...gameState,
      currentItem: nextItem,
      currentAnswer: '',
      isAnswered: false,
      isCorrect: false,
      showHint: false,
      hintLevel: 0,
    },
    remainingItems: newRemaining,
    isCompleted: false,
  };
}

// 生成中文拼写会话结果
export function generateChineseSpellingSessionResult(
  gameState: ChineseSpellingGameState,
  totalItems: number,
  category?: string
): ChineseSpellingSessionResult {
  const endTime = new Date();
  const totalTime = endTime.getTime() - gameState.startTime.getTime();
  const accuracy = gameState.totalAttempts > 0 
    ? (gameState.correctAttempts / gameState.totalAttempts) * 100 
    : 0;

  return {
    sessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    totalItems,
    correctAnswers: gameState.correctAttempts,
    accuracy,
    totalTime,
    averageTimePerItem: gameState.totalAttempts > 0 ? totalTime / gameState.totalAttempts : 0,
    mode: gameState.mode,
    category,
    completedAt: endTime,
    finalHealth: gameState.health,
    maxHealth: gameState.maxHealth,
  };
}

// 验证中文拼写数据格式
export function validateChineseSpellingData(items: ChineseSpellingItem[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(items)) {
    errors.push('数据必须是数组格式');
    return { isValid: false, errors };
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const index = i + 1;

    if (!item.english || typeof item.english !== 'string') {
      errors.push(`第${index}行：英文单词不能为空`);
    }

    if (!item.chinese || typeof item.chinese !== 'string') {
      errors.push(`第${index}行：中文释义不能为空`);
    }

    if (item.english && item.english.length > 100) {
      errors.push(`第${index}行：英文单词过长（最多100字符）`);
    }

    if (item.chinese && item.chinese.length > 50) {
      errors.push(`第${index}行：中文释义过长（最多50字符）`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
