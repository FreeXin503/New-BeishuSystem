import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ParsedContent, ReviewCard, StudySession } from '../types';

interface ContentState {
  contents: ParsedContent[];
  currentContent: ParsedContent | null;
  reviewCards: ReviewCard[];
  studySessions: StudySession[];
  isLoading: boolean;
  error: string | null;
  
  // Content actions
  addContent: (content: ParsedContent) => void;
  updateContent: (id: string, content: Partial<ParsedContent>) => void;
  deleteContent: (id: string) => void;
  setCurrentContent: (content: ParsedContent | null) => void;
  
  // Review card actions
  addReviewCard: (card: ReviewCard) => void;
  updateReviewCard: (id: string, card: Partial<ReviewCard>) => void;
  deleteReviewCard: (id: string) => void;
  
  // Study session actions
  addStudySession: (session: StudySession) => void;
  updateStudySession: (id: string, session: Partial<StudySession>) => void;
  
  // State actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearAll: () => void;
}

export const useContentStore = create<ContentState>()(
  persist(
    (set) => ({
      contents: [],
      currentContent: null,
      reviewCards: [],
      studySessions: [],
      isLoading: false,
      error: null,

      // Content actions
      addContent: (content) =>
        set((state) => ({
          contents: [...state.contents, content],
        })),
      updateContent: (id, updates) =>
        set((state) => ({
          contents: state.contents.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
          ),
        })),
      deleteContent: (id) =>
        set((state) => ({
          contents: state.contents.filter((c) => c.id !== id),
          reviewCards: state.reviewCards.filter((r) => r.contentId !== id),
        })),
      setCurrentContent: (content) => set({ currentContent: content }),

      // Review card actions
      addReviewCard: (card) =>
        set((state) => ({
          reviewCards: [...state.reviewCards, card],
        })),
      updateReviewCard: (id, updates) =>
        set((state) => ({
          reviewCards: state.reviewCards.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),
      deleteReviewCard: (id) =>
        set((state) => ({
          reviewCards: state.reviewCards.filter((r) => r.id !== id),
        })),

      // Study session actions
      addStudySession: (session) =>
        set((state) => ({
          studySessions: [...state.studySessions, session],
        })),
      updateStudySession: (id, updates) =>
        set((state) => ({
          studySessions: state.studySessions.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),

      // State actions
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      clearAll: () =>
        set({
          contents: [],
          currentContent: null,
          reviewCards: [],
          studySessions: [],
          error: null,
        }),
    }),
    {
      name: 'content-storage',
      partialize: (state) => ({
        contents: state.contents,
        reviewCards: state.reviewCards,
        studySessions: state.studySessions,
      }),
    }
  )
);
