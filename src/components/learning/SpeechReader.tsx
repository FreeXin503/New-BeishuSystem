/**
 * 语音朗读组件
 */

import { useState, useCallback, useEffect } from 'react';
import type { ModeProgress } from '../../types';
import {
  speak,
  pause,
  resume,
  stop,
  isSpeechSupported,
} from '../../services/learning/speech';

interface SpeechReaderProps {
  content: string;
  onProgress?: (position: number) => void;
  onComplete?: () => void;
  onStudyComplete?: (result: ModeProgress) => void;
}

export function SpeechReader({ content, onProgress, onComplete, onStudyComplete }: SpeechReaderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [isSupported] = useState(isSpeechSupported());
  const [startTime] = useState(Date.now());

  // 清理
  useEffect(() => {
    return () => {
      stop();
      if (onStudyComplete) {
        const timeSpent = Date.now() - startTime;
        const result: ModeProgress = {
          total: 1,
          completed: currentPosition > 0 ? 1 : 0,
          correct: currentPosition > 0 ? 1 : 0,
          timeSpent,
        };
        onStudyComplete(result);
      }
    };
  }, [startTime, currentPosition, onStudyComplete]);

  // 开始/继续朗读
  const handlePlay = useCallback(() => {
    if (isPaused) {
      resume();
      setIsPaused(false);
      setIsPlaying(true);
    } else {
      speak(content, {
        rate,
        onProgress: (pos) => {
          setCurrentPosition(pos);
          onProgress?.(pos);
        },
        onEnd: () => {
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentPosition(0);
          onComplete?.();
        },
        onError: (error) => {
          console.error('Speech error:', error);
          setIsPlaying(false);
          setIsPaused(false);
        },
      });
      setIsPlaying(true);
    }
  }, [content, rate, isPaused, onProgress, onComplete]);

  // 暂停
  const handlePause = useCallback(() => {
    pause();
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  // 停止
  const handleStop = useCallback(() => {
    stop();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentPosition(0);
  }, []);

  // 调整语速
  const handleRateChange = useCallback((newRate: number) => {
    setRate(newRate);
    if (isPlaying) {
      // 重新开始以应用新语速
      stop();
      speak(content, {
        rate: newRate,
        onProgress: (pos) => {
          setCurrentPosition(pos);
          onProgress?.(pos);
        },
        onEnd: () => {
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentPosition(0);
        },
      });
    }
  }, [content, isPlaying, onProgress]);

  if (!isSupported) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-700 dark:text-yellow-300">
        您的浏览器不支持语音朗读功能
      </div>
    );
  }

  // 计算进度百分比
  const progress = content.length > 0 ? (currentPosition / content.length) * 100 : 0;

  return (
    <div className="speech-reader p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* 进度条 */}
      <div className="mb-4">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-primary-500 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center justify-center gap-4">
        {/* 停止按钮 */}
        <button
          onClick={handleStop}
          disabled={!isPlaying && !isPaused}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="停止"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <rect x="6" y="6" width="8" height="8" />
          </svg>
        </button>

        {/* 播放/暂停按钮 */}
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          className="p-3 rounded-full bg-primary-500 text-white hover:bg-primary-600 transition-colors"
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <rect x="5" y="4" width="4" height="12" />
              <rect x="11" y="4" width="4" height="12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 4l10 6-10 6V4z" />
            </svg>
          )}
        </button>
      </div>

      {/* 语速控制 */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">语速:</span>
        <div className="flex gap-1">
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
            <button
              key={r}
              onClick={() => handleRateChange(r)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                rate === r
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {r}x
            </button>
          ))}
        </div>
      </div>

      {/* 状态显示 */}
      <div className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
        {isPlaying ? '正在朗读...' : isPaused ? '已暂停' : '点击播放开始朗读'}
      </div>
    </div>
  );
}

export default SpeechReader;
