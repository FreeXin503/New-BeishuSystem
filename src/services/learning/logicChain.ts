/**
 * 逻辑链生成服务
 */

import { callDeepSeekWithRetry, AIServiceError } from '../ai/deepseek';
import type { LogicChain, LogicNode, LogicConnection, ParsedContent } from '../../types';

const GENERATE_LOGIC_CHAIN_PROMPT = `你是一个政治学习助手，擅长将复杂的政治理论拆解成清晰的逻辑链。

请将以下内容拆解成逻辑链，包含：
1. 核心概念节点（concept）
2. 前提条件节点（premise）
3. 论据支撑节点（evidence）
4. 结论节点（conclusion）

以及它们之间的关系：
- leads-to: 导致/推导出
- supports: 支撑/证明
- explains: 解释/说明
- contrasts: 对比/区别

请返回 JSON 格式：
{
  "title": "逻辑链标题",
  "nodes": [
    { "id": "n1", "content": "节点内容", "type": "concept|premise|evidence|conclusion", "order": 1 }
  ],
  "connections": [
    { "id": "c1", "fromNodeId": "n1", "toNodeId": "n2", "relation": "leads-to|supports|explains|contrasts" }
  ]
}`;

/**
 * 安全解析 JSON
 */
function safeParseJSON<T>(text: string): T | null {
  try {
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    return JSON.parse(jsonStr.trim());
  } catch {
    return null;
  }
}

/**
 * 从内容生成逻辑链
 */
export async function generateLogicChain(content: string, contentId: string): Promise<LogicChain> {
  if (!content || content.trim().length === 0) {
    throw new AIServiceError('内容不能为空', 'PARSE_ERROR', false);
  }

  const response = await callDeepSeekWithRetry(content, GENERATE_LOGIC_CHAIN_PROMPT);

  interface ParsedLogicChain {
    title?: string;
    nodes?: Array<{
      id?: string;
      content?: string;
      type?: string;
      order?: number;
    }>;
    connections?: Array<{
      id?: string;
      fromNodeId?: string;
      toNodeId?: string;
      relation?: string;
    }>;
  }

  const parsed = safeParseJSON<ParsedLogicChain>(response);

  if (!parsed || !parsed.nodes || parsed.nodes.length === 0) {
    throw new AIServiceError('无法解析逻辑链响应', 'PARSE_ERROR', false);
  }

  const logicChain: LogicChain = {
    id: `logic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    contentId,
    title: parsed.title || '逻辑链',
    nodes: parsed.nodes.map((n, index): LogicNode => ({
      id: n.id || `n-${index + 1}`,
      content: n.content || '',
      type: (n.type as LogicNode['type']) || 'concept',
      order: n.order || index + 1,
    })),
    connections: (parsed.connections || []).map((c, index): LogicConnection => ({
      id: c.id || `c-${index + 1}`,
      fromNodeId: c.fromNodeId || '',
      toNodeId: c.toNodeId || '',
      relation: (c.relation as LogicConnection['relation']) || 'leads-to',
    })),
    createdAt: new Date(),
  };

  return logicChain;
}

/**
 * 从 ParsedContent 生成逻辑链
 */
export async function generateLogicChainFromContent(parsedContent: ParsedContent): Promise<LogicChain> {
  const text = parsedContent.chapters.map(c => `${c.title}\n${c.content}`).join('\n\n');
  return generateLogicChain(text, parsedContent.id);
}

/**
 * 验证逻辑链节点顺序
 */
export function validateLogicChainOrder(
  chain: LogicChain,
  userOrder: string[]
): { isCorrect: boolean; correctOrder: string[]; score: number } {
  const correctOrder = chain.nodes
    .sort((a, b) => a.order - b.order)
    .map(n => n.id);

  let correctCount = 0;
  userOrder.forEach((id, index) => {
    if (correctOrder[index] === id) {
      correctCount++;
    }
  });

  const score = Math.round((correctCount / correctOrder.length) * 100);

  return {
    isCorrect: JSON.stringify(userOrder) === JSON.stringify(correctOrder),
    correctOrder,
    score,
  };
}
