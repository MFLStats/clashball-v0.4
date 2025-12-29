import { create } from 'zustand';
import { api } from '@/lib/api';
import type { UserProfile, TeamProfile, AuthPayload } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
interface UserState {
  profile: UserProfile | null;
  teams: TeamProfile[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  // Actions
  initUser: (username?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  createTeam: (name: string) => Promise<void>;
  // Auth Actions
  login: (payload: AuthPayload) => Promise<void>;
  signup: (payload: AuthPayload) => Promise<void>;
  logout: () => void;
}
const getStoredUserId = () => {
  return localStorage.getItem('kickstar_user_id');
};
const setStoredUserId = (id: string) => {
  localStorage.setItem('kickstar_user_id', id);
};
export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  teams: [],
  isAuthenticated: false,
  isLoading: false,
  error: null,
  initUser: async (username = 'Guest Player') => {
    set({ isLoading: true, error: null });
    try {
      let userId = getStoredUserId();
      let isAuth = false;
      // If no ID, generate one for guest
      if (!userId) {
        userId = uuidv4();
        setStoredUserId(userId);
      } else {
        // If ID exists, assume potentially auth if we have a token (simplified here to just ID presence + profile check)
        // In a real app, we'd validate a token. Here we just fetch profile.
        // We check if profile has email to determine auth status
      }
      const profile = await api.getProfile(userId, username);
      // Determine if authenticated based on profile data
      if (profile.email) {
        isAuth = true;
      }
      // Fetch teams
      let teams: TeamProfile[] = [];
      if (profile.teams && profile.teams.length > 0) {
          teams = await api.getUserTeams(userId);
      }
      set({ profile, teams, isAuthenticated: isAuth, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  refreshProfile: async () => {
    const { profile } = get();
    if (!profile) return;
    // Re-fetch using existing ID
    const updated = await api.getProfile(profile.id, profile.username);
    set({ profile: updated });
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
          await get().refreshProfile();
      } catch (err) {
          set({ error: (err as Error).message, isLoading: false });
      }
  },
  login: async (payload: AuthPayload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.auth.login(payload);
      setStoredUserId(response.userId);
      set({ 
        profile: response.profile, 
        isAuthenticated: true, 
        isLoading: false 
      });
      // Fetch teams for logged in user
      if (response.profile.teams.length > 0) {
        const teams = await api.getUserTeams(response.userId);
        set({ teams });
      }
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },
  signup: async (payload: AuthPayload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.auth.signup(payload);
      setStoredUserId(response.userId);
      set({ 
        profile: response.profile, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },
  logout: () => {
    localStorage.removeItem('kickstar_user_id');
    set({ profile: null, teams: [], isAuthenticated: false });
    // Re-init as guest
    get().initUser();
  }
}));