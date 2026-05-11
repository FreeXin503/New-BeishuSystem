import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserSettings } from '../types';

interface UserState {
  user: User | null;
  isGuest: boolean;
  isLoading: boolean;
  settings: UserSettings;
  setUser: (user: User | null) => void;
  setIsGuest: (isGuest: boolean) => void;
  setLoading: (loading: boolean) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  logout: () => void;
}

const defaultSettings: UserSettings = {
  theme: 'light',
  speechRate: 1.0,
  dailyGoal: 30,
  notificationsEnabled: true,
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isGuest: true,
      isLoading: false,
      settings: defaultSettings,
      setUser: (user) => set({ user }),
      setIsGuest: (isGuest) => set({ isGuest }),
      setLoading: (isLoading) => set({ isLoading }),
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      logout: () => set({ user: null, isGuest: true }),
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        user: state.user,
        isGuest: state.isGuest,
        settings: state.settings,
      }),
    }
  )
);
