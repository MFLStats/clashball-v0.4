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
// --- Multiplayer Types ---
export type GameMode = '1v1' | '2v2' | '3v3' | '4v4';
export type WSMessage =
  | { type: 'join_queue'; mode: GameMode; userId: string; username: string }
  | { type: 'leave_queue' }
  | { type: 'input'; move: { x: number; y: number }; kick: boolean }
  | { type: 'match_found'; matchId: string; team: 'red' | 'blue'; opponent?: string }
  | { type: 'game_state'; state: any } // Typed as 'any' here to avoid circular dependency, but effectively GameState
  | { type: 'game_over'; winner: 'red' | 'blue' }
  | { type: 'error'; message: string }
  | { type: 'ping' }
  | { type: 'pong' };