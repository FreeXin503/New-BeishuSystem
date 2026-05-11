/**
 * DeepSeek API 服务封装
 */

const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: 'NETWORK_ERROR' | 'API_ERROR' | 'PARSE_ERROR' | 'RATE_LIMIT',
    public retryable: boolean
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 判断错误是否可重试
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof AIServiceError) {
    return error.retryable;
  }
  return false;
}

/**
 * 调用 DeepSeek API
 */
async function callDeepSeek(
  prompt: string,
  systemPrompt: string,
  temperature: number = 0.7
): Promise<string> {
  if (!API_KEY) {
    throw new AIServiceError('Missing DeepSeek API key', 'API_ERROR', false);
  }

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new AIServiceError('Rate limit exceeded', 'RATE_LIMIT', true);
      }
      throw new AIServiceError(
        `API request failed: ${response.status}`,
        'API_ERROR',
        response.status >= 500
      );
    }

    const data: DeepSeekResponse = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new AIServiceError('No response from API', 'API_ERROR', false);
    }

    return data.choices[0].message.content;
  } catch (error) {
    if (error instanceof AIServiceError) {
      throw error;
    }
    if (error instanceof TypeError) {
      throw new AIServiceError('Network error', 'NETWORK_ERROR', true);
    }
    throw new AIServiceError(
      `Unknown error: ${error}`,
      'API_ERROR',
      false
    );
  }
}

/**
 * 带重试的 API 调用
 */
export async function callDeepSeekWithRetry(
  prompt: string,
  systemPrompt: string,
  maxRetries: number = 3,
  temperature: number = 0.7
): Promise<string> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callDeepSeek(prompt, systemPrompt, temperature);
    } catch (error) {
      lastError = error as Error;
      if (i === maxRetries - 1 || !isRetryable(error)) {
        throw error;
      }
      // 指数退避
      await delay(Math.pow(2, i) * 1000);
    }
  }

  throw lastError || new AIServiceError('Max retries exceeded', 'API_ERROR', false);
}

// ==================== Prompts ====================

export const PARSE_CONTENT_PROMPT = `你是一个政治学习内容解析助手。请分析以下政治文本，提取：
1. 章节结构（标题和内容）
2. 关键词及其定义
3. 核心概念及其解释

请严格按照以下 JSON 格式返回结果，不要包含任何其他文字：
{
  "title": "文本标题",
  "chapters": [
    {
      "id": "chapter-1",
      "title": "章节标题",
      "content": "章节内容",
      "keywords": ["关键词1", "关键词2"],
      "order": 1
    }
  ],
  "keywords": [
    {
      "term": "关键词",
      "definition": "定义",
      "importance": "high|medium|low"
    }
  ],
  "concepts": [
    {
      "name": "概念名称",
      "definition": "概念定义",
      "relatedTerms": ["相关术语1", "相关术语2"]
    }
  ]
}`;

export const GENERATE_QUIZ_PROMPT = `基于以下内容生成选择题。要求：
1. 每题4个选项，只有1个正确答案
2. 提供详细的答案解析
3. 难度适中，考察理解而非死记硬背

请严格按照以下 JSON 格式返回题目数组，不要包含任何其他文字：
[
  {
    "id": "q1",
    "question": "题目内容",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "correctAnswer": "正确选项内容",
    "explanation": "答案解析"
  }
]`;

export const GENERATE_MNEMONIC_PROMPT = `请为以下政治知识点创建记忆口诀。要求：
1. 押韵且朗朗上口
2. 涵盖核心要点
3. 易于记忆和复述
4. 使用中文

请直接返回口诀内容，不需要 JSON 格式。`;

export const GENERATE_MNEMONIC_RHYME_PROMPT = `请为以下政治知识点创建押韵口诀。要求：
1. 每句结尾押韵
2. 句式整齐（如七言或五言）
3. 涵盖所有核心要点
4. 朗朗上口，便于背诵

请直接返回口诀内容，每句一行。`;

export const GENERATE_MNEMONIC_ACRONYM_PROMPT = `请为以下政治知识点创建首字母/首字缩略口诀。要求：
1. 提取每个要点的首字或关键字
2. 组成一个易记的词语或短句
3. 解释每个字代表的含义
4. 格式：口诀 + 解释

示例格式：
口诀：XXX
解释：
- X = 第一个要点
- X = 第二个要点
- X = 第三个要点`;

export const GENERATE_MNEMONIC_STORY_PROMPT = `请为以下政治知识点创建故事联想记忆法。要求：
1. 编一个简短有趣的故事
2. 故事情节串联所有知识点
3. 使用生动的画面感
4. 故事要有逻辑性，便于回忆

请直接返回故事内容。`;

export const GENERATE_MNEMONIC_COMPARE_PROMPT = `请为以下政治知识点创建对比记忆表格。要求：
1. 找出可对比的概念或要点
2. 列出异同点
3. 使用简洁的语言
4. 便于区分和记忆

请返回 Markdown 表格格式。`;

export const GENERATE_FILL_BLANK_PROMPT = `基于以下内容生成挖空填词练习。要求：
1. 选择重要的关键词进行挖空
2. 每段文字挖空2-4个关键词
3. 提供提示信息

请严格按照以下 JSON 格式返回，不要包含任何其他文字：
{
  "text": "原文内容，用 ___N___ 表示挖空位置",
  "blanks": [
    {
      "id": "b1",
      "position": 0,
      "length": 4,
      "answer": "正确答案",
      "hint": "提示信息"
    }
  ]
}`;

export const GENERATE_MATCHING_PROMPT = `基于以下内容生成术语配对练习。要求：
1. 提取重要的术语和定义
2. 生成5-8对配对项
3. 定义要简洁明了

请严格按照以下 JSON 格式返回，不要包含任何其他文字：
[
  {
    "id": "m1",
    "term": "术语",
    "definition": "定义"
  }
]`;
