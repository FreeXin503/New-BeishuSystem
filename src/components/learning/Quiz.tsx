/**
 * 选择题学习组件
 */

import { useState, useCallback } from 'react';
import type { Question, ModeProgress, ValidationResult } from '../../types';
import {
  validateQuizAnswer,
  getOptionLabel,
  getScoreRating,
} from '../../services/learning/quiz';

interface QuizProps {
  questions: Question[];
  onComplete: (result: ModeProgress) => void;
}

export function Quiz({ questions, onComplete }: QuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [startTime] = useState(Date.now());
  const [isCompleted, setIsCompleted] = useState(false);

  const currentQuestion = questions[currentIndex];
  const currentResult = showResult ? results[currentIndex] : null;

  // 选择答案
  const handleSelectAnswer = useCallback((answer: string) => {
    if (showResult) return;
    setSelectedAnswer(answer);
  }, [showResult]);

  // 提交答案
  const handleSubmit = useCallback(() => {
    if (!selectedAnswer || showResult) return;

    const result = validateQuizAnswer(selectedAnswer, currentQuestion);
    setResults((prev) => {
      const newResults = [...prev];
      newResults[currentIndex] = result;
      return newResults;
    });
    setShowResult(true);
  }, [selectedAnswer, showResult, currentQuestion, currentIndex]);

  // 下一题
  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      // 完成所有题目
      setIsCompleted(true);
      const correctCount = results.filter((r) => r?.isCorrect).length;
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      
      onComplete({
        total: questions.length,
        completed: questions.length,
        correct: correctCount,
        timeSpent,
      });
    }
  }, [currentIndex, questions.length, results, startTime, onComplete]);

  // 计算统计
  const correctCount = results.filter((r) => r?.isCorrect).length;
  const answeredCount = results.filter((r) => r !== undefined).length;

  if (isCompleted) {
    const score = Math.round((correctCount / questions.length) * 100);
    const { rating, message } = getScoreRating(score);

    return (
      <div className="quiz-complete p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">测验完成！</h2>
        <div className={`text-6xl mb-4 ${
          rating === 'excellent' ? 'text-green-500' :
          rating === 'good' ? 'text-blue-500' :
          rating === 'pass' ? 'text-yellow-500' : 'text-red-500'
        }`}>
          {score}分
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
          正确: {correctCount}/{questions.length}
        </p>
        <p className="text-gray-500 dark:text-gray-500">{message}</p>
      </div>
    );
  }

  return (
    <div className="quiz-container p-4">
      {/* 进度条 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
          <span>题目 {currentIndex + 1}/{questions.length}</span>
          <span>正确: {correctCount}/{answeredCount}</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-primary-500 h-2 rounded-full transition-all"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 题目 */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
          {currentQuestion.question}
        </h3>

        {/* 选项 */}
        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === option;
            const isCorrect = option === currentQuestion.correctAnswer;
            
            let optionClass = 'w-full p-4 text-left rounded-lg border-2 transition-all ';
            
            if (showResult) {
              if (isCorrect) {
                optionClass += 'border-green-500 bg-green-50 dark:bg-green-900/20';
              } else if (isSelected && !isCorrect) {
                optionClass += 'border-red-500 bg-red-50 dark:bg-red-900/20';
              } else {
                optionClass += 'border-gray-200 dark:border-gray-700 opacity-50';
              }
            } else {
              optionClass += isSelected
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-primary-300';
            }

            return (
              <button
                key={index}
                onClick={() => handleSelectAnswer(option)}
                disabled={showResult}
                className={optionClass}
              >
                <span className="font-medium mr-2">{getOptionLabel(index)}.</span>
                {option}
                {showResult && isCorrect && (
                  <span className="ml-2 text-green-500">✓</span>
                )}
                {showResult && isSelected && !isCorrect && (
                  <span className="ml-2 text-red-500">✗</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 解析 */}
      {showResult && currentResult && (
        <div className={`p-4 rounded-lg mb-4 ${
          currentResult.isCorrect
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          <h4 className="font-medium mb-2">
            {currentResult.isCorrect ? '✓ 回答正确！' : '✗ 回答错误'}
          </h4>
          <p className="text-gray-600 dark:text-gray-400">
            {currentResult.explanation}
          </p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end">
        {!showResult ? (
          <button
            onClick={handleSubmit}
            disabled={!selectedAnswer}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            提交答案
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            {currentIndex < questions.length - 1 ? '下一题' : '查看结果'}
          </button>
        )}
      </div>
    </div>
  );
}

export default Quiz;
