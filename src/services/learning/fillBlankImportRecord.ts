/**
 * 填空题导入记录服务
 */

import type { FillBlankImportRecord, FillBlankItem } from '../../types';
import {
  saveFillBlankImportRecord,
  getAllFillBlankImportRecords,
  getFillBlankImportRecord,
  deleteFillBlankImportRecord,
} from '../storage/indexedDB';

/**
 * 创建导入记录
 */
export async function createImportRecord(
  name: string,
  items: FillBlankItem[],
  description?: string
): Promise<FillBlankImportRecord> {
  const now = new Date();
  
  // 统计所有标签
  const allTags = new Set<string>();
  const categories = new Set<string>();
  
  items.forEach(item => {
    if (item.category) {
      categories.add(item.category);
    }
    item.tags.forEach((tag: string) => allTags.add(tag));
  });

  const record: FillBlankImportRecord = {
    id: `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    itemCount: items.length,
    category: categories.size > 0 ? Array.from(categories)[0] : undefined,
    tags: Array.from(allTags),
    createdAt: now,
    updatedAt: now,
  };

  await saveFillBlankImportRecord(record);
  return record;
}

/**
 * 获取所有导入记录
 */
export async function getAllImportRecords(): Promise<FillBlankImportRecord[]> {
  return await getAllFillBlankImportRecords();
}

/**
 * 获取单个导入记录
 */
export async function getImportRecord(id: string): Promise<FillBlankImportRecord | null> {
  return await getFillBlankImportRecord(id);
}

/**
 * 删除导入记录
 */
export async function deleteImportRecord(id: string): Promise<void> {
  await deleteFillBlankImportRecord(id);
}

/**
 * 更新导入记录
 */
export async function updateImportRecord(record: FillBlankImportRecord): Promise<void> {
  const updatedRecord = {
    ...record,
    updatedAt: new Date(),
  };
  await saveFillBlankImportRecord(updatedRecord);
}
