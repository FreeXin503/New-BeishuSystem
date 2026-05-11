/**
 * 填空题背诵服务
 */

import type { 
  FillBlankItem, 
  FillBlankGameState, 
  FillBlankOption, 
  FillBlankSessionResult,
  Question 
} from '../../types';

// ==================== 填空题生成 ====================

/**
 * 从选择题生成填空题
 */
export function generateFillBlankFromQuestion(question: Question): FillBlankItem[] {
  const items: FillBlankItem[] = [];
  
  // 方法1：将正确答案作为填空
  const blankItem: FillBlankItem = {
    id: `fill-${question.id}-blank`,
    question: question.question.replace(question.correctAnswer, '___'),
    answer: question.correctAnswer,
    hints: generateHints(question.correctAnswer, question.explanation),
    difficulty: estimateDifficulty(question),
    category: 'general',
    tags: ['generated'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  items.push(blankItem);
  
  // 方法2：基于解释生成填空题
  if (question.explanation) {
    const explanationItems = generateFillFromExplanation(question);
    items.push(...explanationItems);
  }
  
  return items;
}

/**
 * 从解释文本生成填空题
 */
function generateFillFromExplanation(question: Question): FillBlankItem[] {
  const items: FillBlankItem[] = [];
  const explanation = question.explanation;
  
  // 查找关键词并生成填空
  const keywords = extractKeywords(explanation);
  
  keywords.forEach((keyword, index) => {
    const fillItem: FillBlankItem = {
      id: `fill-${question.id}-exp-${index}`,
      question: explanation.replace(keyword, '___'),
      answer: keyword,
      hints: generateHints(keyword, explanation),
      difficulty: 'medium',
      category: 'explanation',
      tags: ['explanation', 'keyword'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    items.push(fillItem);
  });
  
  return items;
}

/**
 * 提取关键词
 */
function extractKeywords(text: string): string[] {
  // 简单的关键词提取逻辑
  const words = text.match(/[\u4e00-\u9fa5]+/g) || [];
  const keywords: string[] = [];
  
  // 过滤掉常见虚词，保留实词
  const stopWords = ['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'];
  
  words.forEach(word => {
    if (word.length >= 2 && !stopWords.includes(word) && !keywords.includes(word)) {
      keywords.push(word);
    }
  });
  
  // 返回前3个关键词
  return keywords.slice(0, 3);
}

/**
 * 生成提示
 */
function generateHints(answer: string, context: string): string[] {
  const hints: string[] = [];
  
  // 提示1：答案长度
  hints.push(`答案长度：${answer.length} 个字`);
  
  // 提示2：答案首字
  if (answer.length > 0) {
    hints.push(`答案首字：${answer[0]}`);
  }
  
  // 提示3：上下文线索
  if (context && context.includes(answer)) {
    const contextIndex = context.indexOf(answer);
    const beforeContext = context.substring(Math.max(0, contextIndex - 10), contextIndex);
    const afterContext = context.substring(contextIndex + answer.length, Math.min(context.length, contextIndex + answer.length + 10));
    hints.push(`上下文：...${beforeContext}[答案]${afterContext}...`);
  }
  
  return hints;
}

/**
 * 估算难度
 */
function estimateDifficulty(question: Question): 'easy' | 'medium' | 'hard' {
  const answerLength = question.correctAnswer.length;
  const questionLength = question.question.length;
  
  if (answerLength <= 4 && questionLength <= 20) {
    return 'easy';
  } else if (answerLength <= 8 && questionLength <= 40) {
    return 'medium';
  } else {
    return 'hard';
  }
}

// ==================== 填空题游戏逻辑 ====================

/**
 * 初始化游戏状态
 */
export function initializeFillBlankGame(items: FillBlankItem[]): FillBlankGameState {
  const shuffledItems = [...items].sort(() => Math.random() - 0.5);
  
  return {
    currentItem: shuffledItems[0] || null,
    currentAnswer: '',
    isAnswered: false,
    isCorrect: false,
    hints: [],
    hintsUsed: 0,
    score: 0,
    streak: 0,
    totalAttempts: 0,
    correctAttempts: 0,
    startTime: new Date(),
  };
}

/**
 * 生成匹配选项
 */
export function generateFillBlankOptions(correctAnswer: string, allAnswers: string[], count: number = 4): FillBlankOption[] {
  const options: FillBlankOption[] = [];
  
  // 添加正确答案
  options.push({
    id: `opt-correct`,
    text: correctAnswer,
    isCorrect: true,
    isSelected: false,
  });
  
  // 添加干扰项
  const distractors = selectDistractors(correctAnswer, allAnswers, count - 1);
  distractors.forEach((distractor, index) => {
    options.push({
      id: `opt-distractor-${index}`,
      text: distractor,
      isCorrect: false,
      isSelected: false,
    });
  });
  
  // 打乱选项顺序
  return options.sort(() => Math.random() - 0.5);
}

/**
 * 选择干扰项
 */
function selectDistractors(correctAnswer: string, allAnswers: string[], count: number): string[] {
  const distractors: string[] = [];
  const availableAnswers = allAnswers.filter(answer => answer !== correctAnswer);
  
  // 优先选择长度相近的答案作为干扰项
  const sortedByLength = availableAnswers.sort((a, b) => {
    const aDiff = Math.abs(a.length - correctAnswer.length);
    const bDiff = Math.abs(b.length - correctAnswer.length);
    return aDiff - bDiff;
  });
  
  distractors.push(...sortedByLength.slice(0, count));
  
  // 如果干扰项不够，生成一些相似的干扰项
  while (distractors.length < count) {
    const similar = generateSimilarAnswer(correctAnswer);
    if (!distractors.includes(similar)) {
      distractors.push(similar);
    }
  }
  
  return distractors.slice(0, count);
}

/**
 * 生成相似答案作为干扰项
 */
function generateSimilarAnswer(correctAnswer: string): string {
  // 简单的相似答案生成逻辑
  if (correctAnswer.length <= 2) {
    // 对于短答案，使用常见字替换
    const replacements = ['是', '否', '对', '错', '能', '不能', '可以', '不可以'];
    return replacements[Math.floor(Math.random() * replacements.length)];
  } else {
    // 对于长答案，修改部分字符
    const chars = correctAnswer.split('');
    const modifyIndex = Math.floor(Math.random() * chars.length);
    const similarChars = ['的', '了', '和', '与', '及', '或', '但', '而'];
    chars[modifyIndex] = similarChars[Math.floor(Math.random() * similarChars.length)];
    return chars.join('');
  }
}

/**
 * 检查答案
 */
export function checkFillBlankAnswer(gameState: FillBlankGameState, userAnswer: string): FillBlankGameState {
  const isCorrect = userAnswer.trim() === gameState.currentItem?.answer.trim();
  
  return {
    ...gameState,
    currentAnswer: userAnswer,
    isAnswered: true,
    isCorrect,
    totalAttempts: gameState.totalAttempts + 1,
    correctAttempts: gameState.correctAttempts + (isCorrect ? 1 : 0),
    score: gameState.score + (isCorrect ? calculateScore(gameState.hintsUsed) : 0),
    streak: isCorrect ? gameState.streak + 1 : 0,
  };
}

/**
 * 计算得分
 */
function calculateScore(hintsUsed: number): number {
  const baseScore = 100;
  const hintPenalty = hintsUsed * 20;
  return Math.max(baseScore - hintPenalty, 20);
}

/**
 * 显示提示
 */
export function showHint(gameState: FillBlankGameState): FillBlankGameState {
  if (!gameState.currentItem || gameState.hintsUsed >= (gameState.currentItem.hints?.length || 0)) {
    return gameState;
  }
  
  const newHint = gameState.currentItem.hints![gameState.hintsUsed];
  
  return {
    ...gameState,
    hints: [...gameState.hints, newHint],
    hintsUsed: gameState.hintsUsed + 1,
  };
}

/**
 * 下一题
 */
export function nextFillBlankItem(gameState: FillBlankGameState, remainingItems: FillBlankItem[]): {
  gameState: FillBlankGameState;
  remainingItems: FillBlankItem[];
  isCompleted: boolean;
} {
  const nextItem = remainingItems.shift();
  
  if (!nextItem) {
    return {
      gameState,
      remainingItems,
      isCompleted: true,
    };
  }
  
  return {
    gameState: {
      ...gameState,
      currentItem: nextItem,
      currentAnswer: '',
      isAnswered: false,
      isCorrect: false,
      hints: [],
      hintsUsed: 0,
    },
    remainingItems,
    isCompleted: false,
  };
}

/**
 * 生成会话结果
 */
export function generateSessionResult(
  gameState: FillBlankGameState,
  totalItems: number,
  category: string
): FillBlankSessionResult {
  const endTime = new Date();
  const totalTime = endTime.getTime() - gameState.startTime.getTime();
  
  return {
    sessionId: `session-${Date.now()}`,
    totalItems,
    correctAnswers: gameState.correctAttempts,
    accuracy: totalItems > 0 ? (gameState.correctAttempts / totalItems) * 100 : 0,
    totalTime,
    averageTimePerItem: totalItems > 0 ? totalTime / totalItems : 0,
    hintsUsed: gameState.hintsUsed,
    category,
    completedAt: endTime,
  };
}
