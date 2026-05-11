/**
 * 题库存档服务
 */

import type { Question, QuizArchive } from '../../types';
import {
  getAllQuizArchives,
  getQuizArchiveById,
  saveQuizArchive,
  deleteQuizArchive,
  getQuizArchivesByCategory,
} from '../storage/indexedDB';

/**
 * 创建新题库
 */
export async function createQuizArchive(
  title: string,
  questions: Question[],
  category: string,
  description?: string,
  tags: string[] = []
): Promise<QuizArchive> {
  const archive: QuizArchive = {
    id: `archive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    description,
    questions,
    category,
    tags,
    totalCount: questions.length,
    practiceCount: 0,
    bestScore: 0,
    lastPracticeAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  await saveQuizArchive(archive);
  return archive;
}

/**
 * 更新题库练习记录
 */
export async function updatePracticeRecord(
  archiveId: string,
  score: number
): Promise<void> {
  const archive = await getQuizArchiveById(archiveId);
  if (!archive) return;
  
  const updated: QuizArchive = {
    ...archive,
    practiceCount: archive.practiceCount + 1,
    bestScore: Math.max(archive.bestScore, score),
    lastPracticeAt: new Date(),
    updatedAt: new Date(),
  };
  
  await saveQuizArchive(updated);
}

/**
 * 获取所有题库
 */
export async function getArchives(): Promise<QuizArchive[]> {
  const archives = await getAllQuizArchives();
  // 按最后练习时间和创建时间排序
  return archives.sort((a, b) => {
    const aTime = a.lastPracticeAt ? new Date(a.lastPracticeAt).getTime() : 0;
    const bTime = b.lastPracticeAt ? new Date(b.lastPracticeAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bCreated - aCreated;
  });
}

/**
 * 获取单个题库
 */
export async function getArchive(id: string): Promise<QuizArchive | null> {
  return getQuizArchiveById(id);
}

/**
 * 按分类获取题库
 */
export async function getArchivesByCategory(category: string): Promise<QuizArchive[]> {
  return getQuizArchivesByCategory(category);
}

/**
 * 删除题库
 */
export async function removeArchive(id: string): Promise<void> {
  await deleteQuizArchive(id);
}

/**
 * 更新题库信息
 */
export async function updateArchive(
  id: string,
  updates: Partial<Pick<QuizArchive, 'title' | 'description' | 'category' | 'tags'>>
): Promise<void> {
  const archive = await getQuizArchiveById(id);
  if (!archive) return;
  
  const updated: QuizArchive = {
    ...archive,
    ...updates,
    updatedAt: new Date(),
  };
  
  await saveQuizArchive(updated);
}

/**
 * 向题库添加题目
 */
export async function addQuestionsToArchive(
  archiveId: string,
  questions: Question[]
): Promise<void> {
  const archive = await getQuizArchiveById(archiveId);
  if (!archive) return;
  
  const updated: QuizArchive = {
    ...archive,
    questions: [...archive.questions, ...questions],
    totalCount: archive.questions.length + questions.length,
    updatedAt: new Date(),
  };
  
  await saveQuizArchive(updated);
}

/**
 * 从题库删除题目
 */
export async function removeQuestionFromArchive(
  archiveId: string,
  questionId: string
): Promise<void> {
  const archive = await getQuizArchiveById(archiveId);
  if (!archive) return;
  
  const updated: QuizArchive = {
    ...archive,
    questions: archive.questions.filter(q => q.id !== questionId),
    totalCount: archive.questions.length - 1,
    updatedAt: new Date(),
  };
  
  await saveQuizArchive(updated);
}

/**
 * 获取题库统计
 */
export async function getArchiveStats(): Promise<{
  totalArchives: number;
  totalQuestions: number;
  totalPractices: number;
  categoryStats: Array<{ category: string; count: number }>;
}> {
  const archives = await getAllQuizArchives();
  
  const categoryMap = new Map<string, number>();
  let totalQuestions = 0;
  let totalPractices = 0;
  
  for (const archive of archives) {
    totalQuestions += archive.totalCount;
    totalPractices += archive.practiceCount;
    
    const count = categoryMap.get(archive.category) || 0;
    categoryMap.set(archive.category, count + 1);
  }
  
  const categoryStats = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  
  return {
    totalArchives: archives.length,
    totalQuestions,
    totalPractices,
    categoryStats,
  };
}
