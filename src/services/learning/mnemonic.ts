/**
 * 记忆口诀服务 - 升级版
 */

import { callDeepSeekWithRetry } from '../ai/deepseek';
import {
  GENERATE_MNEMONIC_PROMPT,
  GENERATE_MNEMONIC_RHYME_PROMPT,
  GENERATE_MNEMONIC_ACRONYM_PROMPT,
  GENERATE_MNEMONIC_STORY_PROMPT,
  GENERATE_MNEMONIC_COMPARE_PROMPT,
} from '../ai/deepseek';

// 口诀类型
export type MnemonicType = 'default' | 'rhyme' | 'acronym' | 'story' | 'compare';

export interface MnemonicTypeInfo {
  id: MnemonicType;
  name: string;
  description: string;
  icon: string;
}

export const MNEMONIC_TYPES: MnemonicTypeInfo[] = [
  { id: 'default', name: '智能口诀', description: 'AI 自动选择最佳记忆方式', icon: '🧠' },
  { id: 'rhyme', name: '押韵口诀', description: '朗朗上口的押韵句式', icon: '🎵' },
  { id: 'acronym', name: '首字缩略', description: '首字母组成易记词语', icon: '🔤' },
  { id: 'story', name: '故事联想', description: '用故事串联知识点', icon: '📖' },
  { id: 'compare', name: '对比记忆', description: '表格对比异同点', icon: '⚖️' },
];

export interface MnemonicItem {
  id: string;
  content: string;
  sourceContent: string;
  type: MnemonicType;
  createdAt: Date;
  isFavorite: boolean;
}

/**
 * 根据类型获取对应的 prompt
 */
function getPromptByType(type: MnemonicType): string {
  switch (type) {
    case 'rhyme':
      return GENERATE_MNEMONIC_RHYME_PROMPT;
    case 'acronym':
      return GENERATE_MNEMONIC_ACRONYM_PROMPT;
    case 'story':
      return GENERATE_MNEMONIC_STORY_PROMPT;
    case 'compare':
      return GENERATE_MNEMONIC_COMPARE_PROMPT;
    default:
      return GENERATE_MNEMONIC_PROMPT;
  }
}

/**
 * 生成记忆口诀
 */
export async function generateMnemonic(
  content: string,
  type: MnemonicType = 'default'
): Promise<string> {
  const prompt = getPromptByType(type);
  return callDeepSeekWithRetry(content, prompt);
}

/**
 * 批量生成多种类型的口诀
 */
export async function generateMultipleMnemonics(
  content: string,
  types: MnemonicType[] = ['default', 'rhyme', 'acronym']
): Promise<Map<MnemonicType, string>> {
  const results = new Map<MnemonicType, string>();
  
  // 并行生成
  const promises = types.map(async (type) => {
    try {
      const mnemonic = await generateMnemonic(content, type);
      results.set(type, mnemonic);
    } catch (error) {
      console.error(`生成 ${type} 类型口诀失败:`, error);
      results.set(type, '生成失败，请重试');
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * 创建口诀项
 */
export function createMnemonicItem(
  content: string,
  sourceContent: string,
  type: MnemonicType = 'default'
): MnemonicItem {
  return {
    id: `mnemonic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    content,
    sourceContent,
    type,
    createdAt: new Date(),
    isFavorite: false,
  };
}

/**
 * 切换收藏状态
 */
export function toggleFavorite(item: MnemonicItem): MnemonicItem {
  return {
    ...item,
    isFavorite: !item.isFavorite,
  };
}

/**
 * 获取收藏的口诀
 */
export function getFavorites(items: MnemonicItem[]): MnemonicItem[] {
  return items.filter((item) => item.isFavorite);
}

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}

/**
 * 分享口诀
 */
export async function shareMnemonic(item: MnemonicItem): Promise<boolean> {
  const shareData = {
    title: '政治学习口诀',
    text: `📚 记忆口诀\n\n${item.content}\n\n来自：智能政治背诵系统`,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return true;
    } catch {
      return false;
    }
  }
  
  // 降级：复制到剪贴板
  return copyToClipboard(shareData.text);
}
