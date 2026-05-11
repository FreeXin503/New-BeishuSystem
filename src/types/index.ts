// ==================== 核心类型定义 ====================

// 用户相关
export interface User {
  id: string;
  email: string;
  isGuest: boolean;
  createdAt: Date;
}

// 内容解析相关
export interface ParsedContent {
  id: string;
  title: string;
  chapters: Chapter[];
  keywords: Keyword[];
  concepts: Concept[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  keywords: string[];
  order: number;
}

export interface Keyword {
  term: string;
  definition: string;
  importance: 'high' | 'medium' | 'low';
}

export interface Concept {
  name: string;
  definition: string;
  relatedTerms: string[];
}

// SM-2 复习卡片相关
export interface ReviewCard {
  id: string;
  contentId: string;
  userId: string;
  cardType: 'fill-blank' | 'quiz' | 'matching';
  cardData: CardData;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
  lastReviewDate: Date | null;
  createdAt: Date;
}

export type CardData = FillBlankCardData | QuizCardData | MatchingCardData;

export interface FillBlankCardData {
  type: 'fill-blank';
  text: string;
  blanks: BlankItem[];
}

export interface QuizCardData {
  type: 'quiz';
  question: Question;
}

export interface MatchingCardData {
  type: 'matching';
  pairs: MatchPair[];
}

// 学习模式相关
export interface BlankItem {
  id: string;
  position: number;
  length: number;
  answer: string;
  hint?: string;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  type?: 'choice' | 'judgment';  // 题目类型：选择题或判断题
}

export interface MatchPair {
  id: string;
  term: string;
  definition: string;
}

// 学习结果相关
export interface ValidationResult {
  isCorrect: boolean;
  correctAnswer: string;
  explanation?: string;
  score: number;
}

export interface ModeProgress {
  total: number;
  completed: number;
  correct: number;
  timeSpent: number;
}

// SM-2 调度相关
export interface ReviewSchedule {
  nextReviewDate: Date;
  newInterval: number;
  newEaseFactor: number;
  newRepetitions: number;
}

export interface ReviewResult {
  cardId: string;
  quality: number; // 0-5
  responseTime: number;
  timestamp: Date;
}

// 学习会话相关
export interface StudySession {
  id: string;
  userId: string;
  contentId: string;
  mode: LearningMode;
  duration: number;
  correctCount: number;
  totalCount: number;
  startedAt: Date;
  endedAt: Date | null;
}

export type LearningMode = 'fill-blank' | 'quiz' | 'matching' | 'mnemonic' | 'speech' | 'logic-chain';

// 得分记录
export interface ScoreRecord {
  id: string;
  userId: string;
  contentId: string;
  sessionId: string;
  mode: LearningMode;
  questionId: string;
  questionType: 'fill-blank' | 'quiz' | 'matching' | 'logic-chain';
  score: number;        // 0-100
  isCorrect: boolean;
  responseTime: number; // 毫秒
  timestamp: Date;
}

// 逻辑链
export interface LogicChain {
  id: string;
  contentId: string;
  title: string;
  nodes: LogicNode[];
  connections: LogicConnection[];
  createdAt: Date;
}

export interface LogicNode {
  id: string;
  content: string;
  type: 'premise' | 'conclusion' | 'evidence' | 'concept';
  order: number;
}

export interface LogicConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation: 'leads-to' | 'supports' | 'explains' | 'contrasts';
}

// 用户设置相关
export interface UserSettings {
  theme: 'light' | 'dark' | 'eye-care';
  speechRate: number;
  dailyGoal: number;
  notificationsEnabled: boolean;
}

// 学习进度相关
export interface LearningProgress {
  userId: string;
  totalStudyTime: number;
  contentProgress: ContentProgress[];
  reviewCards: ReviewCard[];
  lastSyncAt: Date;
}

export interface ContentProgress {
  contentId: string;
  masteryLevel: number; // 0-100
  lastStudiedAt: Date;
  completedModes: LearningMode[];
}

// 同步相关
export interface SyncItem {
  id: string;
  type: 'content' | 'card' | 'session' | 'settings';
  action: 'create' | 'update' | 'delete';
  data: unknown;
  timestamp: Date;
}

// 统计相关
export interface Statistics {
  totalStudyTime: number;
  totalCorrect: number;
  totalQuestions: number;
  accuracyRate: number;
  streakDays: number;
  chapterMastery: ChapterMastery[];
}

export interface ChapterMastery {
  chapterId: string;
  chapterTitle: string;
  masteryLevel: number;
  totalCards: number;
  masteredCards: number;
}

// API 响应相关
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 主题类型
export type Theme = 'light' | 'dark' | 'eye-care';

// 题库存档
export interface QuizArchive {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  category: string;        // 分类：如 "马原"、"毛概"、"思修" 等
  tags: string[];          // 标签
  totalCount: number;
  practiceCount: number;   // 练习次数
  bestScore: number;       // 最高分
  lastPracticeAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// 错题记录
export interface WrongAnswer {
  id: string;
  questionId: string;
  archiveId: string;       // 所属题库ID
  question: Question;      // 完整题目信息
  userAnswer: string;      // 用户的错误答案
  wrongCount: number;      // 错误次数
  lastWrongAt: Date;
  category: string;        // 分类
  tags: string[];          // 标签
  notes?: string;          // 用户笔记
  mastered: boolean;       // 是否已掌握
  createdAt: Date;
  updatedAt: Date;
}

// 错题本分类统计
export interface WrongAnswerStats {
  category: string;
  totalCount: number;
  masteredCount: number;
  unmasteredCount: number;
}

// 收藏题目
export interface FavoriteQuestion {
  id: string;
  questionId: string;
  question: Question;      // 完整题目信息
  category: string;        // 收藏分类
  notes?: string;          // 用户笔记
  sourceType: 'quiz' | 'wrong-answer';  // 来源类型
  sourceId?: string;       // 来源ID（题库ID或错题ID）
  createdAt: Date;
  updatedAt: Date;
}

// 收藏分类
export interface FavoriteCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;          // 分类颜色
  order: number;           // 排序
  createdAt: Date;
  updatedAt: Date;
}

// 收藏统计
export interface FavoriteStats {
  category: string;
  categoryName: string;
  count: number;
}

// ==================== 填空题背诵相关 ====================

// 填空题项目
export interface FillBlankItem {
  id: string;
  question: string;        // 题目文本
  answer: string;          // 答案
  hints?: string[];        // 提示
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;        // 分类
  tags: string[];         // 标签
  createdAt: Date;
  updatedAt: Date;
}

// 填空题游戏状态
export interface FillBlankGameState {
  currentItem: FillBlankItem | null;
  currentAnswer: string;
  isAnswered: boolean;
  isCorrect: boolean;
  hints: string[];
  hintsUsed: number;
  score: number;
  streak: number;
  totalAttempts: number;
  correctAttempts: number;
  startTime: Date;
}

// 填空题匹配选项
export interface FillBlankOption {
  id: string;
  text: string;
  isCorrect: boolean;
  isSelected: boolean;
}

// 填空题会话结果
export interface FillBlankSessionResult {
  sessionId: string;
  totalItems: number;
  correctAnswers: number;
  accuracy: number;
  totalTime: number;
  averageTimePerItem: number;
  hintsUsed: number;
  category: string;
  completedAt: Date;
}

// 填空题学习进度
export interface FillBlankProgress {
  itemId: string;
  attempts: number;
  correctAttempts: number;
  lastAttemptAt: Date;
  masteryLevel: number; // 0-100
  nextReviewAt: Date;
}

// 填空题收藏
export interface FillBlankFavorite {
  id: string;
  fillBlankItemId: string;
  fillBlankItem: FillBlankItem;
  category: string;
  notes?: string;
  createdAt: Date;
  tags?: string[];
}

// 填空题错题
export interface FillBlankWrongAnswer {
  id: string;
  fillBlankItemId: string;
  fillBlankItem: FillBlankItem;
  userAnswer: string;
  correctAnswer: string;
  category: string;
  wrongCount: number;
  firstWrongAt: Date;
  lastWrongAt: Date;
  mastered: boolean;
  notes?: string;
  hints?: string[];
}

// 填空题导入记录
export interface FillBlankImportRecord {
  id: string;
  name: string;              // 记录名称
  description?: string;       // 描述
  itemCount: number;          // 题目数量
  category?: string;          // 主要分类
  tags: string[];             // 所有标签
  createdAt: Date;
  updatedAt: Date;
}

// ==================== 中文拼写相关 ====================

// 中文拼写词汇项
export interface ChineseSpellingItem {
  id: string;
  english: string;           // 英文单词/词组
  chinese: string;           // 中文释义
  category?: string;         // 分类
  tags?: string[];          // 标签
  difficulty?: 'easy' | 'medium' | 'hard';
  createdAt: Date;
  updatedAt: Date;
}

// 带收藏日期的收藏项
export interface FavoriteItem extends ChineseSpellingItem {
  favoriteDate: string;      // 收藏日期，格式：YYYY-MM-DD
}

// 中文拼写游戏状态
export interface ChineseSpellingGameState {
  currentItem: ChineseSpellingItem | null;
  currentAnswer: string;
  isAnswered: boolean;
  isCorrect: boolean;
  showHint: boolean;
  hintLevel: number;        // 提示等级：0=无提示，1=首字，2=拼音，3=完整答案
  score: number;
  streak: number;
  totalAttempts: number;
  correctAttempts: number;
  startTime: Date;
  // 挑战模式相关
  mode: 'practice' | 'challenge';
  health?: number;           // 血量（挑战模式）
  maxHealth?: number;        // 最大血量
}

// 中文拼写会话结果
export interface ChineseSpellingSessionResult {
  sessionId: string;
  totalItems: number;
  correctAnswers: number;
  accuracy: number;
  totalTime: number;
  averageTimePerItem: number;
  mode: 'practice' | 'challenge';
  category?: string;
  completedAt: Date;
  // 挑战模式额外信息
  finalHealth?: number;
  maxHealth?: number;
}
