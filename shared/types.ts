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
export type GameMode = '1v1' | '2v2' | '3v3' | '4v4';
export interface ModeStats {
  rating: number;     // Glicko-2 Rating (displayed as MMR)
  rd: number;         // Rating Deviation
  volatility: number;
  wins: number;
  losses: number;
  tier: Tier;
  division: 1 | 2 | 3;
}
export interface TeamProfile {
  id: string;
  name: string;
  members: string[]; // User IDs
  stats: Record<GameMode, ModeStats>;
  createdAt: number;
  creatorId: string;
}
export interface UserProfile {
  id: string;
  username: string;
  email?: string;     // Optional for guest, required for auth
  country?: string;   // ISO 2-letter code (e.g., 'US', 'BR')
  stats: Record<GameMode, ModeStats>;
  teams: string[]; // List of Team IDs
  lastMatchTime: number;
}
export interface Team {
  id: string;
  name: string;
  members: string[]; // User IDs
  stats: Record<GameMode, ModeStats>;
}
export interface MatchResult {
  userId: string;
  teamId?: string; // Optional: If playing as a team
  opponentRating: number; // For bot matches, this is the bot's rating
  result: 'win' | 'loss' | 'draw';
  timestamp: number;
  mode: GameMode;
}
export interface MatchResponse {
  newRating: number;
  ratingChange: number;
  newTier: Tier;
  newDivision: 1 | 2 | 3;
  mode: GameMode;
  teamId?: string;
}
// --- Auth Types ---
export interface AuthPayload {
  email: string;
  password?: string;
  username?: string;
  country?: string;
  isGuest?: boolean;
}
export interface AuthResponse {
  userId: string;
  profile: UserProfile;
  token?: string; // For future use, currently userId acts as session
}
// --- Tournament Types ---
export interface TournamentParticipant {
  userId: string;
  username: string;
  country: string;
  rank: string; // e.g. "Gold I"
  rating: number;
}
export interface TournamentState {
  nextStartTime: number; // Timestamp
  participants: TournamentParticipant[];
  status: 'open' | 'in_progress' | 'completed';
}
// --- Game Event Types ---
export type GameEventType = 'kick' | 'wall' | 'player' | 'goal' | 'whistle';
export interface GameEvent {
  type: GameEventType;
  team?: 'red' | 'blue'; // For goals
}
// --- Multiplayer Types ---
export type WSMessage =
  | { type: 'join_queue'; mode: GameMode; userId: string; username: string }
  | { type: 'leave_queue' }
  | { type: 'input'; move: { x: number; y: number }; kick: boolean }
  | { type: 'match_found'; matchId: string; team: 'red' | 'blue'; opponent?: string }
  | { type: 'game_state'; state: any } // Typed as 'any' here to avoid circular dependency, but effectively GameState
  | { type: 'game_events'; events: GameEvent[] }
  | { type: 'game_over'; winner: 'red' | 'blue' }
  | { type: 'error'; message: string }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'chat'; message: string; sender?: string; team?: 'red' | 'blue' };