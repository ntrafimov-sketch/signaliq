import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

interface AuthState {
  users: User[];
  currentUser: User | null;
  isAuthenticated: boolean;
  register: (name: string, email: string, password: string) => void;
  login: (email: string, password: string) => void;
  logout: () => void;
}

const SALT = 'signaliq_salt_2024';

function hashPassword(password: string): string {
  return btoa(password + SALT);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: [],
      currentUser: null,
      isAuthenticated: false,

      register: (name: string, email: string, password: string) => {
        const { users } = get();
        if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
          throw new Error('An account with this email already exists.');
        }
        const newUser: User = {
          id: `u-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name,
          email,
          passwordHash: hashPassword(password),
          createdAt: new Date().toISOString(),
        };
        set({ users: [...users, newUser], currentUser: newUser, isAuthenticated: true });
      },

      login: (email: string, password: string) => {
        const { users } = get();
        const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) {
          throw new Error('No account found with this email.');
        }
        if (user.passwordHash !== hashPassword(password)) {
          throw new Error('Incorrect password.');
        }
        set({ currentUser: user, isAuthenticated: true });
      },

      logout: () => {
        set({ currentUser: null, isAuthenticated: false });
      },
    }),
    {
      name: 'signaliq-auth',
    }
  )
);
