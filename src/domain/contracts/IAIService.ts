export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface IAIService {
  callDeepSeekWithRetry(
    prompt: string,
    systemPrompt: string,
    maxRetries?: number,
    temperature?: number
  ): Promise<string>;

  callDeepSeekChatWithRetry(
    messages: Message[],
    maxRetries?: number,
    temperature?: number
  ): Promise<string>;
}
