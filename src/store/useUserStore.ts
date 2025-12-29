import { create } from 'zustand';
import { api } from '@/lib/api';
import type { UserProfile, TeamProfile } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
interface UserState {
  profile: UserProfile | null;
  teams: TeamProfile[];
  isLoading: boolean;
  error: string | null;
  // Actions
  initUser: (username?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  createTeam: (name: string) => Promise<void>;
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
  teams: [],
  isLoading: false,
  error: null,
  initUser: async (username = 'Player') => {
    set({ isLoading: true, error: null });
    try {
      const userId = getStoredUserId();
      const profile = await api.getProfile(userId, username);
      // Fetch teams
      let teams: TeamProfile[] = [];
      if (profile.teams && profile.teams.length > 0) {
          teams = await api.getUserTeams(userId);
      }
      set({ profile, teams, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  refreshProfile: async () => {
    const { profile } = get();
    if (!profile) return;
    await get().initUser(profile.username);
  },
  createTeam: async (name: string) => {
      const { profile } = get();
      if (!profile) return;
      set({ isLoading: true });
      try {
          const newTeam = await api.createTeam(name, profile.id);
          set(state => ({
              teams: [...state.teams, newTeam],
              isLoading: false
          }));
          // Refresh profile to get updated team list ID reference
          await get().refreshProfile();
      } catch (err) {
          set({ error: (err as Error).message, isLoading: false });
      }
  }
}));