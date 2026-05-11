/**
 * 术语配对学习组件
 */

import { useState, useCallback, useEffect } from 'react';
import type { MatchPair, ModeProgress } from '../../types';
import {
  shufflePairs,
  validateAllMatches,
  addMatch,
  removeMatch,
} from '../../services/learning/matching';

interface MatchingProps {
  pairs: MatchPair[];
  onComplete: (result: ModeProgress) => void;
}

export function Matching({ pairs, onComplete }: MatchingProps) {
  const [shuffled, setShuffled] = useState<ReturnType<typeof shufflePairs> | null>(null);
  const [userMatches, setUserMatches] = useState<Map<string, string>>(new Map());
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [startTime] = useState(Date.now());

  // 初始化打乱顺序
  useEffect(() => {
    setShuffled(shufflePairs(pairs));
  }, [pairs]);

  // 选择术语
  const handleSelectTerm = useCallback((termId: string) => {
    if (showResults) return;
    
    if (userMatches.has(termId)) {
      // 取消已配对的术语
      setUserMatches((prev) => removeMatch(prev, termId));
    } else {
      setSelectedTerm(termId);
    }
  }, [showResults, userMatches]);

  // 选择定义
  const handleSelectDefinition = useCallback((definitionId: string) => {
    if (showResults || !selectedTerm) return;

    // 检查定义是否已被使用
    const isUsed = Array.from(userMatches.values()).includes(definitionId);
    if (isUsed) return;

    setUserMatches((prev) => addMatch(prev, selectedTerm, definitionId));
    setSelectedTerm(null);
  }, [showResults, selectedTerm, userMatches]);

  // 提交答案
  const handleSubmit = useCallback(() => {
    if (userMatches.size !== pairs.length) return;

    setShowResults(true);
    const result = validateAllMatches(userMatches, pairs);
    const timeSpent = Math.round((Date.now() - startTime) / 1000);

    onComplete({
      total: pairs.length,
      completed: pairs.length,
      correct: result.correctCount,
      timeSpent,
    });
  }, [userMatches, pairs, startTime, onComplete]);

  // 重置
  const handleReset = useCallback(() => {
    setUserMatches(new Map());
    setSelectedTerm(null);
    setShowResults(false);
    setShuffled(shufflePairs(pairs));
  }, [pairs]);

  if (!shuffled) return null;

  const validationResult = showResults ? validateAllMatches(userMatches, pairs) : null;

  return (
    <div className="matching-container p-4">
      {/* 进度 */}
      <div className="mb-4 flex justify-between items-center">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          已配对: {userMatches.size}/{pairs.length}
        </span>
        {showResults && (
          <span className="text-sm font-medium">
            正确: {validationResult?.correctCount}/{pairs.length}
          </span>
        )}
      </div>

      {/* 配对区域 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 术语列 */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">术语</h4>
          {shuffled.terms.map(({ id, term }) => {
            const isMatched = userMatches.has(id);
            const isSelected = selectedTerm === id;
            const matchedDefId = userMatches.get(id);
            const isCorrect = showResults && matchedDefId === id;
            const isWrong = showResults && isMatched && matchedDefId !== id;

            let className = 'w-full p-3 rounded-lg border-2 text-left transition-all ';
            
            if (showResults) {
              if (isCorrect) {
                className += 'border-green-500 bg-green-50 dark:bg-green-900/20';
              } else if (isWrong) {
                className += 'border-red-500 bg-red-50 dark:bg-red-900/20';
              } else {
                className += 'border-gray-200 dark:border-gray-700';
              }
            } else if (isSelected) {
              className += 'border-primary-500 bg-primary-50 dark:bg-primary-900/20';
            } else if (isMatched) {
              className += 'border-blue-400 bg-blue-50 dark:bg-blue-900/20';
            } else {
              className += 'border-gray-200 dark:border-gray-700 hover:border-primary-300 cursor-pointer';
            }

            return (
              <button
                key={id}
                onClick={() => handleSelectTerm(id)}
                disabled={showResults}
                className={className}
              >
                {term}
                {isMatched && !showResults && (
                  <span className="ml-2 text-blue-500">✓</span>
                )}
                {showResults && isCorrect && (
                  <span className="ml-2 text-green-500">✓</span>
                )}
                {showResults && isWrong && (
                  <span className="ml-2 text-red-500">✗</span>
                )}
              </button>
            );
          })}
        </div>

        {/* 定义列 */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">定义</h4>
          {shuffled.definitions.map(({ id, definition }) => {
            const isUsed = Array.from(userMatches.values()).includes(id);
            const canSelect = selectedTerm && !isUsed && !showResults;

            let className = 'w-full p-3 rounded-lg border-2 text-left transition-all ';
            
            if (isUsed) {
              className += 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 opacity-60';
            } else if (canSelect) {
              className += 'border-gray-200 dark:border-gray-700 hover:border-primary-300 cursor-pointer';
            } else {
              className += 'border-gray-200 dark:border-gray-700';
            }

            return (
              <button
                key={id}
                onClick={() => handleSelectDefinition(id)}
                disabled={!canSelect}
                className={className}
              >
                {definition}
              </button>
            );
          })}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          重置
        </button>
        
        {!showResults ? (
          <button
            onClick={handleSubmit}
            disabled={userMatches.size !== pairs.length}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            提交答案
          </button>
        ) : (
          <div className="text-lg font-medium">
            得分: {validationResult?.score}%
          </div>
        )}
      </div>

      {/* 提示 */}
      {selectedTerm && !showResults && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
          请选择对应的定义
        </p>
      )}
    </div>
  );
}

export default Matching;
