/**
 * 挖空填词学习模式服务
 */

import type { BlankItem, ValidationResult, Chapter } from '../../types';

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `blank-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 从章节内容中提取关键词并生成挖空项
 */
export function extractBlanksFromChapter(chapter: Chapter): {
  text: string;
  blanks: BlankItem[];
} {
  const { content, keywords } = chapter;
  
  if (!keywords || keywords.length === 0) {
    return { text: content, blanks: [] };
  }

  let processedText = content;
  const blanks: BlankItem[] = [];
  let offset = 0;

  // 按关键词在文本中的位置排序
  const sortedKeywords = [...keywords]
    .map((keyword) => ({
      keyword,
      index: content.indexOf(keyword),
    }))
    .filter((item) => item.index !== -1)
    .sort((a, b) => a.index - b.index);

  for (const { keyword, index } of sortedKeywords) {
    const adjustedIndex = index + offset;
    const placeholder = `___${blanks.length + 1}___`;
    
    // 替换关键词为占位符
    processedText =
      processedText.substring(0, adjustedIndex) +
      placeholder +
      processedText.substring(adjustedIndex + keyword.length);

    blanks.push({
      id: generateId(),
      position: adjustedIndex,
      length: keyword.length,
      answer: keyword,
      hint: keyword.length > 2 ? `${keyword[0]}...${keyword[keyword.length - 1]}` : undefined,
    });

    // 更新偏移量
    offset += placeholder.length - keyword.length;
  }

  return { text: processedText, blanks };
}

/**
 * 验证用户答案
 * @param userAnswer 用户输入的答案
 * @param correctAnswer 正确答案
 * @param strict 是否严格匹配（区分大小写和空格）
 */
export function validateAnswer(
  userAnswer: string,
  correctAnswer: string,
  strict: boolean = false
): ValidationResult {
  const normalizedUser = strict
    ? userAnswer
    : userAnswer.trim().toLowerCase().replace(/\s+/g, '');
  const normalizedCorrect = strict
    ? correctAnswer
    : correctAnswer.trim().toLowerCase().replace(/\s+/g, '');

  const isCorrect = normalizedUser === normalizedCorrect;

  return {
    isCorrect,
    correctAnswer,
    score: isCorrect ? 1 : 0,
    explanation: isCorrect ? '回答正确！' : `正确答案是：${correctAnswer}`,
  };
}

/**
 * 批量验证答案
 */
export function validateAllAnswers(
  userAnswers: Map<string, string>,
  blanks: BlankItem[]
): {
  results: Map<string, ValidationResult>;
  correctCount: number;
  totalCount: number;
  score: number;
} {
  const results = new Map<string, ValidationResult>();
  let correctCount = 0;

  for (const blank of blanks) {
    const userAnswer = userAnswers.get(blank.id) || '';
    const result = validateAnswer(userAnswer, blank.answer);
    results.set(blank.id, result);
    
    if (result.isCorrect) {
      correctCount++;
    }
  }

  const totalCount = blanks.length;
  const score = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

  return {
    results,
    correctCount,
    totalCount,
    score: Math.round(score),
  };
}

/**
 * 生成提示信息
 */
export function generateHint(answer: string, revealCount: number = 1): string {
  if (answer.length <= revealCount * 2) {
    return answer[0] + '...';
  }
  
  const start = answer.substring(0, revealCount);
  const end = answer.substring(answer.length - revealCount);
  return `${start}...${end}`;
}

/**
 * 计算答案相似度（用于部分得分）
 */
export function calculateSimilarity(userAnswer: string, correctAnswer: string): number {
  const user = userAnswer.toLowerCase();
  const correct = correctAnswer.toLowerCase();

  if (user === correct) return 1;
  if (user.length === 0 || correct.length === 0) return 0;

  // 使用 Levenshtein 距离计算相似度
  const matrix: number[][] = [];

  for (let i = 0; i <= correct.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= user.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= correct.length; i++) {
    for (let j = 1; j <= user.length; j++) {
      if (correct[i - 1] === user[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[correct.length][user.length];
  const maxLength = Math.max(correct.length, user.length);
  
  return 1 - distance / maxLength;
}

/**
 * 检查答案是否接近正确（用于给予部分提示）
 */
export function isCloseAnswer(userAnswer: string, correctAnswer: string): boolean {
  const similarity = calculateSimilarity(userAnswer, correctAnswer);
  return similarity >= 0.7 && similarity < 1;
}


/**
 * 从文本和关键词生成挖空练习
 * 升级版：挖更多重要词汇
 */
export function generateFillBlanks(
  text: string,
  keywords: string[]
): { text: string; blanks: BlankItem[] } {
  if (!text || text.trim().length === 0) {
    return { text, blanks: [] };
  }

  // 扩展关键词列表：除了传入的关键词，还自动识别重要词汇
  const expandedKeywords = expandKeywords(text, keywords);

  let processedText = text;
  const blanks: BlankItem[] = [];
  let offset = 0;
  const usedPositions = new Set<number>(); // 避免重叠

  // 按关键词在文本中的位置排序
  const sortedKeywords = [...expandedKeywords]
    .map((keyword) => {
      // 找到所有出现位置
      const positions: number[] = [];
      let pos = text.indexOf(keyword);
      while (pos !== -1) {
        positions.push(pos);
        pos = text.indexOf(keyword, pos + 1);
      }
      return { keyword, positions };
    })
    .filter((item) => item.positions.length > 0)
    .flatMap((item) => 
      item.positions.map(pos => ({ keyword: item.keyword, index: pos }))
    )
    .sort((a, b) => a.index - b.index);

  for (const { keyword, index } of sortedKeywords) {
    // 检查是否与已有挖空重叠
    let overlaps = false;
    for (let i = index; i < index + keyword.length; i++) {
      if (usedPositions.has(i)) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;

    // 标记已使用的位置
    for (let i = index; i < index + keyword.length; i++) {
      usedPositions.add(i);
    }

    const adjustedIndex = index + offset;
    const placeholder = `___${blanks.length + 1}___`;
    
    processedText =
      processedText.substring(0, adjustedIndex) +
      placeholder +
      processedText.substring(adjustedIndex + keyword.length);

    blanks.push({
      id: generateId(),
      position: adjustedIndex,
      length: keyword.length,
      answer: keyword,
      hint: generateHint(keyword),
    });

    offset += placeholder.length - keyword.length;
  }

  return { text: processedText, blanks };
}

/**
 * 扩展关键词列表，自动识别更多重要词汇
 */
function expandKeywords(text: string, baseKeywords: string[]): string[] {
  const keywords = new Set(baseKeywords);

  // 政治学习常见重要词汇模式
  const importantPatterns = [
    // 政治术语
    /中国特色社会主义/g,
    /马克思主义/g,
    /习近平新时代/g,
    /社会主义核心价值观/g,
    /人民民主专政/g,
    /民主集中制/g,
    /依法治国/g,
    /从严治党/g,
    /改革开放/g,
    /科学发展观/g,
    /和谐社会/g,
    /小康社会/g,
    /现代化/g,
    /新发展理念/g,
    /高质量发展/g,
    /共同富裕/g,
    /人类命运共同体/g,
    /一带一路/g,
    /供给侧结构性改革/g,
    /创新驱动发展/g,
    
    // 重要概念词
    /[一二三四五六七八九十]+个[^\s，。、]+/g,  // 如"三个代表"
    /[一二三四五六七八九十]+大[^\s，。、]+/g,  // 如"五大发展理念"
    /[一二三四五六七八九十]+项[^\s，。、]+/g,
    /[一二三四五六七八九十]+条[^\s，。、]+/g,
    
    // 动词短语
    /坚持[^\s，。、]{2,8}/g,
    /推进[^\s，。、]{2,8}/g,
    /实现[^\s，。、]{2,8}/g,
    /加强[^\s，。、]{2,8}/g,
    /完善[^\s，。、]{2,8}/g,
    /建设[^\s，。、]{2,8}/g,
    /发展[^\s，。、]{2,8}/g,
    /深化[^\s，。、]{2,8}/g,
    
    // 名词短语
    /[^\s，。、]{2,4}制度/g,
    /[^\s，。、]{2,4}体系/g,
    /[^\s，。、]{2,4}机制/g,
    /[^\s，。、]{2,4}战略/g,
    /[^\s，。、]{2,4}思想/g,
    /[^\s，。、]{2,4}理论/g,
    /[^\s，。、]{2,4}道路/g,
    /[^\s，。、]{2,4}方针/g,
    /[^\s，。、]{2,4}政策/g,
    /[^\s，。、]{2,4}原则/g,
    /[^\s，。、]{2,4}目标/g,
    /[^\s，。、]{2,4}任务/g,
    
    // 四字词语（常见政治术语）
    /[\u4e00-\u9fa5]{4}(?=，|。|、|；|：|\s|$)/g,
  ];

  // 匹配重要词汇
  for (const pattern of importantPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // 过滤太短或太长的词
        if (match.length >= 2 && match.length <= 12) {
          keywords.add(match);
        }
      });
    }
  }

  // 过滤常见无意义词
  const stopWords = new Set([
    '的', '了', '是', '在', '和', '与', '或', '等', '中', '上', '下',
    '这', '那', '有', '为', '以', '及', '对', '把', '被', '让', '给',
    '就', '都', '也', '还', '又', '但', '而', '所', '其', '之', '于',
    '要', '会', '能', '可', '将', '应', '该', '必', '须', '需',
  ]);

  // 返回过滤后的关键词数组，按长度降序排列（优先匹配长词）
  return Array.from(keywords)
    .filter(kw => !stopWords.has(kw) && kw.length >= 2)
    .sort((a, b) => b.length - a.length);
}
