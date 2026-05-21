/**
 * SynoMaster 模块领域实体
 */

import { PracticeMode } from './SpellingEntity';

// Re-export
export { PracticeMode };

// ==================== 强枚举 ====================

/** 词组类型 */
export enum WordClusterType {
  Synonym = 'synonym',
  LogicCause = 'logic_cause',
  LogicEffect = 'logic_effect',
  AttitudePositive = 'attitude_positive',
  AttitudeNegative = 'attitude_negative',
  AttitudeNeutral = 'attitude_neutral',
}

// ==================== 领域实体 ====================

/** 词组聚类实体 */
export interface WordClusterEntity {
  readonly id: string;
  readonly group: readonly string[];
  readonly meaning: string;
  readonly category: string;
  readonly type: WordClusterType;
}

/** 词组数据仓库实体 */
export interface WordDataRepoEntity {
  readonly synonymRepo: readonly WordClusterEntity[];
  readonly logicRepo: readonly WordClusterEntity[];
  readonly attitudeRepo: readonly WordClusterEntity[];
}

/** SynoMaster 进度实体 */
export interface SynoProgressEntity {
  readonly id: string;
  readonly mode: PracticeMode;
  readonly currentIndex: number;
  readonly totalItems: number;
  readonly completedCount: number;
  readonly lastPracticedAt: Date;
}
