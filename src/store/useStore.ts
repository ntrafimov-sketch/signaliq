import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Account, Signal, List, ApiKeys } from '../types';
import { mockAccounts, mockLists } from '../data/mockData';

interface AppState {
  accounts: Account[];
  lists: List[];
  apiKeys: ApiKeys;
  isUploading: boolean;
  uploadSuccess: { count: number; duration: number } | null;

  // Actions
  setAccounts: (accounts: Account[]) => void;
  addAccounts: (accounts: Account[]) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  removeAccount: (id: string) => void;

  setLists: (lists: List[]) => void;
  addList: (list: List) => void;
  updateList: (id: string, updates: Partial<List>) => void;
  removeList: (id: string) => void;

  setApiKeys: (keys: Partial<ApiKeys>) => void;

  setUploading: (uploading: boolean) => void;
  setUploadSuccess: (result: { count: number; duration: number } | null) => void;

  addSignalsToAccount: (accountId: string, signals: Signal[]) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      accounts: mockAccounts,
      lists: mockLists,
      apiKeys: {
        amplemarket: import.meta.env.VITE_AMPLEMARKET_API_KEY || '',
        demandbase: import.meta.env.VITE_DEMANDBASE_API_KEY || '',
        appmagic: import.meta.env.VITE_APPMAGIC_API_KEY || '',
        hubspot: import.meta.env.VITE_HUBSPOT_API_KEY || '',
        hubspotPortalId: import.meta.env.VITE_HUBSPOT_PORTAL_ID || '',
      },
      isUploading: false,
      uploadSuccess: null,

      setAccounts: (accounts) => set({ accounts }),
      addAccounts: (newAccounts) =>
        set((state) => ({
          accounts: [...state.accounts, ...newAccounts],
        })),
      updateAccount: (id, updates) =>
        set((state) => ({
          accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
      removeAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
        })),

      setLists: (lists) => set({ lists }),
      addList: (list) =>
        set((state) => ({
          lists: [...state.lists, list],
        })),
      updateList: (id, updates) =>
        set((state) => ({
          lists: state.lists.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        })),
      removeList: (id) =>
        set((state) => ({
          lists: state.lists.filter((l) => l.id !== id),
        })),

      setApiKeys: (keys) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, ...keys },
        })),

      setUploading: (isUploading) => set({ isUploading }),
      setUploadSuccess: (uploadSuccess) => set({ uploadSuccess }),

      addSignalsToAccount: (accountId, signals) =>
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === accountId
              ? { ...a, signals: [...a.signals, ...signals] }
              : a
          ),
        })),
    }),
    {
      name: 'signaliq-storage',
      partialize: (state) => ({
        apiKeys: state.apiKeys,
      }),
    }
  )
);
