import { create } from 'zustand';

interface UserState {
  userId: string;
  isOnboarded: boolean;
  setUserId: (id: string) => void;
  setOnboarded: (value: boolean) => void;
}

export const useUserStore = create<UserState>((set) => ({
  userId: 'default_user',
  isOnboarded: false,
  setUserId: (id) => set({ userId: id }),
  setOnboarded: (value) => set({ isOnboarded: value }),
}));
