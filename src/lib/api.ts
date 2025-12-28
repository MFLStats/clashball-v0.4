import type { ApiResponse, UserProfile, MatchResult, MatchResponse } from '@shared/types';
const API_BASE = '/api';
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json() as ApiResponse<T>;
  if (!json.success) {
    throw new Error(json.error || 'API Error');
  }
  return json.data as T;
}
export const api = {
  // User Profile
  getProfile: (userId: string, username: string) =>
    fetchApi<UserProfile>('/profile', {
      method: 'POST',
      body: JSON.stringify({ userId, username })
    }),
  // Match
  reportMatch: (data: MatchResult) =>
    fetchApi<MatchResponse>('/match/end', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
};