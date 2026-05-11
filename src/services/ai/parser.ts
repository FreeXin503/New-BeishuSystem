/**
 * AI 内容解析器
 */

import {
  callDeepSeekWithRetry,
  PARSE_CONTENT_PROMPT,
  GENERATE_QUIZ_PROMPT,
  GENERATE_MNEMONIC_PROMPT,
  GENERATE_FILL_BLANK_PROMPT,
  GENERATE_MATCHING_PROMPT,
  AIServiceError,
} from './deepseek';
import type {
  ParsedContent,
  Chapter,
  Keyword,
  Concept,
  Question,
  BlankItem,
  MatchPair,
} from '../../types';

const PARSE_BY_CHAPTER_PROMPT = `你是一个政治学习助手，擅长分析政治文本。

请将以下内容按章节进行分析，识别每个章节的：
1. 章节标题
2. 章节内容
3. 该章节的关键词及定义
4. 该章节的核心概念

请返回 JSON 格式：
{
  "title": "整体标题",
  "chapters": [
    {
      "id": "chapter-1",
      "title": "章节标题",
      "content": "章节内容",
      "keywords": ["关键词1", "关键词2"],
      "order": 1,
      "chapterKeywords": [
        { "term": "关键词", "definition": "定义", "importance": "high|medium|low" }
      ],
      "chapterConcepts": [
        { "name": "概念名", "definition": "定义", "relatedTerms": ["相关词"] }
      ]
    }
  ]
}

注意：
- 如果文本有明显的章节划分（如"第一章"、"一、"等），按原有结构分析
- 如果没有明显划分，按逻辑主题自动分段
- 每个章节独立提取关键词和概念，更加精细`;

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 安全解析 JSON
 */
function safeParseJSON<T>(text: string): T | null {
  try {
    // 尝试提取 JSON 部分（处理可能的 markdown 代码块）
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
 * 解析文本内容
 */
export async function parseContent(text: string): Promise<ParsedContent> {
  if (!text || text.trim().length === 0) {
    throw new AIServiceError('输入内容不能为空', 'PARSE_ERROR', false);
  }

  const response = await callDeepSeekWithRetry(text, PARSE_CONTENT_PROMPT);
  
  interface ParsedResponse {
    title?: string;
    chapters?: Array<{
      id?: string;
      title?: string;
      content?: string;
      keywords?: string[];
      order?: number;
    }>;
    keywords?: Array<{
      term?: string;
      definition?: string;
      importance?: string;
    }>;
    concepts?: Array<{
      name?: string;
      definition?: string;
      relatedTerms?: string[];
    }>;
  }
  
  const parsed = safeParseJSON<ParsedResponse>(response);
  
  if (!parsed) {
    throw new AIServiceError('无法解析 AI 响应', 'PARSE_ERROR', false);
  }

  const now = new Date();
  
  // 构建 ParsedContent
  const content: ParsedContent = {
    id: generateId(),
    title: parsed.title || '未命名内容',
    chapters: (parsed.chapters || []).map((ch, index): Chapter => ({
      id: ch.id || `chapter-${index + 1}`,
      title: ch.title || `章节 ${index + 1}`,
      content: ch.content || '',
      keywords: ch.keywords || [],
      order: ch.order || index + 1,
    })),
    keywords: (parsed.keywords || []).map((kw): Keyword => ({
      term: kw.term || '',
      definition: kw.definition || '',
      importance: (kw.importance as 'high' | 'medium' | 'low') || 'medium',
    })),
    concepts: (parsed.concepts || []).map((c): Concept => ({
      name: c.name || '',
      definition: c.definition || '',
      relatedTerms: c.relatedTerms || [],
    })),
    createdAt: now,
    updatedAt: now,
  };

  // 验证解析结果
  if (content.chapters.length === 0 && content.keywords.length === 0) {
    throw new AIServiceError('解析结果为空，请检查输入内容', 'PARSE_ERROR', false);
  }

  return content;
}

/**
 * 按章节解析文本内容
 */
export async function parseContentByChapters(text: string): Promise<ParsedContent> {
  if (!text || text.trim().length === 0) {
    throw new AIServiceError('输入内容不能为空', 'PARSE_ERROR', false);
  }

  const response = await callDeepSeekWithRetry(text, PARSE_BY_CHAPTER_PROMPT);
  
  interface ChapterParsedResponse {
    title?: string;
    chapters?: Array<{
      id?: string;
      title?: string;
      content?: string;
      keywords?: string[];
      order?: number;
      chapterKeywords?: Array<{
        term?: string;
        definition?: string;
        importance?: string;
      }>;
      chapterConcepts?: Array<{
        name?: string;
        definition?: string;
        relatedTerms?: string[];
      }>;
    }>;
  }
  
  const parsed = safeParseJSON<ChapterParsedResponse>(response);
  
  if (!parsed) {
    throw new AIServiceError('无法解析 AI 响应', 'PARSE_ERROR', false);
  }

  const now = new Date();
  
  // 合并所有章节的关键词和概念
  const allKeywords: Keyword[] = [];
  const allConcepts: Concept[] = [];
  const seenTerms = new Set<string>();
  const seenConcepts = new Set<string>();

  (parsed.chapters || []).forEach(ch => {
    (ch.chapterKeywords || []).forEach(kw => {
      if (kw.term && !seenTerms.has(kw.term)) {
        seenTerms.add(kw.term);
        allKeywords.push({
          term: kw.term,
          definition: kw.definition || '',
          importance: (kw.importance as 'high' | 'medium' | 'low') || 'medium',
        });
      }
    });
    (ch.chapterConcepts || []).forEach(c => {
      if (c.name && !seenConcepts.has(c.name)) {
        seenConcepts.add(c.name);
        allConcepts.push({
          name: c.name,
          definition: c.definition || '',
          relatedTerms: c.relatedTerms || [],
        });
      }
    });
  });

  const content: ParsedContent = {
    id: generateId(),
    title: parsed.title || '未命名内容',
    chapters: (parsed.chapters || []).map((ch, index): Chapter => ({
      id: ch.id || `chapter-${index + 1}`,
      title: ch.title || `章节 ${index + 1}`,
      content: ch.content || '',
      keywords: ch.keywords || [],
      order: ch.order || index + 1,
    })),
    keywords: allKeywords,
    concepts: allConcepts,
    createdAt: now,
    updatedAt: now,
  };

  if (content.chapters.length === 0) {
    throw new AIServiceError('解析结果为空，请检查输入内容', 'PARSE_ERROR', false);
  }

  return content;
}

/**
 * 生成选择题
 */
export async function generateQuestions(
  content: ParsedContent,
  count: number = 5
): Promise<Question[]> {
  const textContent = content.chapters.map((ch) => ch.content).join('\n\n');
  const prompt = `${textContent}\n\n请生成 ${count} 道选择题。`;
  
  const response = await callDeepSeekWithRetry(prompt, GENERATE_QUIZ_PROMPT);
  
  interface QuestionResponse {
    id?: string;
    question?: string;
    options?: string[];
    correctAnswer?: string;
    explanation?: string;
  }
  
  const parsed = safeParseJSON<QuestionResponse[]>(response);
  
  if (!parsed || !Array.isArray(parsed)) {
    throw new AIServiceError('无法解析选择题响应', 'PARSE_ERROR', false);
  }

  return parsed.map((q, index): Question => ({
    id: q.id || `q-${index + 1}`,
    question: q.question || '',
    options: q.options || [],
    correctAnswer: q.correctAnswer || '',
    explanation: q.explanation || '',
  }));
}

/**
 * 生成记忆口诀
 */
export async function generateMnemonic(content: string): Promise<string> {
  if (!content || content.trim().length === 0) {
    throw new AIServiceError('内容不能为空', 'PARSE_ERROR', false);
  }

  const response = await callDeepSeekWithRetry(content, GENERATE_MNEMONIC_PROMPT);
  return response.trim();
}

/**
 * 生成挖空填词练习
 */
export async function generateFillBlanks(
  content: string
): Promise<{ text: string; blanks: BlankItem[] }> {
  const response = await callDeepSeekWithRetry(content, GENERATE_FILL_BLANK_PROMPT);
  
  interface FillBlankResponse {
    text?: string;
    blanks?: Array<{
      id?: string;
      position?: number;
      length?: number;
      answer?: string;
      hint?: string;
    }>;
  }
  
  const parsed = safeParseJSON<FillBlankResponse>(response);
  
  if (!parsed) {
    throw new AIServiceError('无法解析挖空填词响应', 'PARSE_ERROR', false);
  }

  return {
    text: parsed.text || '',
    blanks: (parsed.blanks || []).map((b, index): BlankItem => ({
      id: b.id || `b-${index + 1}`,
      position: b.position || 0,
      length: b.length || 0,
      answer: b.answer || '',
      hint: b.hint,
    })),
  };
}

/**
 * 生成术语配对练习
 */
export async function generateMatchingPairs(
  content: ParsedContent
): Promise<MatchPair[]> {
  const keywordsText = content.keywords
    .map((kw) => `${kw.term}: ${kw.definition}`)
    .join('\n');
  const conceptsText = content.concepts
    .map((c) => `${c.name}: ${c.definition}`)
    .join('\n');
  
  const prompt = `关键词：\n${keywordsText}\n\n概念：\n${conceptsText}`;
  
  const response = await callDeepSeekWithRetry(prompt, GENERATE_MATCHING_PROMPT);
  
  interface MatchPairResponse {
    id?: string;
    term?: string;
    definition?: string;
  }
  
  const parsed = safeParseJSON<MatchPairResponse[]>(response);
  
  if (!parsed || !Array.isArray(parsed)) {
    throw new AIServiceError('无法解析术语配对响应', 'PARSE_ERROR', false);
  }

  return parsed.map((p, index): MatchPair => ({
    id: p.id || `m-${index + 1}`,
    term: p.term || '',
    definition: p.definition || '',
  }));
}

/**
 * 生成所有学习材料
 */
export async function generateLearningMaterials(content: ParsedContent): Promise<{
  questions: Question[];
  matchingPairs: MatchPair[];
}> {
  const [questions, matchingPairs] = await Promise.all([
    generateQuestions(content),
    generateMatchingPairs(content),
  ]);

  return {
    questions,
    matchingPairs,
  };
}
