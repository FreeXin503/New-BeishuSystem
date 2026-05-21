/**
 * 防腐层 Hydrator 工具函数
 * 
 * 所有转换器共享的安全解析、容错和默认值修复工具。
 * 设计原则：任何输入都不会抛异常，任何损坏都静默修复。
 */

import { Difficulty } from '../../domain/models/SpellingEntity';

// ==================== 日期解析 ====================

/**
 * 安全解析日期
 * 处理：Date 对象、ISO 字符串、时间戳数字、null/undefined、损坏字符串
 * 兜底：当前时间
 */
export function safeParseDate(raw: unknown, fallback?: Date): Date {
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  if (typeof raw === 'string' && raw.length > 0) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof raw === 'number' && isFinite(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  return fallback ?? new Date();
}

/**
 * 安全解析可空日期
 */
export function safeParseDateOrNull(raw: unknown): Date | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  if (typeof raw === 'string' && raw.length > 0) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof raw === 'number' && isFinite(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// ==================== JSON 数组解析 ====================

/**
 * 安全解析 JSON 字符串数组
 * 处理：原生数组、JSON 字符串、null/undefined、损坏 JSON
 * 兜底：空数组
 */
export function safeParseJsonArray(raw: unknown): readonly string[] {
  // 已经是数组
  if (Array.isArray(raw)) {
    return Object.freeze(raw.map(item => String(item ?? '')));
  }

  // null / undefined / 空
  if (raw === null || raw === undefined) return Object.freeze([]);

  // JSON 字符串
  if (typeof raw === 'string') {
    if (raw.trim() === '') return Object.freeze([]);
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return Object.freeze(parsed.map(item => String(item ?? '')));
      }
      // JSON 解析成功但不是数组 → 包装为单元素数组
      return Object.freeze([String(parsed)]);
    } catch {
      // JSON 损坏 → 静默返回空数组
      return Object.freeze([]);
    }
  }

  return Object.freeze([]);
}

// ==================== 枚举解析 ====================

/**
 * 安全解析 Difficulty 枚举
 * 兜底：Difficulty.Medium
 */
export function parseDifficulty(raw: unknown): Difficulty {
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase();
    if (lower === 'easy') return Difficulty.Easy;
    if (lower === 'medium') return Difficulty.Medium;
    if (lower === 'hard') return Difficulty.Hard;
  }
  return Difficulty.Medium;
}

/**
 * 通用枚举安全解析器
 */
export function safeParseEnum<T extends string>(
  raw: unknown,
  validValues: readonly T[],
  fallback: T
): T {
  if (typeof raw === 'string' && validValues.includes(raw as T)) {
    return raw as T;
  }
  return fallback;
}

// ==================== 字符串 / 数字解析 ====================

/**
 * 安全提取字符串
 * null/undefined → 空字符串
 */
export function safeString(raw: unknown, fallback: string = ''): string {
  if (typeof raw === 'string') return raw;
  if (raw === null || raw === undefined) return fallback;
  return String(raw);
}

/**
 * 安全提取数字
 * NaN/undefined → fallback
 */
export function safeNumber(raw: unknown, fallback: number = 0): number {
  if (typeof raw === 'number' && isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    if (isFinite(n)) return n;
  }
  return fallback;
}

/**
 * 安全提取布尔值
 */
export function safeBoolean(raw: unknown, fallback: boolean = false): boolean {
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true' || raw === 1) return true;
  if (raw === 'false' || raw === 0) return false;
  return fallback;
}

// ==================== localStorage 安全读取 ====================

/**
 * 安全读取 localStorage 并 JSON.parse
 * 任何错误（损坏、不存在、quota exceeded）都返回 fallback
 */
export function safeParseLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
