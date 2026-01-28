'use client';

import { create } from 'zustand';

interface ModalState {
  isOpen: boolean;
  title?: string;
  content?: React.ReactNode;
}

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  // Modal
  modal: ModalState;

  // Toast (sonner와 함께 사용)
  toastQueue: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  }>;

  // Loading States
  globalLoading: boolean;
  loadingMessage: string | null;

  // Theme (추후 다크모드 지원)
  theme: 'light' | 'dark' | 'system';

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  openModal: (title: string, content?: React.ReactNode) => void;
  closeModal: () => void;

  addToast: (
    type: 'success' | 'error' | 'info' | 'warning',
    message: string
  ) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  setGlobalLoading: (loading: boolean, message?: string) => void;

  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  reset: () => void;
}

const initialState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  modal: { isOpen: false },
  toastQueue: [] as UIState['toastQueue'],
  globalLoading: false,
  loadingMessage: null,
  theme: 'system' as const,
};

export const useUIStore = create<UIState>()((set, _get) => ({
  ...initialState,

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  openModal: (title, content) =>
    set({
      modal: { isOpen: true, title, content },
    }),

  closeModal: () =>
    set({
      modal: { isOpen: false },
    }),

  addToast: (type, message) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((state) => ({
      toastQueue: [...state.toastQueue, { id, type, message }],
    }));
    return id;
  },

  removeToast: (id) =>
    set((state) => ({
      toastQueue: state.toastQueue.filter((t) => t.id !== id),
    })),

  clearToasts: () => set({ toastQueue: [] }),

  setGlobalLoading: (globalLoading, loadingMessage = undefined) =>
    set({ globalLoading, loadingMessage }),

  setTheme: (theme) => set({ theme }),

  reset: () => set(initialState),
}));
