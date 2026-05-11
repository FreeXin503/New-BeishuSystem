/**
 * 数据迁移服务
 * 本地模式：游客数据迁移到注册用户
 */

import { exportGuestData, clearAllGuestData } from '../storage/guestMode';

export interface MigrationResult {
  success: boolean;
  migratedItems: {
    contents: number;
    cards: number;
    sessions: number;
    settings: boolean;
  };
  errors: string[];
}

/**
 * 将游客数据迁移到注册用户（本地模式）
 */
export async function migrateGuestDataToUser(_userId: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migratedItems: {
      contents: 0,
      cards: 0,
      sessions: 0,
      settings: false,
    },
    errors: [],
  };

  try {
    // 导出游客数据
    const guestData = await exportGuestData();

    // 本地模式：数据已经在 IndexedDB 中，无需迁移
    // 只需要更新用户关联（如果需要的话）
    
    result.migratedItems.contents = guestData.contents.length;
    result.migratedItems.cards = guestData.reviewCards.length;
    result.migratedItems.sessions = guestData.sessions.length;
    result.migratedItems.settings = guestData.settings !== null;

    // 清除游客标记
    await clearAllGuestData();

    result.success = true;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : '迁移失败');
  }

  return result;
}

/**
 * 检查是否有游客数据需要迁移
 */
export async function hasGuestDataToMigrate(): Promise<boolean> {
  const guestData = await exportGuestData();
  return (
    guestData.contents.length > 0 ||
    guestData.reviewCards.length > 0 ||
    guestData.sessions.length > 0
  );
}

/**
 * 获取游客数据统计
 */
export async function getGuestDataStats(): Promise<{
  contents: number;
  cards: number;
  sessions: number;
}> {
  const guestData = await exportGuestData();
  return {
    contents: guestData.contents.length,
    cards: guestData.reviewCards.length,
    sessions: guestData.sessions.length,
  };
}
