/**
 * SynoMaster 模块转换器
 * 
 * 处理 localStorage JSON ↔ WordClusterEntity 的转换。
 */

import type { WordClusterEntity, WordDataRepoEntity, SynoProgressEntity } from '../../domain/models';
import { WordClusterType, PracticeMode } from '../../domain/models';
import {
  safeParseDate,
  safeString,
  safeNumber,
  safeParseEnum,
  safeParseLocalStorage,
} from './hydrators';

/** localStorage 存储键 */
const STORAGE_KEYS = {
  SYNONYM: 'synomaster_synonym_data',
  LOGIC: 'synomaster_logic_data',
  ATTITUDE: 'synomaster_attitude_data',
} as const;

const ALL_CLUSTER_TYPES = [
  WordClusterType.Synonym,
  WordClusterType.LogicCause,
  WordClusterType.LogicEffect,
  WordClusterType.AttitudePositive,
  WordClusterType.AttitudeNegative,
  WordClusterType.AttitudeNeutral,
] as const;

export const SynoMasterTransformer = {
  // ——— WordCluster ———

  clusterToDomain(raw: unknown): WordClusterEntity {
    const r = (raw ?? {}) as Record<string, unknown>;

    return Object.freeze({
      id: safeString(r.id, `wc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      group: Object.freeze(
        Array.isArray(r.group)
          ? r.group.map(w => String(w ?? ''))
          : typeof r.group === 'string'
            ? [r.group]
            : []
      ),
      meaning: safeString(r.meaning) || safeString((r as any).meaning_cn),
      category: safeString(r.category) || safeString((r as any).category_name),
      type: safeParseEnum(r.type as string, [...ALL_CLUSTER_TYPES], WordClusterType.Synonym),
    });
  },

  clusterToDomainList(rows: unknown): WordClusterEntity[] {
    if (!Array.isArray(rows)) return [];
    return rows.map(row => SynoMasterTransformer.clusterToDomain(row));
  },

  clusterToPersistence(entity: WordClusterEntity): Record<string, unknown> {
    return {
      id: entity.id,
      group: [...entity.group],
      meaning: entity.meaning,
      category: entity.category,
      type: entity.type,
    };
  },

  // ——— WordDataRepo: localStorage → Domain ———

  /**
   * 从 localStorage 安全加载完整的词组数据仓库
   */
  loadRepoFromStorage(): WordDataRepoEntity {
    return Object.freeze({
      synonymRepo: Object.freeze(
        SynoMasterTransformer.clusterToDomainList(
          safeParseLocalStorage<unknown[]>(STORAGE_KEYS.SYNONYM, [])
        )
      ),
      logicRepo: Object.freeze(
        SynoMasterTransformer.clusterToDomainList(
          safeParseLocalStorage<unknown[]>(STORAGE_KEYS.LOGIC, [])
        )
      ),
      attitudeRepo: Object.freeze(
        SynoMasterTransformer.clusterToDomainList(
          safeParseLocalStorage<unknown[]>(STORAGE_KEYS.ATTITUDE, [])
        )
      ),
    });
  },

  /**
   * 将词组数据仓库保存到 localStorage
   */
  saveRepoToStorage(repo: WordDataRepoEntity): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.SYNONYM,
        JSON.stringify(repo.synonymRepo.map(SynoMasterTransformer.clusterToPersistence))
      );
      localStorage.setItem(
        STORAGE_KEYS.LOGIC,
        JSON.stringify(repo.logicRepo.map(SynoMasterTransformer.clusterToPersistence))
      );
      localStorage.setItem(
        STORAGE_KEYS.ATTITUDE,
        JSON.stringify(repo.attitudeRepo.map(SynoMasterTransformer.clusterToPersistence))
      );
    } catch (err) {
      console.error('[SynoMasterTransformer] Failed to save to localStorage:', err);
    }
  },

  // ——— Progress: API → Domain ———

  progressToDomain(raw: unknown): SynoProgressEntity | null {
    if (raw === null || raw === undefined) return null;
    const r = raw as Record<string, unknown>;

    return Object.freeze({
      id: safeString(r.id, `sp-${Date.now()}`),
      mode: safeParseEnum(r.mode as string, [PracticeMode.Practice, PracticeMode.Challenge], PracticeMode.Practice),
      currentIndex: safeNumber(r.currentIndex, 0),
      totalItems: safeNumber(r.totalItems, 0),
      completedCount: safeNumber(r.completedCount, 0),
      lastPracticedAt: safeParseDate(r.lastPracticedAt),
    });
  },

  /** 导出存储键（供 Repository 使用） */
  STORAGE_KEYS,
};
