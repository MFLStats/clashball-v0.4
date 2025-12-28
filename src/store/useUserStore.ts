import { create } from 'zustand';
import { api } from '@/lib/api';
import type { UserProfile } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  // Actions
  initUser: (username?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}
const getStoredUserId = () => {
  let id = localStorage.getItem('kickstar_user_id');
  if (!id) {
    id = uuidv4();
    localStorage.setItem('kickstar_user_id', id);
  }
  return id;
};
export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,
  initUser: async (username = 'Player') => {
    set({ isLoading: true, error: null });
    try {
      const userId = getStoredUserId();
      const profile = await api.getProfile(userId, username);
      set({ profile, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  refreshProfile: async () => {
    const { profile } = get();
    if (!profile) return;
    await get().initUser(profile.username);
  }
}));