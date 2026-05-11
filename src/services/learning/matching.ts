/**
 * 术语配对学习模式服务
 */

import type { MatchPair, ValidationResult } from '../../types';

/**
 * 验证单个配对
 */
export function validateMatch(
  termId: string,
  selectedDefinitionId: string,
  pairs: MatchPair[]
): ValidationResult {
  const pair = pairs.find((p) => p.id === termId);
  
  if (!pair) {
    return {
      isCorrect: false,
      correctAnswer: '',
      score: 0,
      explanation: '未找到对应的术语',
    };
  }

  const isCorrect = termId === selectedDefinitionId;

  return {
    isCorrect,
    correctAnswer: pair.definition,
    score: isCorrect ? 1 : 0,
    explanation: isCorrect ? '配对正确！' : `正确定义是：${pair.definition}`,
  };
}

/**
 * 验证所有配对
 */
export function validateAllMatches(
  userMatches: Map<string, string>, // termId -> definitionId
  pairs: MatchPair[]
): {
  results: Map<string, ValidationResult>;
  correctCount: number;
  totalCount: number;
  score: number;
} {
  const results = new Map<string, ValidationResult>();
  let correctCount = 0;

  for (const pair of pairs) {
    const selectedDefinitionId = userMatches.get(pair.id);
    const isCorrect = selectedDefinitionId === pair.id;

    results.set(pair.id, {
      isCorrect,
      correctAnswer: pair.definition,
      score: isCorrect ? 1 : 0,
    });

    if (isCorrect) {
      correctCount++;
    }
  }

  const totalCount = pairs.length;
  const score = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

  return {
    results,
    correctCount,
    totalCount,
    score: Math.round(score),
  };
}

/**
 * 打乱配对顺序（用于显示）
 */
export function shufflePairs(pairs: MatchPair[]): {
  terms: { id: string; term: string }[];
  definitions: { id: string; definition: string }[];
} {
  const terms = pairs.map((p) => ({ id: p.id, term: p.term }));
  const definitions = pairs.map((p) => ({ id: p.id, definition: p.definition }));

  // Fisher-Yates 洗牌
  for (let i = terms.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [terms[i], terms[j]] = [terms[j], terms[i]];
  }

  for (let i = definitions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [definitions[i], definitions[j]] = [definitions[j], definitions[i]];
  }

  return { terms, definitions };
}

/**
 * 检查配对是否完成
 */
export function isMatchingComplete(
  userMatches: Map<string, string>,
  pairs: MatchPair[]
): boolean {
  return userMatches.size === pairs.length;
}

/**
 * 获取未配对的术语
 */
export function getUnmatchedTerms(
  userMatches: Map<string, string>,
  pairs: MatchPair[]
): MatchPair[] {
  return pairs.filter((p) => !userMatches.has(p.id));
}

/**
 * 获取未配对的定义
 */
export function getUnmatchedDefinitions(
  userMatches: Map<string, string>,
  pairs: MatchPair[]
): MatchPair[] {
  const matchedDefinitionIds = new Set(userMatches.values());
  return pairs.filter((p) => !matchedDefinitionIds.has(p.id));
}

/**
 * 重置配对
 */
export function resetMatches(): Map<string, string> {
  return new Map();
}

/**
 * 添加配对
 */
export function addMatch(
  currentMatches: Map<string, string>,
  termId: string,
  definitionId: string
): Map<string, string> {
  const newMatches = new Map(currentMatches);
  newMatches.set(termId, definitionId);
  return newMatches;
}

/**
 * 移除配对
 */
export function removeMatch(
  currentMatches: Map<string, string>,
  termId: string
): Map<string, string> {
  const newMatches = new Map(currentMatches);
  newMatches.delete(termId);
  return newMatches;
}


import type { Keyword } from '../../types';

/**
 * 从关键词生成配对练习
 */
export function generateMatchingPairs(keywords: Keyword[]): MatchPair[] {
  if (!keywords || keywords.length === 0) {
    return [];
  }

  return keywords.map((keyword, index) => ({
    id: `pair-${Date.now()}-${index}`,
    term: keyword.term,
    definition: keyword.definition,
  }));
}
