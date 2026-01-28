'use client';

import { create } from 'zustand';
import type { GeneratedContent } from '@/lib/ai/schemas';
import type { SupportedLanguage, DifficultyLevel, TargetAudience } from '@/types';

export interface GenerateFormData {
  language: SupportedLanguage;
  topic: string;
  difficulty: DifficultyLevel;
  targetLevel: TargetAudience;
}

interface GenerateState {
  // Form State
  formData: GenerateFormData;

  // Generation State
  isGenerating: boolean;
  generatedContent: GeneratedContent | null;
  contentId: string | null;
  error: string | null;

  // History
  recentTopics: string[];

  // Actions
  setFormField: <K extends keyof GenerateFormData>(
    field: K,
    value: GenerateFormData[K]
  ) => void;
  setFormData: (data: Partial<GenerateFormData>) => void;
  resetForm: () => void;

  setGenerating: (isGenerating: boolean) => void;
  setGeneratedContent: (content: GeneratedContent | null, contentId?: string) => void;
  setError: (error: string | null) => void;

  addRecentTopic: (topic: string) => void;
  clearRecentTopics: () => void;

  reset: () => void;
}

const defaultFormData: GenerateFormData = {
  language: 'python',
  topic: '',
  difficulty: 'beginner',
  targetLevel: 'non_tech',
};

const initialState = {
  formData: defaultFormData,
  isGenerating: false,
  generatedContent: null,
  contentId: null,
  error: null,
  recentTopics: [] as string[],
};

export const useGenerateStore = create<GenerateState>()((set, get) => ({
  ...initialState,

  setFormField: (field, value) =>
    set((state) => ({
      formData: { ...state.formData, [field]: value },
    })),

  setFormData: (data) =>
    set((state) => ({
      formData: { ...state.formData, ...data },
    })),

  resetForm: () =>
    set({
      formData: defaultFormData,
      generatedContent: null,
      contentId: null,
      error: null,
    }),

  setGenerating: (isGenerating) => set({ isGenerating }),

  setGeneratedContent: (content, contentId) =>
    set({
      generatedContent: content,
      contentId: contentId || null,
      isGenerating: false,
      error: null,
    }),

  setError: (error) =>
    set({
      error,
      isGenerating: false,
    }),

  addRecentTopic: (topic) => {
    const { recentTopics } = get();
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) return;

    const filtered = recentTopics.filter((t) => t !== trimmedTopic);
    const updated = [trimmedTopic, ...filtered].slice(0, 10);
    set({ recentTopics: updated });
  },

  clearRecentTopics: () => set({ recentTopics: [] }),

  reset: () => set(initialState),
}));
