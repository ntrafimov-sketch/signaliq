import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Account, Signal, List, ApiKeys } from '../types';

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl?: string;
  password?: string;
}


interface AppState {
  accounts: Account[];
  lists: List[];
  apiKeys: ApiKeys;
  profile: UserProfile;
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
  setProfile: (profile: Partial<UserProfile>) => void;

  setUploading: (uploading: boolean) => void;
  setUploadSuccess: (result: { count: number; duration: number } | null) => void;

  addSignalsToAccount: (accountId: string, signals: Signal[]) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      accounts: [],
      lists: [],
      profile: { name: 'Nikita Trafimov', email: 'ntrafimov@adapty.io' },
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
      setProfile: (profile) =>
        set((state) => ({
          profile: { ...state.profile, ...profile },
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
        // Strip heavy fields before persisting to localStorage to avoid quota errors.
        // torpedoData, revenueHistory, downloadHistory, people, news, paywallScreenshot
        // are all stored on Railway and reloaded via WebSocket on connect.
        accounts: state.accounts.map(a => ({
          ...a,
          // Strip heavy fields — all stored on Railway, reloaded via WebSocket on connect
          torpedoData: undefined,
          paywallScreenshot: undefined,
          people: undefined,
          news: undefined,
          revenueHistory: undefined,
          downloadHistory: undefined,
          adIntelligence: undefined,
          orgChart: undefined,
          investmentHistory: undefined,
          departmentIntel: undefined,
          paywallAnalysis: undefined,
          products: undefined,
        })),
        apiKeys: state.apiKeys,
        profile: state.profile,
        lists: state.lists,
      }),
    }
  )
);
