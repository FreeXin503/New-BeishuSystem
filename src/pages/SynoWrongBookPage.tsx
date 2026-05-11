import { useMemo, useState } from "react";
import { AppLayout } from "../components/layout";
import { useToast } from "../components/ui";
import type { Question } from "../types";

const SYNO_WRONGBOOK_KEY = "synomaster_local_wrongbook";

type SynoWrongBookItem = {
  id: string;
  question: Question;
  userAnswer: string;
  wrongCount: number;
  updatedAt: string;
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

export default function SynoWrongBookPage() {
  const toast = useToast();
  const [wrongBook] = useState<SynoWrongBookItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SYNO_WRONGBOOK_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const [queue, setQueue] = useState<Question[]>(() => wrongBook.map((f) => f.question));
  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState<Question | null>(() => (wrongBook[0] ? wrongBook[0].question : null));
  const [choice, setChoice] = useState<string | null>(null);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [reveal, setReveal] = useState(false);

  const reviewMode: ReviewMode | null = question ? detectReviewMode(question) : null;

  const statsText = useMemo(() => "共 " + wrongBook.length + " 条错题", [wrongBook.length]);

  const resetReview = () => {
    setQueue(wrongBook.map((f) => f.question));
    setIndex(0);
    setQuestion(wrongBook[0]?.question ?? null);
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

  return (
    <AppLayout title="SynoMaster 错题本">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-4 text-sm text-gray-600">{statsText}</div>
        {question ? (
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
                重置复习
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">暂无错题</div>
        )}
      </div>
    </AppLayout>
  );
}
