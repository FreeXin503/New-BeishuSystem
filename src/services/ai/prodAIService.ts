import { rawCallDeepSeekWithRetry, rawCallDeepSeekChatWithRetry } from './deepseek';
import type { Message, IAIService } from '../../domain/contracts/IAIService';

export class ProdAIService implements IAIService {
  async callDeepSeekWithRetry(
    prompt: string,
    systemPrompt: string,
    maxRetries?: number,
    temperature?: number
  ): Promise<string> {
    return rawCallDeepSeekWithRetry(prompt, systemPrompt, maxRetries, temperature);
  }

  async callDeepSeekChatWithRetry(
    messages: Message[],
    maxRetries?: number,
    temperature?: number
  ): Promise<string> {
    return rawCallDeepSeekChatWithRetry(messages, maxRetries, temperature);
  }
}
