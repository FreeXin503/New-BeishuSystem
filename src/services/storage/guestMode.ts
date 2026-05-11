/**
 * 游客模式服务
 * 管理游客用户的本地数据存储
 */

import type { User, ParsedContent, ReviewCard, StudySession, UserSettings, LearningProgress } from '../../types';
import * as db from './indexedDB';

const GUEST_USER_KEY = 'guest-user';

/**
 * 创建游客用户
 */
export function createGuestUser(): User {
  const guestUser: User = {
    id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    email: '',
    isGuest: true,
    createdAt: new Date(),
  };
  
  // 保存到 localStorage
  localStorage.setItem(GUEST_USER_KEY, JSON.stringify(guestUser));
  
  return guestUser;
}

/**
 * 获取游客用户
 */
export function getGuestUser(): User | null {
  const stored = localStorage.getItem(GUEST_USER_KEY);
  if (!stored) return null;
  
  try {
    const user = JSON.parse(stored);
    return {
      ...user,
      createdAt: new Date(user.createdAt),
    };
  } catch {
    return null;
  }
}

/**
 * 获取或创建游客用户
 */
export function getOrCreateGuestUser(): User {
  const existing = getGuestUser();
  if (existing) return existing;
  return createGuestUser();
}

/**
 * 清除游客用户
 */
export function clearGuestUser(): void {
  localStorage.removeItem(GUEST_USER_KEY);
}

/**
 * 检查是否为游客模式
 */
export function isGuestMode(): boolean {
  const user = getGuestUser();
  return user !== null && user.isGuest;
}

// ==================== 内容管理 ====================

/**
 * 保存学习内容（游客模式）
 */
export async function saveGuestContent(content: ParsedContent): Promise<void> {
  await db.saveContent(content);
}

/**
 * 获取所有学习内容（游客模式）
 */
export async function getGuestContents(): Promise<ParsedContent[]> {
  return db.getAllContents();
}

/**
 * 获取单个内容（游客模式）
 */
export async function getGuestContentById(id: string): Promise<ParsedContent | null> {
  return db.getContentById(id);
}

/**
 * 删除内容（游客模式）
 */
export async function deleteGuestContent(id: string): Promise<void> {
  await db.deleteContent(id);
  // 同时删除相关的复习卡片
  const cards = await db.getReviewCardsByContentId(id);
  for (const card of cards) {
    await db.deleteReviewCard(card.id);
  }
}

// ==================== 复习卡片管理 ====================

/**
 * 保存复习卡片（游客模式）
 */
export async function saveGuestReviewCard(card: ReviewCard): Promise<void> {
  await db.saveReviewCard(card);
}

/**
 * 获取所有复习卡片（游客模式）
 */
export async function getGuestReviewCards(): Promise<ReviewCard[]> {
  return db.getAllReviewCards();
}

/**
 * 获取单个复习卡片（游客模式）
 */
export async function getGuestReviewCardById(id: string): Promise<ReviewCard | null> {
  return db.getReviewCardById(id);
}

/**
 * 获取待复习卡片（游客模式）
 */
export async function getGuestDueCards(): Promise<ReviewCard[]> {
  const cards = await db.getAllReviewCards();
  const now = new Date();
  return cards.filter(card => new Date(card.nextReviewDate) <= now);
}

/**
 * 删除复习卡片（游客模式）
 */
export async function deleteGuestReviewCard(id: string): Promise<void> {
  await db.deleteReviewCard(id);
}

// ==================== 学习会话管理 ====================

/**
 * 保存学习会话（游客模式）
 */
export async function saveGuestStudySession(session: StudySession): Promise<void> {
  await db.saveStudySession(session);
}

/**
 * 获取所有学习会话（游客模式）
 */
export async function getGuestStudySessions(): Promise<StudySession[]> {
  return db.getAllStudySessions();
}

// ==================== 设置管理 ====================

/**
 * 保存用户设置（游客模式）
 */
export async function saveGuestSettings(settings: UserSettings): Promise<void> {
  await db.saveSettings(settings);
}

/**
 * 获取用户设置（游客模式）
 */
export async function getGuestSettings(): Promise<UserSettings | null> {
  return db.getSettings();
}

/**
 * 获取默认设置
 */
export function getDefaultSettings(): UserSettings {
  return {
    theme: 'light',
    speechRate: 1.0,
    dailyGoal: 30,
    notificationsEnabled: true,
  };
}

// ==================== 学习进度 ====================

/**
 * 获取游客学习进度
 */
export async function getGuestLearningProgress(): Promise<LearningProgress> {
  const user = getGuestUser();
  const sessions = await db.getAllStudySessions();
  const cards = await db.getAllReviewCards();
  const contents = await db.getAllContents();
  
  // 计算总学习时间
  const totalStudyTime = sessions.reduce((sum, s) => sum + s.duration, 0);
  
  // 计算每个内容的进度
  const contentProgress = contents.map(content => {
    const contentCards = cards.filter(c => c.contentId === content.id);
    const contentSessions = sessions.filter(s => s.contentId === content.id);
    
    // 计算掌握度（基于复习卡片的 easeFactor）
    const avgEaseFactor = contentCards.length > 0
      ? contentCards.reduce((sum, c) => sum + c.easeFactor, 0) / contentCards.length
      : 2.5;
    const masteryLevel = Math.min(100, Math.round((avgEaseFactor - 1.3) / (2.5 - 1.3) * 100));
    
    // 获取最后学习时间
    const lastSession = contentSessions.sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )[0];
    
    // 获取已完成的学习模式
    const completedModes = [...new Set(contentSessions.map(s => s.mode))];
    
    return {
      contentId: content.id,
      masteryLevel,
      lastStudiedAt: lastSession ? new Date(lastSession.startedAt) : new Date(),
      completedModes,
    };
  });
  
  return {
    userId: user?.id || 'guest',
    totalStudyTime,
    contentProgress,
    reviewCards: cards,
    lastSyncAt: new Date(),
  };
}

// ==================== 数据导出/导入 ====================

/**
 * 导出游客数据（用于迁移到云端）
 */
export async function exportGuestData(): Promise<{
  user: User | null;
  contents: ParsedContent[];
  reviewCards: ReviewCard[];
  sessions: StudySession[];
  settings: UserSettings | null;
}> {
  const [user, contents, reviewCards, sessions, settings] = await Promise.all([
    Promise.resolve(getGuestUser()),
    db.getAllContents(),
    db.getAllReviewCards(),
    db.getAllStudySessions(),
    db.getSettings(),
  ]);
  
  return { user, contents, reviewCards, sessions, settings };
}

/**
 * 清除所有游客数据
 */
export async function clearAllGuestData(): Promise<void> {
  clearGuestUser();
  await db.clearAllData();
}

/**
 * 检查是否有游客数据
 */
export async function hasGuestData(): Promise<boolean> {
  const contents = await db.getAllContents();
  const cards = await db.getAllReviewCards();
  return contents.length > 0 || cards.length > 0;
}
