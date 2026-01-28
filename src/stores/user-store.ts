'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  plan: 'starter' | 'pro' | 'team' | 'enterprise';
  dailyGenerationsRemaining: number;
  dailyResetAt: string | null;
}

interface UserState {
  // State
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setProfile: (profile: UserProfile | null) => void;
  updateGenerationsRemaining: (remaining: number) => void;
  decrementGenerations: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  profile: null,
  isLoading: false,
  error: null,
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      ...initialState,

      setProfile: (profile) => set({ profile, error: null }),

      updateGenerationsRemaining: (remaining) =>
        set((state) => ({
          profile: state.profile
            ? { ...state.profile, dailyGenerationsRemaining: remaining }
            : null,
        })),

      decrementGenerations: () =>
        set((state) => ({
          profile: state.profile
            ? {
                ...state.profile,
                dailyGenerationsRemaining: Math.max(
                  0,
                  state.profile.dailyGenerationsRemaining - 1
                ),
              }
            : null,
        })),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      reset: () => set(initialState),
    }),
    {
      name: 'codegen-user-store',
      partialize: (state) => ({
        profile: state.profile,
      }),
    }
  )
);
