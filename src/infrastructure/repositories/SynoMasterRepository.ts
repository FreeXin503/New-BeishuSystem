/**
 * SynoMaster 统一仓储
 * 
 * 封装 localStorage（词组数据）+ REST API（进度）的访问。
 */

import type {
  WordClusterEntity,
  WordDataRepoEntity,
  SynoProgressEntity,
} from '../../domain/models';
import { PracticeMode } from '../../domain/models';
import { SynoMasterTransformer } from '../transformers/SynoMasterTransformer';

const API_BASE = 'http://localhost:3001/api/synomaster';

/**
 * 安全 fetch 包装
 */
async function safeFetch<T>(
  url: string,
  options?: RequestInit,
  fallback?: T
): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      console.error(`[SynoMasterRepository] HTTP ${res.status}: ${url}`);
      return fallback as T;
    }
    return await res.json();
  } catch (err) {
    console.error(`[SynoMasterRepository] Network error: ${url}`, err);
    return fallback as T;
  }
}

export const SynoMasterRepository = {
  // ==================== Word Data (localStorage) ====================

  /**
   * 从 localStorage 加载词组数据仓库（已转换为领域实体）
   */
  loadWordData(): WordDataRepoEntity {
    return SynoMasterTransformer.loadRepoFromStorage();
  },

  /**
   * 保存词组数据仓库到 localStorage
   */
  saveWordData(repo: WordDataRepoEntity): void {
    SynoMasterTransformer.saveRepoToStorage(repo);
  },

  /**
   * 分发导入的原始数据 → 分类为 synonym/logic/attitude 仓库
   */
  dispatchImportData(rawData: unknown[]): WordDataRepoEntity {
    const clusters = SynoMasterTransformer.clusterToDomainList(rawData);

    const repo: WordDataRepoEntity = Object.freeze({
      synonymRepo: Object.freeze(
        clusters.filter(c =>
          c.type === 'synonym'
        )
      ),
      logicRepo: Object.freeze(
        clusters.filter(c =>
          c.type === 'logic_cause' || c.type === 'logic_effect'
        )
      ),
      attitudeRepo: Object.freeze(
        clusters.filter(c =>
          c.type === 'attitude_positive' ||
          c.type === 'attitude_negative' ||
          c.type === 'attitude_neutral'
        )
      ),
    });

    SynoMasterTransformer.saveRepoToStorage(repo);
    return repo;
  },

  /**
   * 清空所有词组数据
   */
  clearWordData(): void {
    const keys = SynoMasterTransformer.STORAGE_KEYS;
    try {
      localStorage.removeItem(keys.SYNONYM);
      localStorage.removeItem(keys.LOGIC);
      localStorage.removeItem(keys.ATTITUDE);
    } catch (err) {
      console.error('[SynoMasterRepository] clearWordData failed:', err);
    }
  },

  /**
   * 获取统计信息
   */
  getStatistics(repo: WordDataRepoEntity): {
    synonymCount: number;
    logicCount: number;
    attitudeCount: number;
    totalWords: number;
  } {
    const countWords = (clusters: readonly WordClusterEntity[]) =>
      clusters.reduce((sum, c) => sum + c.group.length, 0);

    return {
      synonymCount: repo.synonymRepo.length,
      logicCount: repo.logicRepo.length,
      attitudeCount: repo.attitudeRepo.length,
      totalWords:
        countWords(repo.synonymRepo) +
        countWords(repo.logicRepo) +
        countWords(repo.attitudeRepo),
    };
  },

  // ==================== Progress (REST API) ====================

  async getProgress(mode: PracticeMode): Promise<SynoProgressEntity | null> {
    const raw = await safeFetch<unknown>(`${API_BASE}/progress/${mode}`, undefined, null);
    return SynoMasterTransformer.progressToDomain(raw);
  },

  async saveProgress(data: {
    mode: PracticeMode;
    currentIndex: number;
    totalItems: number;
    completedCount: number;
  }): Promise<void> {
    await safeFetch(`${API_BASE}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async deleteProgress(mode: PracticeMode): Promise<void> {
    await safeFetch(`${API_BASE}/progress/${mode}`, { method: 'DELETE' });
  },
};
