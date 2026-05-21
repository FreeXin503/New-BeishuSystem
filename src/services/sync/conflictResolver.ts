/**
 * 冲突解决服务
 * 基于时间戳的冲突解决策略
 */

import type { ParsedContent, ReviewCard, StudySession } from '../../types';

// 冲突解决策略
export type ConflictStrategy = 'local-wins' | 'remote-wins' | 'latest-wins' | 'lww' | 'merge';

// 冲突项
export interface ConflictItem<T> {
  local: T;
  remote: T;
  type: 'content' | 'card' | 'session';
}

// 解决结果
export interface ResolvedItem<T> {
  resolved: T;
  source: 'local' | 'remote' | 'merged';
}

/**
 * 获取时间戳 (大厂标准 LWW 属性审计支持)
 */
function getTimestamp(item: any): number {
  if (!item) return 0;
  
  // 按照优先级顺序审计时间戳属性，支持各种实体类型
  const timestampFields = [
    'updatedAt',
    'lastPracticedAt',
    'lastReviewDate',
    'endedAt',
    'createdAt',
    'timestamp'
  ];
  
  for (const field of timestampFields) {
    if (field in item && item[field]) {
      const parsed = new Date(item[field]).getTime();
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }
  
  return 0;
}

/**
 * 解决内容冲突
 */
export function resolveContentConflict(
  local: ParsedContent,
  remote: ParsedContent,
  strategy: ConflictStrategy = 'latest-wins'
): ResolvedItem<ParsedContent> {
  switch (strategy) {
    case 'local-wins':
      return { resolved: local, source: 'local' };
    
    case 'remote-wins':
      return { resolved: remote, source: 'remote' };
    
    case 'lww':
    case 'latest-wins': {
      const localTime = getTimestamp(local);
      const remoteTime = getTimestamp(remote);
      
      if (localTime >= remoteTime) {
        return { resolved: local, source: 'local' };
      } else {
        return { resolved: remote, source: 'remote' };
      }
    }
    
    case 'merge': {
      // 合并策略：合并章节，保留最新的关键词和概念
      const localTime = getTimestamp(local);
      const remoteTime = getTimestamp(remote);
      
      // 合并章节（去重）
      const chapterMap = new Map<string, typeof local.chapters[0]>();
      [...remote.chapters, ...local.chapters].forEach(chapter => {
        chapterMap.set(chapter.id, chapter);
      });
      
      // 合并关键词（去重）
      const keywordMap = new Map<string, typeof local.keywords[0]>();
      [...remote.keywords, ...local.keywords].forEach(keyword => {
        keywordMap.set(keyword.term, keyword);
      });
      
      // 合并概念（去重）
      const conceptMap = new Map<string, typeof local.concepts[0]>();
      [...remote.concepts, ...local.concepts].forEach(concept => {
        conceptMap.set(concept.name, concept);
      });
      
      const merged: ParsedContent = {
        id: local.id,
        title: localTime >= remoteTime ? local.title : remote.title,
        chapters: Array.from(chapterMap.values()).sort((a, b) => a.order - b.order),
        keywords: Array.from(keywordMap.values()),
        concepts: Array.from(conceptMap.values()),
        createdAt: new Date(Math.min(
          new Date(local.createdAt).getTime(),
          new Date(remote.createdAt).getTime()
        )),
        updatedAt: new Date(),
      };
      
      return { resolved: merged, source: 'merged' };
    }
    
    default:
      return { resolved: local, source: 'local' };
  }
}

/**
 * 解决复习卡片冲突
 */
export function resolveCardConflict(
  local: ReviewCard,
  remote: ReviewCard,
  strategy: ConflictStrategy = 'latest-wins'
): ResolvedItem<ReviewCard> {
  switch (strategy) {
    case 'local-wins':
      return { resolved: local, source: 'local' };
    
    case 'remote-wins':
      return { resolved: remote, source: 'remote' };
    
    case 'lww':
    case 'latest-wins': {
      const localTime = getTimestamp(local);
      const remoteTime = getTimestamp(remote);
      
      if (localTime >= remoteTime) {
        return { resolved: local, source: 'local' };
      } else {
        return { resolved: remote, source: 'remote' };
      }
    }
    
    case 'merge': {
      // 对于复习卡片，合并策略选择复习次数更多的版本
      // 因为这代表更多的学习进度
      if (local.repetitions >= remote.repetitions) {
        return { resolved: local, source: 'local' };
      } else {
        return { resolved: remote, source: 'remote' };
      }
    }
    
    default:
      return { resolved: local, source: 'local' };
  }
}

/**
 * 解决学习会话冲突
 */
export function resolveSessionConflict(
  local: StudySession,
  remote: StudySession,
  strategy: ConflictStrategy = 'latest-wins'
): ResolvedItem<StudySession> {
  switch (strategy) {
    case 'local-wins':
      return { resolved: local, source: 'local' };
    
    case 'remote-wins':
      return { resolved: remote, source: 'remote' };
    
    case 'lww':
    case 'latest-wins': {
      const localTime = getTimestamp(local);
      const remoteTime = getTimestamp(remote);
      
      if (localTime >= remoteTime) {
        return { resolved: local, source: 'local' };
      } else {
        return { resolved: remote, source: 'remote' };
      }
    }
    
    case 'merge': {
      // 对于学习会话，合并策略选择学习时间更长的版本
      if (local.duration >= remote.duration) {
        return { resolved: local, source: 'local' };
      } else {
        return { resolved: remote, source: 'remote' };
      }
    }
    
    default:
      return { resolved: local, source: 'local' };
  }
}

/**
 * 批量解决冲突
 */
export function resolveConflicts<T extends ParsedContent | ReviewCard | StudySession>(
  conflicts: ConflictItem<T>[],
  strategy: ConflictStrategy = 'latest-wins'
): ResolvedItem<T>[] {
  return conflicts.map(conflict => {
    switch (conflict.type) {
      case 'content':
        return resolveContentConflict(
          conflict.local as ParsedContent,
          conflict.remote as ParsedContent,
          strategy
        ) as ResolvedItem<T>;
      
      case 'card':
        return resolveCardConflict(
          conflict.local as ReviewCard,
          conflict.remote as ReviewCard,
          strategy
        ) as ResolvedItem<T>;
      
      case 'session':
        return resolveSessionConflict(
          conflict.local as StudySession,
          conflict.remote as StudySession,
          strategy
        ) as ResolvedItem<T>;
      
      default:
        return { resolved: conflict.local, source: 'local' as const };
    }
  });
}

/**
 * 检测冲突
 */
export function detectConflict<T extends { id: string }>(
  localItems: T[],
  remoteItems: T[]
): { conflicts: Array<{ local: T; remote: T }>; localOnly: T[]; remoteOnly: T[] } {
  const localMap = new Map(localItems.map(item => [item.id, item]));
  const remoteMap = new Map(remoteItems.map(item => [item.id, item]));
  
  const conflicts: Array<{ local: T; remote: T }> = [];
  const localOnly: T[] = [];
  const remoteOnly: T[] = [];
  
  // 检查本地项
  for (const [id, local] of localMap) {
    const remote = remoteMap.get(id);
    if (remote) {
      // 两边都有，可能是冲突
      conflicts.push({ local, remote });
    } else {
      // 只有本地有
      localOnly.push(local);
    }
  }
  
  // 检查只有远程有的项
  for (const [id, remote] of remoteMap) {
    if (!localMap.has(id)) {
      remoteOnly.push(remote);
    }
  }
  
  return { conflicts, localOnly, remoteOnly };
}
