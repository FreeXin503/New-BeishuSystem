/**
 * 语音朗读服务
 * 封装 Web Speech API
 */

export interface SpeechState {
  isPlaying: boolean;
  isPaused: boolean;
  currentPosition: number;
  rate: number;
}

let currentUtterance: SpeechSynthesisUtterance | null = null;
let onProgressCallback: ((position: number) => void) | null = null;

/**
 * 检查浏览器是否支持语音合成
 */
export function isSpeechSupported(): boolean {
  return 'speechSynthesis' in window;
}

/**
 * 获取可用的语音列表
 */
export function getVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];
  return speechSynthesis.getVoices();
}

/**
 * 获取中文语音
 */
export function getChineseVoice(): SpeechSynthesisVoice | null {
  const voices = getVoices();
  return (
    voices.find((v) => v.lang.startsWith('zh')) ||
    voices.find((v) => v.lang.startsWith('cmn')) ||
    null
  );
}

/**
 * 开始朗读
 */
export function speak(
  text: string,
  options: {
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: SpeechSynthesisVoice;
    onProgress?: (position: number) => void;
    onEnd?: () => void;
    onError?: (error: Error) => void;
  } = {}
): void {
  if (!isSpeechSupported()) {
    options.onError?.(new Error('浏览器不支持语音合成'));
    return;
  }

  // 停止当前朗读
  stop();

  const utterance = new SpeechSynthesisUtterance(text);
  
  // 设置参数
  utterance.rate = options.rate ?? 1;
  utterance.pitch = options.pitch ?? 1;
  utterance.volume = options.volume ?? 1;
  
  if (options.voice) {
    utterance.voice = options.voice;
  } else {
    const chineseVoice = getChineseVoice();
    if (chineseVoice) {
      utterance.voice = chineseVoice;
    }
  }

  // 事件处理
  utterance.onboundary = (event) => {
    if (event.name === 'word') {
      options.onProgress?.(event.charIndex);
      onProgressCallback?.(event.charIndex);
    }
  };

  utterance.onend = () => {
    currentUtterance = null;
    options.onEnd?.();
  };

  utterance.onerror = (event) => {
    currentUtterance = null;
    options.onError?.(new Error(event.error));
  };

  currentUtterance = utterance;
  onProgressCallback = options.onProgress || null;
  
  speechSynthesis.speak(utterance);
}

/**
 * 暂停朗读
 */
export function pause(): void {
  if (isSpeechSupported() && speechSynthesis.speaking) {
    speechSynthesis.pause();
  }
}

/**
 * 继续朗读
 */
export function resume(): void {
  if (isSpeechSupported() && speechSynthesis.paused) {
    speechSynthesis.resume();
  }
}

/**
 * 停止朗读
 */
export function stop(): void {
  if (isSpeechSupported()) {
    speechSynthesis.cancel();
    currentUtterance = null;
    onProgressCallback = null;
  }
}

/**
 * 获取当前状态
 */
export function getState(): SpeechState {
  if (!isSpeechSupported()) {
    return {
      isPlaying: false,
      isPaused: false,
      currentPosition: 0,
      rate: 1,
    };
  }

  return {
    isPlaying: speechSynthesis.speaking && !speechSynthesis.paused,
    isPaused: speechSynthesis.paused,
    currentPosition: 0, // Web Speech API 不提供精确位置
    rate: currentUtterance?.rate ?? 1,
  };
}

/**
 * 设置语速
 */
export function setRate(rate: number): void {
  if (currentUtterance) {
    // 需要重新开始才能改变语速
    const text = currentUtterance.text;
    stop();
    speak(text, { rate });
  }
}

/**
 * 切换播放/暂停
 */
export function togglePlayPause(): void {
  if (!isSpeechSupported()) return;

  if (speechSynthesis.paused) {
    resume();
  } else if (speechSynthesis.speaking) {
    pause();
  }
}
