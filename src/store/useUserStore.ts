import { create } from 'zustand';
import { UserProfile, TeamProfile, AuthPayload } from '@shared/types';
import { api } from '@/lib/api';
interface UserState {
  profile: UserProfile | null;
  teams: TeamProfile[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  initUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  login: (payload: AuthPayload) => Promise<void>;
  signup: (payload: AuthPayload) => Promise<void>;
  logout: () => void;
  createTeam: (name: string) => Promise<void>;
}
export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  teams: [],
  isAuthenticated: false,
  isLoading: false,
  error: null,
  initUser: async () => {
    const storedId = localStorage.getItem('kickstar_user_id');
    if (storedId) {
      set({ isLoading: true });
      try {
        const profile = await api.getProfile(storedId, 'Player');
        const teams = await api.getUserTeams(storedId);
        set({ profile, teams, isAuthenticated: !!profile.email, isLoading: false });
      } catch (e) {
        console.error('Failed to init user', e);
        set({ isLoading: false });
      }
    }
  },
  refreshProfile: async () => {
    const { profile } = get();
    if (profile) {
      try {
        const newProfile = await api.getProfile(profile.id, profile.username);
        const teams = await api.getUserTeams(profile.id);
        set({ profile: newProfile, teams });
      } catch (e) {
        console.error('Failed to refresh profile', e);
      }
    }
  },
  login: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const { userId, profile } = await api.auth.login(payload);
      localStorage.setItem('kickstar_user_id', userId);
      const teams = await api.getUserTeams(userId);
      set({ profile, teams, isAuthenticated: true, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },
  signup: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const { userId, profile } = await api.auth.signup(payload);
      localStorage.setItem('kickstar_user_id', userId);
      const teams = await api.getUserTeams(userId);
      set({ profile, teams, isAuthenticated: true, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },
  logout: () => {
    localStorage.removeItem('kickstar_user_id');
    set({ profile: null, teams: [], isAuthenticated: false });
  },
  createTeam: async (name) => {
    const { profile } = get();
    if (!profile) return;
    set({ isLoading: true });
    try {
      await api.createTeam(name, profile.id);
      await get().refreshProfile();
      set({ isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  }
}));