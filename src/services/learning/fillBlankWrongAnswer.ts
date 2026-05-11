/**
 * 填空题错题本服务
 */

import type { FillBlankItem, FillBlankWrongAnswer } from '../../types';
import {
  getAllFillBlankWrongAnswers as getAllWrong,
  saveFillBlankWrongAnswer,
  deleteFillBlankWrongAnswer,
  getFillBlankWrongAnswersByCategory as getWrongByCategory,
  getFillBlankWrongAnswersByItemId as getWrongByItemId,
  getUnmasteredFillBlankWrongAnswers as getUnmasteredWrong,
} from '../storage/indexedDB';

// 默认分类
export const DEFAULT_FILL_BLANK_CATEGORIES = [
  { value: 'general', label: '通用' },
  { value: 'politics', label: '政治' },
  { value: 'history', label: '历史' },
  { value: 'philosophy', label: '哲学' },
  { value: 'economics', label: '经济学' },
  { value: 'law', label: '法学' },
  { value: 'custom', label: '自定义' },
];

/**
 * 获取分类标签
 */
export function getFillBlankCategoryLabel(category: string): string {
  const found = DEFAULT_FILL_BLANK_CATEGORIES.find(cat => cat.value === category);
  return found?.label || category;
}

/**
 * 添加填空题错题
 */
export async function addFillBlankWrongAnswer(
  fillBlankItem: FillBlankItem,
  userAnswer: string,
  category: string = 'general',
  hints?: string[]
): Promise<FillBlankWrongAnswer> {
  // 检查是否已有该题的错题记录
  const existing = await getWrongByItemId(fillBlankItem.id);
  const existingWrong = existing.find((w: FillBlankWrongAnswer) => !w.mastered);
  
  if (existingWrong) {
    // 更新现有错题记录
    existingWrong.wrongCount += 1;
    existingWrong.lastWrongAt = new Date();
    existingWrong.userAnswer = userAnswer;
    if (hints) {
      existingWrong.hints = hints;
    }
    await saveFillBlankWrongAnswer(existingWrong);
    return existingWrong;
  }

  // 创建新的错题记录
  const wrongAnswer: FillBlankWrongAnswer = {
    id: `fill-blank-wrong-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    fillBlankItemId: fillBlankItem.id,
    fillBlankItem,
    userAnswer,
    correctAnswer: fillBlankItem.answer,
    category,
    wrongCount: 1,
    firstWrongAt: new Date(),
    lastWrongAt: new Date(),
    mastered: false,
    hints,
  };

  await saveFillBlankWrongAnswer(wrongAnswer);
  return wrongAnswer;
}

/**
 * 删除填空题错题
 */
export async function removeFillBlankWrongAnswer(id: string): Promise<void> {
  await deleteFillBlankWrongAnswer(id);
}

/**
 * 标记填空题错题为已掌握
 */
export async function markFillBlankWrongAsMastered(id: string): Promise<void> {
  const allWrong = await getAllWrong();
  const wrong = allWrong.find((w: FillBlankWrongAnswer) => w.id === id);
  
  if (!wrong) {
    throw new Error('错题记录不存在');
  }

  wrong.mastered = true;
  await saveFillBlankWrongAnswer(wrong);
}

/**
 * 取消标记填空题错题为已掌握
 */
export async function unmarkFillBlankWrongAsMastered(id: string): Promise<void> {
  const allWrong = await getAllWrong();
  const wrong = allWrong.find((w: FillBlankWrongAnswer) => w.id === id);
  
  if (!wrong) {
    throw new Error('错题记录不存在');
  }

  wrong.mastered = false;
  wrong.lastWrongAt = new Date();
  await saveFillBlankWrongAnswer(wrong);
}

/**
 * 切换填空题错题掌握状态
 */
export async function toggleFillBlankWrongMastery(id: string): Promise<{ mastered: boolean }> {
  const allWrong = await getAllWrong();
  const wrong = allWrong.find((w: FillBlankWrongAnswer) => w.id === id);
  
  if (!wrong) {
    throw new Error('错题记录不存在');
  }

  wrong.mastered = !wrong.mastered;
  if (!wrong.mastered) {
    wrong.lastWrongAt = new Date();
  }
  
  await saveFillBlankWrongAnswer(wrong);
  return { mastered: wrong.mastered };
}

/**
 * 获取所有填空题错题
 */
export async function getAllFillBlankWrongAnswersList(): Promise<FillBlankWrongAnswer[]> {
  return getAllWrong();
}

/**
 * 根据分类获取填空题错题
 */
export async function getFillBlankWrongAnswersByCategory(category: string): Promise<FillBlankWrongAnswer[]> {
  return getWrongByCategory(category);
}

/**
 * 获取未掌握的填空题错题
 */
export async function getUnmasteredFillBlankWrongAnswersList(): Promise<FillBlankWrongAnswer[]> {
  return getUnmasteredWrong();
}

/**
 * 获取需要复习的填空题错题
 */
export async function getFillBlankWrongAnswersForReview(category?: string): Promise<FillBlankWrongAnswer[]> {
  let wrongAnswers: FillBlankWrongAnswer[];
  
  if (category) {
    wrongAnswers = await getWrongByCategory(category);
  } else {
    wrongAnswers = await getAllWrong();
  }
  
  // 只返回未掌握的错题，按最近错误时间排序
  return wrongAnswers
    .filter((w: FillBlankWrongAnswer) => !w.mastered)
    .sort((a, b) => new Date(b.lastWrongAt).getTime() - new Date(a.lastWrongAt).getTime());
}

/**
 * 添加错题笔记
 */
export async function addFillBlankWrongAnswerNote(id: string, notes: string): Promise<void> {
  const allWrong = await getAllWrong();
  const wrong = allWrong.find((w: FillBlankWrongAnswer) => w.id === id);
  
  if (!wrong) {
    throw new Error('错题记录不存在');
  }

  wrong.notes = notes;
  await saveFillBlankWrongAnswer(wrong);
}

/**
 * 获取填空题错题统计
 */
export async function getFillBlankWrongAnswerStats(): Promise<Array<{ category: string; totalCount: number; masteredCount: number; unmasteredCount: number }>> {
  const allWrong = await getAllWrong();
  const statsMap = new Map<string, { totalCount: number; masteredCount: number; unmasteredCount: number }>();
  
  allWrong.forEach((wrong: FillBlankWrongAnswer) => {
    const existing = statsMap.get(wrong.category) || { totalCount: 0, masteredCount: 0, unmasteredCount: 0 };
    existing.totalCount += 1;
    if (wrong.mastered) {
      existing.masteredCount += 1;
    } else {
      existing.unmasteredCount += 1;
    }
    statsMap.set(wrong.category, existing);
  });
  
  return Array.from(statsMap.entries()).map(([category, stats]) => ({
    category,
    ...stats,
  }));
}

/**
 * 搜索填空题错题
 */
export async function searchFillBlankWrongAnswers(query: string): Promise<FillBlankWrongAnswer[]> {
  const allWrong = await getAllWrong();
  const lowerQuery = query.toLowerCase();
  
  return allWrong.filter((wrong: FillBlankWrongAnswer) => 
    wrong.fillBlankItem.question.toLowerCase().includes(lowerQuery) ||
    wrong.fillBlankItem.answer.toLowerCase().includes(lowerQuery) ||
    wrong.userAnswer.toLowerCase().includes(lowerQuery) ||
    wrong.correctAnswer.toLowerCase().includes(lowerQuery) ||
    (wrong.notes && wrong.notes.toLowerCase().includes(lowerQuery))
  );
}

/**
 * 批量添加填空题错题
 */
export async function addFillBlankWrongAnswersFromItems(
  items: Array<{ fillBlankItem: FillBlankItem; userAnswer: string; category?: string; hints?: string[] }>
): Promise<FillBlankWrongAnswer[]> {
  const results: FillBlankWrongAnswer[] = [];
  
  for (const item of items) {
    try {
      const wrong = await addFillBlankWrongAnswer(
        item.fillBlankItem,
        item.userAnswer,
        item.category || 'general',
        item.hints
      );
      results.push(wrong);
    } catch (error) {
      console.error(`添加填空题错题失败: ${item.fillBlankItem.id}`, error);
    }
  }
  
  return results;
}

/**
 * 从填空题收藏添加错题
 */
export async function addFillBlankWrongAnswersFromFavorites(
  favorites: Array<{ fillBlankItem: FillBlankItem; category?: string }>,
  userAnswer: string = ''
): Promise<FillBlankWrongAnswer[]> {
  const results: FillBlankWrongAnswer[] = [];
  
  for (const favorite of favorites) {
    try {
      const wrong = await addFillBlankWrongAnswer(
        favorite.fillBlankItem,
        userAnswer,
        favorite.category || 'general'
      );
      results.push(wrong);
    } catch (error) {
      console.error(`从收藏添加填空题错题失败: ${favorite.fillBlankItem.id}`, error);
    }
  }
  
  return results;
}

/**
 * 清空已掌握的填空题错题
 */
export async function clearMasteredFillBlankWrongAnswers(): Promise<number> {
  const allWrong = await getAllWrong();
  const mastered = allWrong.filter((w: FillBlankWrongAnswer) => w.mastered);
  
  for (const wrong of mastered) {
    await deleteFillBlankWrongAnswer(wrong.id);
  }
  
  return mastered.length;
}
