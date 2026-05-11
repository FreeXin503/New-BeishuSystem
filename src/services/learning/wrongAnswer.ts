/**
 * 错题本服务
 */

import type { Question, WrongAnswer, WrongAnswerStats } from '../../types';
import {
  getAllWrongAnswers,
  getWrongAnswerById,
  saveWrongAnswer,
  deleteWrongAnswer,
  getWrongAnswerByQuestionId,
  getWrongAnswersByCategory,
  getUnmasteredWrongAnswers,
} from '../storage/indexedDB';

async function resolveWrongAnswer(identifier: string): Promise<WrongAnswer | null> {
  // 兼容旧调用：优先按 wrongAnswer.id 查，再按 questionId 回退
  const byId = await getWrongAnswerById(identifier);
  if (byId) return byId;
  return getWrongAnswerByQuestionId(identifier);
}

/**
 * 添加错题到错题本
 */
export async function addWrongAnswer(
  question: Question,
  userAnswer: string,
  archiveId: string,
  category: string,
  tags: string[] = []
): Promise<WrongAnswer> {
  // 检查是否已存在该错题
  const existing = await getWrongAnswerByQuestionId(question.id);
  
  if (existing) {
    // 更新错误次数
    const updated: WrongAnswer = {
      ...existing,
      wrongCount: existing.wrongCount + 1,
      lastWrongAt: new Date(),
      userAnswer,
      mastered: false, // 再次答错，重置掌握状态
      updatedAt: new Date(),
    };
    await saveWrongAnswer(updated);
    return updated;
  }
  
  // 创建新错题记录
  const wrongAnswer: WrongAnswer = {
    id: `wrong-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    questionId: question.id,
    archiveId,
    question,
    userAnswer,
    wrongCount: 1,
    lastWrongAt: new Date(),
    category,
    tags,
    mastered: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  await saveWrongAnswer(wrongAnswer);
  return wrongAnswer;
}

/**
 * 批量添加错题
 */
export async function addWrongAnswers(
  wrongItems: Array<{
    question: Question;
    userAnswer: string;
  }>,
  archiveId: string,
  category: string,
  tags: string[] = []
): Promise<WrongAnswer[]> {
  const results: WrongAnswer[] = [];
  
  // 并行处理所有错题，提高性能
  const promises = wrongItems.map(async (item) => {
    return await addWrongAnswer(
      item.question,
      item.userAnswer,
      archiveId,
      category,
      tags
    );
  });
  
  // 等待所有错题保存完成
  const savedResults = await Promise.all(promises);
  results.push(...savedResults);
  
  return results;
}

/**
 * 标记错题为已掌握
 */
export async function markAsMastered(wrongAnswerId: string): Promise<void> {
  const wrongAnswer = await resolveWrongAnswer(wrongAnswerId);
  if (!wrongAnswer) return;
  
  const updated: WrongAnswer = {
    ...wrongAnswer,
    mastered: true,
    updatedAt: new Date(),
  };
  
  await saveWrongAnswer(updated);
}

/**
 * 取消掌握标记
 */
export async function unmarkMastered(wrongAnswerId: string): Promise<void> {
  const wrongAnswer = await resolveWrongAnswer(wrongAnswerId);
  if (!wrongAnswer) return;
  
  const updated: WrongAnswer = {
    ...wrongAnswer,
    mastered: false,
    updatedAt: new Date(),
  };
  
  await saveWrongAnswer(updated);
}

/**
 * 添加笔记
 */
export async function addNote(wrongAnswerId: string, notes: string): Promise<void> {
  const wrongAnswer = await resolveWrongAnswer(wrongAnswerId);
  if (!wrongAnswer) return;
  
  const updated: WrongAnswer = {
    ...wrongAnswer,
    notes,
    updatedAt: new Date(),
  };
  
  await saveWrongAnswer(updated);
}

/**
 * 获取错题统计
 */
export async function getWrongAnswerStats(): Promise<WrongAnswerStats[]> {
  const allWrong = await getAllWrongAnswers();
  
  // 按分类统计
  const statsMap = new Map<string, WrongAnswerStats>();
  
  for (const wrong of allWrong) {
    const category = wrong.category || '未分类';
    
    if (!statsMap.has(category)) {
      statsMap.set(category, {
        category,
        totalCount: 0,
        masteredCount: 0,
        unmasteredCount: 0,
      });
    }
    
    const stats = statsMap.get(category)!;
    stats.totalCount++;
    if (wrong.mastered) {
      stats.masteredCount++;
    } else {
      stats.unmasteredCount++;
    }
  }
  
  return Array.from(statsMap.values()).sort((a, b) => b.totalCount - a.totalCount);
}

/**
 * 获取待复习的错题（未掌握的）
 */
export async function getWrongAnswersForReview(
  category?: string,
  limit?: number
): Promise<WrongAnswer[]> {
  let wrongAnswers: WrongAnswer[];
  
  if (category) {
    const all = await getWrongAnswersByCategory(category);
    wrongAnswers = all.filter(w => !w.mastered);
  } else {
    wrongAnswers = await getUnmasteredWrongAnswers();
  }
  
  // 按错误次数和最后错误时间排序
  wrongAnswers.sort((a, b) => {
    // 优先显示错误次数多的
    if (b.wrongCount !== a.wrongCount) {
      return b.wrongCount - a.wrongCount;
    }
    // 其次按最后错误时间排序
    const aTime = a.lastWrongAt ? new Date(a.lastWrongAt).getTime() : 0;
    const bTime = b.lastWrongAt ? new Date(b.lastWrongAt).getTime() : 0;
    return bTime - aTime;
  });
  
  if (limit) {
    return wrongAnswers.slice(0, limit);
  }
  
  return wrongAnswers;
}

/**
 * 删除错题
 */
export async function removeWrongAnswer(id: string): Promise<void> {
  await deleteWrongAnswer(id);
}

/**
 * 清空某分类的已掌握错题
 */
export async function clearMasteredByCategory(category: string): Promise<number> {
  const wrongAnswers = await getWrongAnswersByCategory(category);
  const mastered = wrongAnswers.filter(w => w.mastered);
  
  for (const wrong of mastered) {
    await deleteWrongAnswer(wrong.id);
  }
  
  return mastered.length;
}

/**
 * 预设分类列表
 */
export const DEFAULT_QUIZ_CATEGORIES = [
  { value: 'mayuan', label: '马克思主义基本原理' },
  { value: 'maogai', label: '毛泽东思想和中国特色社会主义理论体系概论' },
  { value: 'sixiu', label: '思想道德与法治' },
  { value: 'jinshi', label: '中国近现代史纲要' },
  { value: 'xijinping', label: '习近平新时代中国特色社会主义思想概论' },
  { value: 'shishi', label: '形势与政策' },
  { value: 'other', label: '其他' },
];

// 兼容旧代码
export const QUIZ_CATEGORIES = DEFAULT_QUIZ_CATEGORIES;

/**
 * 获取分类标签（支持自定义分类）
 */
export function getCategoryLabel(value: string, customCategories: Array<{value: string; label: string}> = []): string {
  // 先从预设分类查找
  const preset = DEFAULT_QUIZ_CATEGORIES.find(c => c.value === value);
  if (preset) return preset.label;
  
  // 再从自定义分类查找
  const custom = customCategories.find(c => c.value === value);
  if (custom) return custom.label;
  
  return value;
}
