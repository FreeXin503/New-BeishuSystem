import { useState, useRef, useEffect } from 'react';
import type { ParsedContent } from '../../types';
import { callDeepSeekChatWithRetry, Message } from '../../services/ai/deepseek';

interface TutorModeProps {
  content: ParsedContent;
}

export default function TutorMode({ content }: TutorModeProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [bubblePos, setBubblePos] = useState<{ x: number, y: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 初始化提示
  useEffect(() => {
    setMessages([
      {
        role: 'system',
        content: `你是一个专业的考研政治/政治学习助教。你的任务是针对用户当前正在阅读的文本或划词提供发散讲解、解答疑问、拓展知识点。请保持耐心、专业，并且适当使用幽默或口诀来帮助记忆。`,
      },
      {
        role: 'assistant',
        content: `你好！我是你的 AI 伴读助教。你可以选中左侧文章中的任何一段话向我提问，或者直接在这里输入你的疑惑。`,
      }
    ]);
  }, []);

  const handleSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      // 检查选中的内容是否在左侧文章区域内
      if (textContainerRef.current && !textContainerRef.current.contains(selection.anchorNode)) {
        setBubblePos(null);
        return;
      }
      
      const text = selection.toString().trim();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSelectedText(text);
      setBubblePos({
        x: rect.left + rect.width / 2,
        y: rect.top - 40 // Show above the selection
      });
    } else {
      setBubblePos(null);
    }
  };

  const handleBubbleClick = () => {
    if (!selectedText) return;
    
    const userMsg = `请给我详细讲解一下这段话：“${selectedText}”`;
    
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setBubblePos(null);
    window.getSelection()?.removeAllRanges();
    sendMessage(newMessages);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: inputMessage }];
    setMessages(newMessages);
    setInputMessage('');
    sendMessage(newMessages);
  };

  const sendMessage = async (chatMessages: Message[]) => {
    setIsLoading(true);
    try {
      const response = await callDeepSeekChatWithRetry(chatMessages);
      setMessages([...chatMessages, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error('AI助教回答失败:', error);
      setMessages([...chatMessages, { role: 'assistant', content: '抱歉，我现在遇到了一点网络问题，请稍后再试。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-6" onMouseUp={handleSelection}>
      {/* 左侧：文章阅读区 */}
      <div 
        ref={textContainerRef}
        className="flex-1 overflow-y-auto pr-4 space-y-6 relative pb-20 scrollbar-hide"
      >
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text)' }}>{content.title}</h2>
        {content.chapters.map((chapter) => (
          <div key={chapter.id} className="mb-8">
            <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>{chapter.title}</h3>
            <div 
              className="text-base leading-relaxed space-y-4" 
              style={{ color: 'var(--color-text)' }}
            >
              {chapter.content.split('\\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        ))}

        {/* 划词气泡 */}
        {bubblePos && (
          <div 
            className="fixed z-50 transform -translate-x-1/2 -translate-y-full"
            style={{ left: bubblePos.x, top: bubblePos.y }}
          >
            <button
              onClick={handleBubbleClick}
              className="px-3 py-1.5 rounded-lg shadow-lg text-sm font-bold flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 animate-fade-in"
              style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
            >
              <span>🤖</span> 听听助教怎么说
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 rotate-45" style={{ backgroundColor: 'var(--color-primary)' }}></div>
            </button>
          </div>
        )}
      </div>

      {/* 右侧：AI伴读聊天区 */}
      <div className="w-full lg:w-96 flex flex-col rounded-2xl border shadow-sm h-full max-h-full" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
        <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-2xl">🤖</span>
          <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>AI 智能伴读</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.filter(m => m.role !== 'system').map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${msg.role === 'user' ? 'text-white' : ''}`}
                style={{ 
                  backgroundColor: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: msg.role === 'user' ? 'white' : 'var(--color-text)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--color-border)'
                }}
              >
                {msg.content.split('\\n').map((line, i) => (
                  <p key={i} className="min-h-[1em]">{line}</p>
                ))}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl p-3 text-sm" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="向助教提问..."
              className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="px-4 py-2 rounded-lg text-white font-bold text-sm disabled:opacity-50 transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              发送
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
