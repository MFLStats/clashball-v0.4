export interface DemoItem {
  id: string;
  name: string;
  value: number;
}
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
// Ranked System Types
export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master';
export interface UserProfile {
  id: string;
  username: string;
  rating: number; // Glicko-2 Rating (displayed as MMR)
  rd: number;     // Rating Deviation
  volatility: number;
  wins: number;
  losses: number;
  tier: Tier;
  division: 1 | 2 | 3;
  lastMatchTime: number;
}
export interface MatchResult {
  userId: string;
  opponentRating: number; // For bot matches, this is the bot's rating
  result: 'win' | 'loss' | 'draw';
  timestamp: number;
}
export interface MatchResponse {
  newRating: number;
  ratingChange: number;
  newTier: Tier;
  newDivision: 1 | 2 | 3;
}