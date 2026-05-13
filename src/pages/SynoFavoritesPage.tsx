import { useMemo, useState } from "react";
import { AppLayout } from "../components/layout";
import { useToast } from "../components/ui";
import type { Question } from "../types";

const SYNO_FAVORITES_KEY = "synomaster_local_favorites";

type SynoFavoriteItem = {
  id: string;
  question: Question;
  createdAt: string;
};

type ReviewMode = "clustering" | "reverse" | "sorting";

const practiceWordCard =
  "rounded-2xl border bg-white px-6 py-4 text-base font-semibold text-gray-800 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md md:text-lg";
const practiceWrapper = "rounded-2xl border bg-white px-6 py-8";

const detectReviewMode = (question: Question): ReviewMode => {
  if (question.id.includes("synomaster-clustering-")) return "clustering";
  if (question.id.includes("synomaster-sorting-")) return "sorting";
  return "reverse";
};

const isChoiceCorrect = (question: Question, choice: string) => {
  const correctParts = question.correctAnswer
    .split(/[、，,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return correctParts.includes(choice) || choice === question.correctAnswer;
};

export default function SynoFavoritesPage() {
  const toast = useToast();
  const [favorites] = useState<SynoFavoriteItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SYNO_FAVORITES_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const [showModeSelector, setShowModeSelector] = useState(true);
  const [selectedMode, setSelectedMode] = useState<ReviewMode | null>(null);
  const [queue, setQueue] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [reveal, setReveal] = useState(false);

  const reviewMode: ReviewMode | null = question ? detectReviewMode(question) : null;

  const filteredFavorites = useMemo(() => {
    if (!selectedMode) return favorites;
    return favorites.filter((f) => {
      const mode = detectReviewMode(f.question);
      return mode === selectedMode;
    });
  }, [favorites, selectedMode]);

  const statsText = useMemo(() => {
    if (!selectedMode) return "共 " + favorites.length + " 条收藏";
    const modeNames: Record<ReviewMode, string> = {
      clustering: "同义词聚类",
      reverse: "反向选择",
      sorting: "态度倾向",
    };
    return `${modeNames[selectedMode]}: ${filteredFavorites.length} 条收藏`;
  }, [favorites.length, selectedMode, filteredFavorites.length]);

  const selectMode = (mode: ReviewMode) => {
    setSelectedMode(mode);
    const filtered = favorites.filter((f) => detectReviewMode(f.question) === mode);
    if (filtered.length === 0) {
      toast.warning(`该模式暂无收藏题目`);
      return;
    }
    setQueue(filtered.map((f) => f.question));
    setIndex(0);
    setQuestion(filtered[0]?.question ?? null);
    setShowModeSelector(false);
  };

  const resetReview = () => {
    setShowModeSelector(true);
    setSelectedMode(null);
    setQueue([]);
    setIndex(0);
    setQuestion(null);
    setChoice(null);
    setReveal(false);
    setSelectedWords(new Set());
  };

  const onMultiToggle = (word: string) => {
    if (!question || reveal) return;
    const next = new Set(selectedWords);
    if (next.has(word)) next.delete(word);
    else next.add(word);
    setSelectedWords(next);
  };

  const submit = (answer: string | null) => {
    if (!question || reveal) return;
    if (reviewMode === "clustering") {
      const correctSet = new Set(question.correctAnswer.split(/[、，,\s]+/).filter(Boolean));
      const userSet = new Set(selectedWords);
      const ok = userSet.size === correctSet.size && Array.from(userSet).every((w) => correctSet.has(w));
      setReveal(true);
      setChoice(answer);
      if (ok) toast.success("回答正确");
      else toast.error("正确答案：" + question.correctAnswer);
      return;
    }
    if (answer === null) return;
    const ok = isChoiceCorrect(question, answer);
    setChoice(answer);
    setReveal(true);
    if (ok) toast.success("回答正确");
    else toast.error("正确答案：" + question.correctAnswer);
  };

  const next = () => {
    const nextIdx = index + 1;
    if (nextIdx >= queue.length) {
      toast.info("已全部复习完毕");
      return;
    }
    setIndex(nextIdx);
    setQuestion(queue[nextIdx]);
    setChoice(null);
    setReveal(false);
    setSelectedWords(new Set());
  };

  // 统计各模式的收藏数量
  const modeStats = useMemo(() => {
    const stats = { clustering: 0, reverse: 0, sorting: 0 };
    favorites.forEach((f) => {
      const mode = detectReviewMode(f.question);
      stats[mode]++;
    });
    return stats;
  }, [favorites]);

  return (
    <AppLayout title="SynoMaster 收藏夹">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {showModeSelector ? (
          <div className={practiceWrapper}>
            <div className="mb-4 text-sm text-gray-600">{statsText}</div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 md:text-3xl">选择复习模式</div>
              <div className="mt-2 text-sm text-gray-500 md:text-base">请选择要复习的收藏题目模式</div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <button
                className={`${practiceWordCard} text-center ${
                  modeStats.clustering === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-50"
                }`}
                onClick={() => selectMode("clustering")}
                disabled={modeStats.clustering === 0}
              >
                <div className="text-xl font-bold text-gray-900">同义词聚类</div>
                <div className="mt-1 text-sm text-gray-500">找出所有相关的同义词</div>
                <div className="mt-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
                  {modeStats.clustering} 题
                </div>
              </button>

              <button
                className={`${practiceWordCard} text-center ${
                  modeStats.reverse === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-50"
                }`}
                onClick={() => selectMode("reverse")}
                disabled={modeStats.reverse === 0}
              >
                <div className="text-xl font-bold text-gray-900">反向选择</div>
                <div className="mt-1 text-sm text-gray-500">根据单词选择正确释义</div>
                <div className="mt-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
                  {modeStats.reverse} 题
                </div>
              </button>

              <button
                className={`${practiceWordCard} text-center ${
                  modeStats.sorting === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-50"
                }`}
                onClick={() => selectMode("sorting")}
                disabled={modeStats.sorting === 0}
              >
                <div className="text-xl font-bold text-gray-900">态度倾向</div>
                <div className="mt-1 text-sm text-gray-500">判断单词的态度倾向</div>
                <div className="mt-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
                  {modeStats.sorting} 题
                </div>
              </button>
            </div>
          </div>
        ) : question ? (
          <div className={practiceWrapper}>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 md:text-3xl">{question.question}</div>
              <div className="mt-2 text-sm text-gray-500 md:text-base">
                {reviewMode === "clustering" ? "按聚类模式选择所有同义词后提交" : "请选择正确答案"}
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {question.options.map((option) => (
                <button
                  key={option}
                  className={`${practiceWordCard} text-left hover:bg-blue-50 ${
                    reviewMode === "clustering"
                      ? selectedWords.has(option)
                        ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                        : ""
                      : choice === option
                      ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                        : ""
                  }`}
                  onClick={() => (reviewMode === "clustering" ? onMultiToggle(option) : submit(option))}
                  disabled={reveal}
                >
                  {option}
                </button>
              ))}
            </div>

            {reveal && (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
                正确答案：{question.correctAnswer}
              </div>
            )}

            <div className="mt-6 flex justify-center gap-3">
              {reviewMode === "clustering" && (
                <button
                  className="rounded-full border border-emerald-300 bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                  onClick={() => submit(null)}
                  disabled={reveal}
                >
                  提交答案
                </button>
              )}
              <button
                className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 md:text-base disabled:opacity-50"
                onClick={next}
                disabled={!reveal}
              >
                下一题
              </button>
              <button
                className="rounded-full border border-gray-300 bg-white px-5 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={resetReview}
              >
                返回选择
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">暂无收藏</div>
        )}
      </div>
    </AppLayout>
  );
}
