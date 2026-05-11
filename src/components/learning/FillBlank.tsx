/**
 * 挖空填词学习组件
 */

import { useState, useCallback, useEffect } from 'react';
import type { BlankItem, ModeProgress, ValidationResult } from '../../types';
import { validateAnswer, generateHint, isCloseAnswer } from '../../services/learning/fillBlank';

interface FillBlankProps {
  text: string;
  blanks: BlankItem[];
  onComplete: (result: ModeProgress) => void;
}

interface BlankState {
  value: string;
  validated: boolean;
  result: ValidationResult | null;
  showHint: boolean;
}

export function FillBlank({ text, blanks, onComplete }: FillBlankProps) {
  const [blankStates, setBlankStates] = useState<Map<string, BlankState>>(new Map());
  const [startTime] = useState(Date.now());
  const [isCompleted, setIsCompleted] = useState(false);

  // 初始化状态
  useEffect(() => {
    const initialStates = new Map<string, BlankState>();
    blanks.forEach((blank) => {
      initialStates.set(blank.id, {
        value: '',
        validated: false,
        result: null,
        showHint: false,
      });
    });
    setBlankStates(initialStates);
  }, [blanks]);

  // 更新输入值
  const handleInputChange = useCallback((blankId: string, value: string) => {
    setBlankStates((prev) => {
      const newStates = new Map(prev);
      const current = newStates.get(blankId);
      if (current) {
        newStates.set(blankId, { ...current, value });
      }
      return newStates;
    });
  }, []);

  // 验证单个答案
  const handleValidate = useCallback((blankId: string) => {
    const blank = blanks.find((b) => b.id === blankId);
    const state = blankStates.get(blankId);
    
    if (!blank || !state) return;

    const result = validateAnswer(state.value, blank.answer);
    
    setBlankStates((prev) => {
      const newStates = new Map(prev);
      newStates.set(blankId, {
        ...state,
        validated: true,
        result,
      });
      return newStates;
    });
  }, [blanks, blankStates]);

  // 显示提示
  const handleShowHint = useCallback((blankId: string) => {
    setBlankStates((prev) => {
      const newStates = new Map(prev);
      const current = newStates.get(blankId);
      if (current) {
        newStates.set(blankId, { ...current, showHint: true });
      }
      return newStates;
    });
  }, []);

  // 提交所有答案
  const handleSubmitAll = useCallback(() => {
    let correctCount = 0;
    const newStates = new Map(blankStates);

    blanks.forEach((blank) => {
      const state = blankStates.get(blank.id);
      if (state) {
        const result = validateAnswer(state.value, blank.answer);
        newStates.set(blank.id, {
          ...state,
          validated: true,
          result,
        });
        if (result.isCorrect) {
          correctCount++;
        }
      }
    });

    setBlankStates(newStates);
    setIsCompleted(true);

    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    onComplete({
      total: blanks.length,
      completed: blanks.length,
      correct: correctCount,
      timeSpent,
    });
  }, [blanks, blankStates, startTime, onComplete]);

  // 渲染文本和输入框
  const renderContent = () => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let blankIndex = 0;

    // 使用正则匹配占位符
    const regex = /___(\d+)___/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // 添加占位符前的文本
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.substring(lastIndex, match.index)}
          </span>
        );
      }

      // 添加输入框
      const blank = blanks[blankIndex];
      if (blank) {
        const state = blankStates.get(blank.id);
        parts.push(
          <BlankInput
            key={blank.id}
            blank={blank}
            state={state}
            onInputChange={handleInputChange}
            onValidate={handleValidate}
            onShowHint={handleShowHint}
            disabled={isCompleted}
          />
        );
      }

      lastIndex = match.index + match[0].length;
      blankIndex++;
    }

    // 添加剩余文本
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  // 计算进度
  const validatedCount = Array.from(blankStates.values()).filter((s) => s.validated).length;
  const correctCount = Array.from(blankStates.values()).filter((s) => s.result?.isCorrect).length;

  return (
    <div className="fill-blank-container p-4">
      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          进度: {validatedCount}/{blanks.length} | 正确: {correctCount}
        </div>
        {!isCompleted && (
          <button
            onClick={handleSubmitAll}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            提交全部
          </button>
        )}
      </div>

      <div className="text-lg leading-relaxed text-gray-800 dark:text-gray-200">
        {renderContent()}
      </div>

      {isCompleted && (
        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h3 className="font-bold text-lg mb-2">练习完成！</h3>
          <p>
            正确率: {blanks.length > 0 ? Math.round((correctCount / blanks.length) * 100) : 0}%
          </p>
        </div>
      )}
    </div>
  );
}

// 单个挖空输入组件
interface BlankInputProps {
  blank: BlankItem;
  state: BlankState | undefined;
  onInputChange: (id: string, value: string) => void;
  onValidate: (id: string) => void;
  onShowHint: (id: string) => void;
  disabled: boolean;
}

function BlankInput({
  blank,
  state,
  onInputChange,
  onValidate,
  onShowHint,
  disabled,
}: BlankInputProps) {
  const value = state?.value || '';
  const validated = state?.validated || false;
  const result = state?.result;
  const showHint = state?.showHint || false;

  // 判断是否接近正确
  const isClose = !validated && value.length > 0 && isCloseAnswer(value, blank.answer);

  // 输入框样式
  let inputClass = 'inline-block mx-1 px-2 py-1 border-b-2 bg-transparent text-center min-w-[80px] focus:outline-none transition-colors ';
  
  if (validated) {
    inputClass += result?.isCorrect
      ? 'border-green-500 text-green-600 dark:text-green-400'
      : 'border-red-500 text-red-600 dark:text-red-400';
  } else if (isClose) {
    inputClass += 'border-yellow-500';
  } else {
    inputClass += 'border-gray-400 dark:border-gray-600 focus:border-primary-500';
  }

  return (
    <span className="inline-flex flex-col items-center">
      <input
        type="text"
        value={value}
        onChange={(e) => onInputChange(blank.id, e.target.value)}
        onBlur={() => !validated && value && onValidate(blank.id)}
        onKeyDown={(e) => e.key === 'Enter' && !validated && onValidate(blank.id)}
        className={inputClass}
        style={{ width: `${Math.max(80, blank.answer.length * 16)}px` }}
        disabled={disabled || validated}
        placeholder={showHint ? generateHint(blank.answer) : '___'}
      />
      {!validated && !showHint && blank.hint && (
        <button
          onClick={() => onShowHint(blank.id)}
          className="text-xs text-gray-500 hover:text-primary-500 mt-1"
        >
          提示
        </button>
      )}
      {validated && !result?.isCorrect && (
        <span className="text-xs text-red-500 mt-1">
          {blank.answer}
        </span>
      )}
    </span>
  );
}

export default FillBlank;
