/**
 * 选择题学习模式服务
 */

import type { Question, ValidationResult } from '../../types';

/**
 * 验证选择题答案
 */
export function validateQuizAnswer(
  userAnswer: string,
  question: Question
): ValidationResult {
  const isCorrect = userAnswer === question.correctAnswer;

  return {
    isCorrect,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    score: isCorrect ? 1 : 0,
  };
}

/**
 * 验证选择题结构是否正确
 */
export function validateQuestionStructure(question: Question): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!question.id || question.id.length === 0) {
    errors.push('缺少题目 ID');
  }

  if (!question.question || question.question.length === 0) {
    errors.push('缺少题目内容');
  }

  if (!Array.isArray(question.options)) {
    errors.push('选项必须是数组');
  } else if (question.options.length !== 4) {
    errors.push('选项数量必须为 4');
  } else if (question.options.some((opt) => !opt || opt.length === 0)) {
    errors.push('选项不能为空');
  }

  if (!question.correctAnswer || question.correctAnswer.length === 0) {
    errors.push('缺少正确答案');
  } else if (!question.options?.includes(question.correctAnswer)) {
    errors.push('正确答案必须在选项中');
  }

  if (!question.explanation || question.explanation.length === 0) {
    errors.push('缺少答案解析');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 打乱选项顺序
 */
export function shuffleOptions(question: Question): Question {
  const shuffled = [...question.options];
  
  // Fisher-Yates 洗牌算法
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return {
    ...question,
    options: shuffled,
  };
}

/**
 * 批量验证选择题答案
 */
export function validateAllQuizAnswers(
  userAnswers: Map<string, string>,
  questions: Question[]
): {
  results: Map<string, ValidationResult>;
  correctCount: number;
  totalCount: number;
  score: number;
} {
  const results = new Map<string, ValidationResult>();
  let correctCount = 0;

  for (const question of questions) {
    const userAnswer = userAnswers.get(question.id) || '';
    const result = validateQuizAnswer(userAnswer, question);
    results.set(question.id, result);

    if (result.isCorrect) {
      correctCount++;
    }
  }

  const totalCount = questions.length;
  const score = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

  return {
    results,
    correctCount,
    totalCount,
    score: Math.round(score),
  };
}

/**
 * 获取选项标签 (A, B, C, D)
 */
export function getOptionLabel(index: number): string {
  return String.fromCharCode(65 + index); // A = 65
}

/**
 * 根据标签获取选项索引
 */
export function getOptionIndex(label: string): number {
  return label.toUpperCase().charCodeAt(0) - 65;
}

/**
 * 格式化选项显示
 */
export function formatOption(option: string, index: number): string {
  return `${getOptionLabel(index)}. ${option}`;
}

/**
 * 计算答题用时评级
 */
export function getTimeRating(
  timeSpentSeconds: number,
  questionCount: number
): 'fast' | 'normal' | 'slow' {
  const avgTimePerQuestion = timeSpentSeconds / questionCount;

  if (avgTimePerQuestion < 15) return 'fast';
  if (avgTimePerQuestion < 30) return 'normal';
  return 'slow';
}

/**
 * 根据正确率获取评价
 */
export function getScoreRating(score: number): {
  rating: 'excellent' | 'good' | 'pass' | 'fail';
  message: string;
} {
  if (score >= 90) {
    return { rating: 'excellent', message: '优秀！继续保持！' };
  }
  if (score >= 70) {
    return { rating: 'good', message: '良好，还有提升空间。' };
  }
  if (score >= 60) {
    return { rating: 'pass', message: '及格，需要加强复习。' };
  }
  return { rating: 'fail', message: '需要重点复习这部分内容。' };
}


import type { Keyword } from '../../types';

/**
 * 从关键词生成选择题
 */
export function generateQuizQuestions(keywords: Keyword[]): Question[] {
  if (!keywords || keywords.length < 4) {
    return [];
  }

  const questions: Question[] = [];

  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    
    // 生成干扰选项
    const otherKeywords = keywords.filter((_, idx) => idx !== i);
    const shuffled = otherKeywords.sort(() => Math.random() - 0.5);
    const distractors = shuffled.slice(0, 3).map(k => k.definition);
    
    // 创建选项数组并打乱
    const options = [keyword.definition, ...distractors];
    for (let j = options.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [options[j], options[k]] = [options[k], options[j]];
    }

    questions.push({
      id: `quiz-${Date.now()}-${i}`,
      question: `"${keyword.term}" 的定义是什么？`,
      options,
      correctAnswer: keyword.definition,
      explanation: `${keyword.term}：${keyword.definition}`,
    });
  }

  return questions;
}


/**
 * 解析选择题文本，支持多种格式
 * 
 * 支持的格式：
 * 1. 标准格式：
 *    1. 题目内容
 *    A. 选项A
 *    B. 选项B
 *    C. 选项C
 *    D. 选项D
 *    答案：A
 * 
 * 2. 简化格式：
 *    题目内容
 *    A 选项A
 *    B 选项B
 *    C 选项C
 *    D 选项D
 *    答案A
 */
export function parseQuizText(text: string): Question[] {
  const questions: Question[] = [];
  
  // 按题目分割（支持数字序号或空行分隔）
  const questionBlocks = splitIntoQuestions(text);
  
  for (const block of questionBlocks) {
    const parsed = parseQuestionBlock(block);
    if (parsed) {
      questions.push(parsed);
    }
  }
  
  return questions;
}

/**
 * 将文本分割成题目块
 */
function splitIntoQuestions(text: string): string[] {
  // 清理文本
  const cleaned = text.trim().replace(/\r\n/g, '\n');
  
  // 检测是否有换行符分隔题目
  const hasNewlineBetweenQuestions = /\n\s*\d+[、．.）)]/;
  
  // 如果文本中有换行符分隔题目，使用换行分割
  if (hasNewlineBetweenQuestions.test(cleaned)) {
    const parts = cleaned.split(/(?=(?:^|\n)\s*\d+[、．.）)])/);
    return parts.filter(p => p.trim().length > 0);
  }
  
  // 紧凑格式：题目之间没有换行
  // 按顺序查找题号 1、2、3...
  const questions: string[] = [];
  
  // 找到所有题号的位置（按顺序）
  const positions: { num: number; index: number }[] = [];
  
  // 不限制题目数量，持续查找直到找不到更多题目
  let num = 1;
  let consecutiveNotFound = 0; // 连续找不到的次数
  const maxConsecutiveNotFound = 3; // 允许跳过最多3个题号
  
  while (consecutiveNotFound < maxConsecutiveNotFound) {
    const numStr = String(num);
    const separators = ['、', '.', '．', '）', ')'];
    
    let bestIndex = -1;
    
    // 查找当前题号的所有可能位置
    for (const sep of separators) {
      const pattern = numStr + sep;
      let searchStart = positions.length > 0 ? positions[positions.length - 1].index + 1 : 0;
      
      while (searchStart < cleaned.length) {
        const idx = cleaned.indexOf(pattern, searchStart);
        if (idx === -1) break;
        
        // 验证这是一个有效的题号
        let isValidStart = true;
        if (idx > 0) {
          const prevChar = cleaned[idx - 1];
          if (/[0-9]/.test(prevChar)) {
            // 检查前面的数字序列
            let digitCount = 0;
            let checkIdx = idx - 1;
            while (checkIdx >= 0 && /[0-9]/.test(cleaned[checkIdx])) {
              digitCount++;
              checkIdx--;
            }
            
            if (digitCount >= 1) {
              // 检查这个数字序列前面是否有选项标记
              const beforeDigits = cleaned.substring(Math.max(0, checkIdx - 5), checkIdx + 1);
              if (/[A-Da-d][.、．:：\s]/.test(beforeDigits)) {
                isValidStart = true;
              } else {
                isValidStart = false;
              }
            }
          }
        }
        
        // 检查后面的字符
        const afterIdx = idx + pattern.length;
        const afterChar = afterIdx < cleaned.length ? cleaned[afterIdx] : '';
        const isValidEnd = !afterChar || !/^[0-9]/.test(afterChar) || /[.、．]/.test(sep);
        
        if (isValidStart && isValidEnd) {
          if (bestIndex === -1 || idx < bestIndex) {
            bestIndex = idx;
          }
          break;
        }
        
        searchStart = idx + 1;
      }
    }
    
    if (bestIndex !== -1) {
      positions.push({ num, index: bestIndex });
      consecutiveNotFound = 0; // 重置计数器
    } else {
      if (num > 1) {
        consecutiveNotFound++;
      }
    }
    
    num++;
    
    // 安全限制：最多支持1000题
    if (num > 1000) break;
  }
  
  // 根据位置分割
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = i < positions.length - 1 ? positions[i + 1].index : cleaned.length;
    const block = cleaned.substring(start, end).trim();
    if (block.length > 0) {
      questions.push(block);
    }
  }
  
  if (questions.length > 0) {
    return questions;
  }
  
  // 按双空行分割
  if (cleaned.includes('\n\n')) {
    return cleaned.split(/\n\n+/).filter(p => p.trim().length > 0);
  }
  
  // 整体作为一道题
  return [cleaned];
}

/**
 * 解析单个题目块
 */
function parseQuestionBlock(block: string): Question | null {
  // 先尝试从文本中提取选项（支持同一行多个选项的格式）
  const extractedOptions = extractOptionsFromText(block);
  
  if (extractedOptions.options.length >= 4) {
    // 使用提取的选项
    const questionText = extractedOptions.questionText;
    if (!questionText) return null;
    
    return {
      id: `parsed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      question: questionText,
      options: extractedOptions.options.slice(0, 4),
      correctAnswer: extractedOptions.correctAnswer || extractedOptions.options[0],
      explanation: `正确答案：${extractedOptions.correctAnswer || extractedOptions.options[0]}`,
    };
  }
  
  // 回退到原来的逐行解析方式
  const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length < 2) return null;
  
  // 提取题目
  let questionText = '';
  let optionStartIndex = 0;
  
  // 查找选项开始位置
  for (let i = 0; i < lines.length; i++) {
    if (isOptionLine(lines[i])) {
      optionStartIndex = i;
      break;
    }
    // 移除题号（支持1-999的数字）
    const cleanedLine = lines[i].replace(/^\s*\d+[.、．)）]\s*/, '');
    questionText += (questionText ? ' ' : '') + cleanedLine;
  }
  
  if (!questionText || optionStartIndex === 0) return null;
  
  // 提取选项
  const options: string[] = [];
  const optionMap: Record<string, string> = {};
  let answerLine = '';
  
  for (let i = optionStartIndex; i < lines.length; i++) {
    const line = lines[i];
    
    // 检查是否是答案行
    if (isAnswerLine(line)) {
      answerLine = line;
      continue;
    }
    
    // 解析选项
    const optionMatch = line.match(/^([A-Da-d])[.、．:：\s]\s*(.+)$/);
    if (optionMatch) {
      const label = optionMatch[1].toUpperCase();
      const content = optionMatch[2].trim();
      optionMap[label] = content;
      options.push(content);
    }
  }
  
  // 需要至少4个选项
  if (options.length < 4) {
    // 尝试补充选项
    while (options.length < 4) {
      options.push(`选项${getOptionLabel(options.length)}`);
    }
  }
  
  // 提取正确答案
  let correctAnswer = '';
  if (answerLine) {
    const answerMatch = answerLine.match(/[A-Da-d]/);
    if (answerMatch) {
      const answerLabel = answerMatch[0].toUpperCase();
      correctAnswer = optionMap[answerLabel] || options[getOptionIndex(answerLabel)] || '';
    }
  }
  
  // 如果没有找到答案，默认第一个选项
  if (!correctAnswer && options.length > 0) {
    correctAnswer = options[0];
  }
  
  return {
    id: `parsed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    question: questionText,
    options: options.slice(0, 4),
    correctAnswer,
    explanation: `正确答案：${correctAnswer}`,
  };
}

/**
 * 从文本中提取选项（支持同一行多个选项的格式）
 * 例如：A. 选项1    B. 选项2    C. 选项3    D. 选项4
 */
function extractOptionsFromText(block: string): {
  questionText: string;
  options: string[];
  correctAnswer: string;
} {
  // 移除题号
  let text = block.replace(/^\s*\d+[.、．)）]\s*/, '').trim();
  
  const options: string[] = [];
  const optionMap: Record<string, string> = {};
  let questionText = '';
  
  // 找到第一个选项的位置 (A. A、 A． A: A：或 A 后跟空格)
  const firstOptionMatch = text.match(/[A-Da-d][.、．:：\s]/);
  if (firstOptionMatch && firstOptionMatch.index !== undefined) {
    questionText = text.substring(0, firstOptionMatch.index).trim();
    const optionText = text.substring(firstOptionMatch.index);
    
    // 提取每个选项
    // 使用更精确的模式：选项字母 + 分隔符 + 内容（直到下一个选项或结尾）
    const optionLabels = ['A', 'B', 'C', 'D'];
    
    for (let i = 0; i < optionLabels.length; i++) {
      const currentLabel = optionLabels[i];
      const nextLabel = optionLabels[i + 1];
      
      // 构建匹配当前选项的正则
      // 匹配：当前字母 + 分隔符 + 内容
      let pattern: RegExp;
      if (nextLabel) {
        // 匹配到下一个选项之前的内容
        pattern = new RegExp(`${currentLabel}[.、．:：\\s]\\s*([\\s\\S]*?)(?=${nextLabel}[.、．:：\\s])`, 'i');
      } else {
        // 最后一个选项，匹配到结尾
        pattern = new RegExp(`${currentLabel}[.、．:：\\s]\\s*([\\s\\S]*)$`, 'i');
      }
      
      const match = optionText.match(pattern);
      if (match && match[1]) {
        let content = match[1].trim();
        // 清理末尾的空白和可能的答案标记
        content = content.replace(/\s*(?:答案|正确答案|参考答案)[：:]*\s*[A-Da-d]?\s*$/i, '').trim();
        if (content) {
          optionMap[currentLabel] = content;
        }
      }
    }
  }
  
  // 按 A B C D 顺序排列选项
  for (const label of ['A', 'B', 'C', 'D']) {
    if (optionMap[label]) {
      options.push(optionMap[label]);
    }
  }
  
  // 查找答案
  let correctAnswer = '';
  const answerMatch = text.match(/(?:答案|正确答案|参考答案)[：:]*\s*([A-Da-d])/i);
  if (answerMatch) {
    const answerLabel = answerMatch[1].toUpperCase();
    correctAnswer = optionMap[answerLabel] || '';
  }
  
  return { questionText, options, correctAnswer };
}

/**
 * 判断是否是选项行
 */
function isOptionLine(line: string): boolean {
  return /^[A-Da-d][.、．:：\s]/.test(line);
}

/**
 * 判断是否是答案行
 */
function isAnswerLine(line: string): boolean {
  return /^(?:答案|正确答案|参考答案|Answer)[：:]*\s*[A-Da-d]/i.test(line) ||
         /^[A-Da-d]$/.test(line.trim());
}

/**
 * 批量解析多道选择题
 */
export function parseMultipleQuizzes(text: string): {
  questions: Question[];
  parseErrors: string[];
} {
  const questions: Question[] = [];
  const parseErrors: string[] = [];
  
  const blocks = splitIntoQuestions(text);
  
  blocks.forEach((block, index) => {
    const parsed = parseQuestionBlock(block);
    if (parsed) {
      questions.push(parsed);
    } else {
      parseErrors.push(`第 ${index + 1} 题解析失败`);
    }
  });
  
  return { questions, parseErrors };
}

/**
 * 验证解析后的题目是否完整
 */
export function validateParsedQuestions(questions: Question[]): {
  valid: Question[];
  invalid: { question: Question; errors: string[] }[];
} {
  const valid: Question[] = [];
  const invalid: { question: Question; errors: string[] }[] = [];
  
  for (const q of questions) {
    const validation = validateQuestionStructure(q);
    if (validation.valid) {
      valid.push(q);
    } else {
      invalid.push({ question: q, errors: validation.errors });
    }
  }
  
  return { valid, invalid };
}


// ==================== 判断题解析功能 ====================

/**
 * 判断题的正确答案选项
 */
const JUDGMENT_TRUE_OPTIONS = ['√', '✓', '对', '正确', 'T', 'true', 'True', 'TRUE', '是'];
const JUDGMENT_FALSE_OPTIONS = ['×', '✗', '错', '错误', 'F', 'false', 'False', 'FALSE', '否'];

/**
 * 解析判断题文本
 * 
 * 支持的格式：
 * 1. 题号 + 题目 + 答案：√/×
 * 2. 题号 + 题目 + 答案：对/错
 * 3. 题号 + 题目 + 答案：T/F
 */
export function parseJudgmentText(text: string): Question[] {
  const questions: Question[] = [];
  
  // 分割成题目块
  const blocks = splitIntoJudgmentQuestions(text);
  
  for (const block of blocks) {
    const parsed = parseJudgmentBlock(block);
    if (parsed) {
      questions.push(parsed);
    }
  }
  
  return questions;
}

/**
 * 将判断题文本分割成题目块
 */
function splitIntoJudgmentQuestions(text: string): string[] {
  const cleaned = text.trim().replace(/\r\n/g, '\n');
  
  // 检测是否有换行符分隔题目
  const hasNewlineBetweenQuestions = /\n\s*\d+[、．.）)]/;
  
  if (hasNewlineBetweenQuestions.test(cleaned)) {
    const parts = cleaned.split(/(?=(?:^|\n)\s*\d+[、．.）)])/);
    return parts.filter(p => p.trim().length > 0);
  }
  
  // 紧凑格式：按答案标记分割
  // 判断题的特征：答案后面紧跟下一题的题号
  const questions: string[] = [];
  const positions: { num: number; index: number }[] = [];
  
  let num = 1;
  let consecutiveNotFound = 0;
  const maxConsecutiveNotFound = 3;
  
  while (consecutiveNotFound < maxConsecutiveNotFound) {
    const numStr = String(num);
    const separators = ['、', '.', '．', '）', ')'];
    
    let bestIndex = -1;
    
    for (const sep of separators) {
      const pattern = numStr + sep;
      let searchStart = positions.length > 0 ? positions[positions.length - 1].index + 1 : 0;
      
      while (searchStart < cleaned.length) {
        const idx = cleaned.indexOf(pattern, searchStart);
        if (idx === -1) break;
        
        // 验证是否是有效的题号
        let isValidStart = true;
        if (idx > 0) {
          const prevChar = cleaned[idx - 1];
          // 判断题的题号前面通常是：行首、空格、或答案符号（√×）
          if (/[0-9]/.test(prevChar)) {
            isValidStart = false;
          }
        }
        
        if (isValidStart) {
          if (bestIndex === -1 || idx < bestIndex) {
            bestIndex = idx;
          }
          break;
        }
        
        searchStart = idx + 1;
      }
    }
    
    if (bestIndex !== -1) {
      positions.push({ num, index: bestIndex });
      consecutiveNotFound = 0;
    } else {
      if (num > 1) {
        consecutiveNotFound++;
      }
    }
    
    num++;
    if (num > 1000) break;
  }
  
  // 根据位置分割
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = i < positions.length - 1 ? positions[i + 1].index : cleaned.length;
    const block = cleaned.substring(start, end).trim();
    if (block.length > 0) {
      questions.push(block);
    }
  }
  
  if (questions.length > 0) {
    return questions;
  }
  
  // 按双空行分割
  if (cleaned.includes('\n\n')) {
    return cleaned.split(/\n\n+/).filter(p => p.trim().length > 0);
  }
  
  return [cleaned];
}

/**
 * 解析单个判断题块
 */
function parseJudgmentBlock(block: string): Question | null {
  // 移除题号
  let text = block.replace(/^\s*\d+[.、．)）]\s*/, '').trim();
  
  // 查找答案
  // 支持格式：答案：√  答案：×  答案：对  答案：错  答案：T  答案：F
  const answerPattern = /(?:答案|正确答案|参考答案)[：:]*\s*([√✓对正确TtrueTRUE是×✗错错误FfalseFALSE否])/;
  const answerMatch = text.match(answerPattern);
  
  let correctAnswer = '';
  let questionText = text;
  
  if (answerMatch) {
    const answerStr = answerMatch[1];
    // 判断是对还是错
    if (JUDGMENT_TRUE_OPTIONS.some(opt => answerStr.includes(opt) || opt.includes(answerStr))) {
      correctAnswer = '对';
    } else if (JUDGMENT_FALSE_OPTIONS.some(opt => answerStr.includes(opt) || opt.includes(answerStr))) {
      correctAnswer = '错';
    }
    
    // 从题目文本中移除答案部分
    questionText = text.replace(/(?:答案|正确答案|参考答案)[：:]*\s*[√✓对正确TtrueTRUE是×✗错错误FfalseFALSE否]+\s*/gi, '').trim();
  }
  
  // 清理题目文本末尾的括号
  questionText = questionText.replace(/[（(]\s*[)）]\s*$/, '').trim();
  
  if (!questionText) return null;
  
  return {
    id: `judgment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    question: questionText,
    options: ['对', '错'],
    correctAnswer: correctAnswer || '对', // 默认为对
    explanation: `正确答案：${correctAnswer || '对'}`,
    type: 'judgment',
  };
}

/**
 * 批量解析判断题
 */
export function parseMultipleJudgments(text: string): {
  questions: Question[];
  parseErrors: string[];
} {
  const questions: Question[] = [];
  const parseErrors: string[] = [];
  
  const blocks = splitIntoJudgmentQuestions(text);
  
  blocks.forEach((block, index) => {
    const parsed = parseJudgmentBlock(block);
    if (parsed) {
      questions.push(parsed);
    } else {
      parseErrors.push(`第 ${index + 1} 题解析失败`);
    }
  });
  
  return { questions, parseErrors };
}

/**
 * 验证判断题结构
 */
export function validateJudgmentStructure(question: Question): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!question.id || question.id.length === 0) {
    errors.push('缺少题目 ID');
  }

  if (!question.question || question.question.length === 0) {
    errors.push('缺少题目内容');
  }

  if (!question.correctAnswer || !['对', '错'].includes(question.correctAnswer)) {
    errors.push('答案必须是"对"或"错"');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证解析后的判断题是否完整
 */
export function validateParsedJudgments(questions: Question[]): {
  valid: Question[];
  invalid: { question: Question; errors: string[] }[];
} {
  const valid: Question[] = [];
  const invalid: { question: Question; errors: string[] }[] = [];
  
  for (const q of questions) {
    const validation = validateJudgmentStructure(q);
    if (validation.valid) {
      valid.push(q);
    } else {
      invalid.push({ question: q, errors: validation.errors });
    }
  }
  
  return { valid, invalid };
}

/**
 * 自动检测题目类型并解析
 * 返回选择题或判断题
 */
export function autoParseQuestions(text: string): {
  questions: Question[];
  type: 'choice' | 'judgment' | 'mixed';
  parseErrors: string[];
} {
  // 检测是否包含选择题特征（A. B. C. D. 选项）
  const hasChoiceOptions = /[A-Da-d][.、．:：\s]\s*\S/.test(text);
  
  // 检测是否包含判断题特征（答案：√/×）
  const hasJudgmentAnswer = /答案[：:]*\s*[√✓×✗对错TF]/i.test(text);
  
  // 如果有选择题选项，优先按选择题解析
  if (hasChoiceOptions && !hasJudgmentAnswer) {
    const result = parseMultipleQuizzes(text);
    return {
      questions: result.questions.map(q => ({ ...q, type: 'choice' as const })),
      type: 'choice',
      parseErrors: result.parseErrors,
    };
  }
  
  // 如果有判断题答案特征，按判断题解析
  if (hasJudgmentAnswer) {
    const result = parseMultipleJudgments(text);
    return {
      questions: result.questions,
      type: 'judgment',
      parseErrors: result.parseErrors,
    };
  }
  
  // 默认按选择题解析
  const result = parseMultipleQuizzes(text);
  return {
    questions: result.questions.map(q => ({ ...q, type: 'choice' as const })),
    type: 'choice',
    parseErrors: result.parseErrors,
  };
}
