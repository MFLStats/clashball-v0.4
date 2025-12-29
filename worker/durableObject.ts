import { DurableObject } from "cloudflare:workers";
import type { 
    DemoItem, UserProfile, MatchResult, MatchResponse, Tier, WSMessage, 
    GameMode, ModeStats, TeamProfile, AuthPayload, AuthResponse, 
    TournamentState, TournamentParticipant 
} from '@shared/types';
import { MOCK_ITEMS } from '@shared/mock-data';
import { Match } from './match';
// Glicko-2 Constants
const TAU = 0.5;
const VOLATILITY_DEFAULT = 0.06;
const RATING_DEFAULT = 1200;
const RD_DEFAULT = 350;
export class GlobalDurableObject extends DurableObject {
    // State
    queues: Map<GameMode, { userId: string; ws: WebSocket; username: string }[]> = new Map();
    matches: Map<string, Match> = new Map();
    sessions: Map<WebSocket, { userId: string; matchId?: string }> = new Map();
    // Tournament State (In-memory for active pool, could be persisted if needed)
    tournamentParticipants: TournamentParticipant[] = [];
    constructor(ctx: DurableObjectState, env: any) {
        super(ctx, env);
        // Initialize queues
        this.queues.set('1v1', []);
        this.queues.set('2v2', []);
        this.queues.set('3v3', []);
        this.queues.set('4v4', []);
    }
    // --- WebSocket Handling ---
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname === '/api/ws') {
            if (request.headers.get('Upgrade') !== 'websocket') {
                return new Response('Expected Upgrade: websocket', { status: 426 });
            }
            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);
            this.handleSession(server);
            return new Response(null, {
                status: 101,
                webSocket: client,
            });
        }
        // Fallback to standard fetch for other routes (if any routed here directly)
        return new Response('Not found', { status: 404 });
    }
    handleSession(ws: WebSocket) {
        ws.accept();
        ws.addEventListener('message', async (event) => {
            try {
                const msg = JSON.parse(event.data as string) as WSMessage;
                this.handleMessage(ws, msg);
            } catch (e) {
                console.error('WS Error:', e);
            }
        });
        ws.addEventListener('close', () => {
            this.handleDisconnect(ws);
        });
    }
    handleMessage(ws: WebSocket, msg: WSMessage) {
        switch (msg.type) {
            case 'join_queue': {
                this.addToQueue(ws, msg.userId, msg.username, msg.mode);
                break;
            }
            case 'leave_queue': {
                this.removeFromQueue(ws);
                break;
            }
            case 'input': {
                const session = this.sessions.get(ws);
                if (session && session.matchId) {
                    const match = this.matches.get(session.matchId);
                    if (match) {
                        match.handleInput(session.userId, { move: msg.move, kick: msg.kick });
                    }
                }
                break;
            }
            case 'ping': {
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
            }
        }
    }
    handleDisconnect(ws: WebSocket) {
        this.removeFromQueue(ws);
        const session = this.sessions.get(ws);
        if (session && session.matchId) {
            // Handle player disconnect during match (pause? forfeit?)
            // For MVP, we just let the match continue or end
        }
        this.sessions.delete(ws);
    }
    addToQueue(ws: WebSocket, userId: string, username: string, mode: GameMode) {
        // Remove from other queues first
        this.removeFromQueue(ws);
        const queue = this.queues.get(mode) || [];
        queue.push({ userId, ws, username });
        this.queues.set(mode, queue);
        this.sessions.set(ws, { userId });
        this.checkQueue(mode);
    }
    removeFromQueue(ws: WebSocket) {
        this.queues.forEach((queue, mode) => {
            const idx = queue.findIndex(p => p.ws === ws);
            if (idx !== -1) {
                queue.splice(idx, 1);
            }
        });
    }
    checkQueue(mode: GameMode) {
        const queue = this.queues.get(mode) || [];
        const requiredPlayers = mode === '1v1' ? 2 : mode === '2v2' ? 4 : mode === '3v3' ? 6 : 8;
        if (queue.length >= requiredPlayers) {
            const players = queue.splice(0, requiredPlayers);
            this.startMatch(players, mode);
        }
    }
    startMatch(players: { userId: string; ws: WebSocket; username: string }[], mode: GameMode) {
        const matchId = crypto.randomUUID();
        const matchPlayers = players.map((p, i) => ({
            id: p.userId,
            ws: p.ws,
            username: p.username,
            team: (i < players.length / 2 ? 'red' : 'blue') as 'red' | 'blue'
        }));
        const match = new Match(matchId, matchPlayers, (id, winner) => {
            this.matches.delete(id);
            // Fire and forget rating updates
            this.ctx.waitUntil(this.handleMatchEnd(id, winner, matchPlayers, mode));
        });
        this.matches.set(matchId, match);
        // Notify players
        matchPlayers.forEach(p => {
            const session = this.sessions.get(p.ws);
            if (session) session.matchId = matchId;
            p.ws.send(JSON.stringify({
                type: 'match_found',
                matchId,
                team: p.team,
                opponent: matchPlayers.find(op => op.team !== p.team)?.username // Simplified for 1v1
            }));
        });
        match.start();
    }
    async handleMatchEnd(matchId: string, winner: 'red' | 'blue', players: { id: string, team: 'red' | 'blue' }[], mode: GameMode) {
        // 1. Get all user profiles to calculate team averages
        const playerProfiles = await Promise.all(players.map(p => this.getUserProfile(p.id)));
        const redPlayers = players.filter(p => p.team === 'red');
        const bluePlayers = players.filter(p => p.team === 'blue');
        const getAvgRating = (teamPlayers: typeof players) => {
            if (teamPlayers.length === 0) return 1200;
            const total = teamPlayers.reduce((sum, p) => {
                const profile = playerProfiles.find(prof => prof.id === p.id);
                return sum + (profile?.stats[mode]?.rating || 1200);
            }, 0);
            return total / teamPlayers.length;
        };
        const redAvg = getAvgRating(redPlayers);
        const blueAvg = getAvgRating(bluePlayers);
        // 2. Process updates for each player
        const updates = players.map(async (p) => {
            const isRed = p.team === 'red';
            const opponentRating = isRed ? blueAvg : redAvg;
            const result = (winner === 'red' && isRed) || (winner === 'blue' && !isRed) ? 'win' : 'loss';
            await this.processMatch({
                userId: p.id,
                opponentRating,
                result,
                timestamp: Date.now(),
                mode
            });
        });
        await Promise.all(updates);
    }
    // --- Existing RPC Methods ---
    async getCounterValue(): Promise<number> {
      const value = (await this.ctx.storage.get("counter_value")) || 0;
      return value as number;
    }
    async increment(amount = 1): Promise<number> {
      let value: number = (await this.ctx.storage.get("counter_value")) || 0;
      value += amount;
      await this.ctx.storage.put("counter_value", value);
      return value;
    }
    async decrement(amount = 1): Promise<number> {
      let value: number = (await this.ctx.storage.get("counter_value")) || 0;
      value -= amount;
      await this.ctx.storage.put("counter_value", value);
      return value;
    }
    async getDemoItems(): Promise<DemoItem[]> {
      const items = await this.ctx.storage.get("demo_items");
      if (items) return items as DemoItem[];
      await this.ctx.storage.put("demo_items", MOCK_ITEMS);
      return MOCK_ITEMS;
    }
    async addDemoItem(item: DemoItem): Promise<DemoItem[]> {
      const items = await this.getDemoItems();
      const updatedItems = [...items, item];
      await this.ctx.storage.put("demo_items", updatedItems);
      return updatedItems;
    }
    async updateDemoItem(id: string, updates: Partial<Omit<DemoItem, 'id'>>): Promise<DemoItem[]> {
      const items = await this.getDemoItems();
      const updatedItems = items.map(item => item.id === id ? { ...item, ...updates } : item);
      await this.ctx.storage.put("demo_items", updatedItems);
      return updatedItems;
    }
    async deleteDemoItem(id: string): Promise<DemoItem[]> {
      const items = await this.getDemoItems();
      const updatedItems = items.filter(item => item.id !== id);
      await this.ctx.storage.put("demo_items", updatedItems);
      return updatedItems;
    }
    // --- Auth Methods ---
    async signup(payload: AuthPayload): Promise<AuthResponse> {
        const { email, password, username, country } = payload;
        if (!email || !password || !username) throw new Error("Missing required fields");
        // Check if email exists
        const emailIndex = (await this.ctx.storage.get<Record<string, string>>("email_index")) || {};
        if (emailIndex[email]) {
            throw new Error("Email already registered");
        }
        const userId = crypto.randomUUID();
        // Store credentials (mock hash for demo)
        const credentials = { userId, password }; // In prod, hash this!
        await this.ctx.storage.put(`auth_${email}`, credentials);
        // Update index
        emailIndex[email] = userId;
        await this.ctx.storage.put("email_index", emailIndex);
        // Create Profile
        const profile = await this.getUserProfile(userId, username);
        profile.email = email;
        profile.country = country || 'US';
        await this.ctx.storage.put(`user_${userId}`, profile);
        return { userId, profile };
    }
    async login(payload: AuthPayload): Promise<AuthResponse> {
        const { email, password } = payload;
        if (!email || !password) throw new Error("Missing credentials");
        const credentials = await this.ctx.storage.get<{ userId: string, password: string }>(`auth_${email}`);
        if (!credentials || credentials.password !== password) {
            throw new Error("Invalid credentials");
        }
        const profile = await this.getUserProfile(credentials.userId);
        return { userId: credentials.userId, profile };
    }
    // --- Ranked Methods ---
    async getUserProfile(userId: string, username: string = 'Player'): Promise<UserProfile> {
      const key = `user_${userId}`;
      let profile = await this.ctx.storage.get<any>(key); // Use any for migration check
      // Default Stats Object
      const defaultStats: ModeStats = {
        rating: RATING_DEFAULT,
        rd: RD_DEFAULT,
        volatility: VOLATILITY_DEFAULT,
        wins: 0,
        losses: 0,
        tier: 'Silver',
        division: 3
      };
      if (!profile) {
        // Create new profile
        const newProfile: UserProfile = {
            id: userId,
            username,
            stats: {
                '1v1': { ...defaultStats },
                '2v2': { ...defaultStats },
                '3v3': { ...defaultStats },
                '4v4': { ...defaultStats }
            },
            teams: [],
            lastMatchTime: Date.now()
        };
        await this.ctx.storage.put(key, newProfile);
        return newProfile;
      }
      // Migration: If profile exists but has old flat structure (no stats object)
      if (!profile.stats) {
        // Convert old flat stats to 1v1 stats
        const oldStats: ModeStats = {
            rating: profile.rating || RATING_DEFAULT,
            rd: profile.rd || RD_DEFAULT,
            volatility: profile.volatility || VOLATILITY_DEFAULT,
            wins: profile.wins || 0,
            losses: profile.losses || 0,
            tier: profile.tier || 'Silver',
            division: profile.division || 3
        };
        profile = {
            id: profile.id,
            username: profile.username,
            stats: {
                '1v1': oldStats,
                '2v2': { ...defaultStats },
                '3v3': { ...defaultStats },
                '4v4': { ...defaultStats }
            },
            teams: profile.teams || [],
            lastMatchTime: profile.lastMatchTime || Date.now()
        };
        await this.ctx.storage.put(key, profile);
      }
      // Migration: Ensure teams array exists
      if (!profile.teams) {
          profile.teams = [];
          await this.ctx.storage.put(key, profile);
      }
      return profile as UserProfile;
    }
    // --- Team Methods ---
    async createTeam(name: string, creatorId: string): Promise<TeamProfile> {
        const teamId = crypto.randomUUID();
        const defaultStats: ModeStats = {
            rating: RATING_DEFAULT,
            rd: RD_DEFAULT,
            volatility: VOLATILITY_DEFAULT,
            wins: 0,
            losses: 0,
            tier: 'Silver',
            division: 3
        };
        const newTeam: TeamProfile = {
            id: teamId,
            name,
            members: [creatorId],
            stats: {
                '1v1': { ...defaultStats },
                '2v2': { ...defaultStats },
                '3v3': { ...defaultStats },
                '4v4': { ...defaultStats }
            },
            createdAt: Date.now(),
            creatorId
        };
        // Save Team
        await this.ctx.storage.put(`team_${teamId}`, newTeam);
        // Update Creator's Profile
        const userProfile = await this.getUserProfile(creatorId);
        if (!userProfile.teams.includes(teamId)) {
            userProfile.teams.push(teamId);
            await this.ctx.storage.put(`user_${creatorId}`, userProfile);
        }
        return newTeam;
    }
    async getTeam(teamId: string): Promise<TeamProfile | null> {
        return await this.ctx.storage.get<TeamProfile>(`team_${teamId}`) || null;
    }
    async getUserTeams(userId: string): Promise<TeamProfile[]> {
        const profile = await this.getUserProfile(userId);
        const teams: TeamProfile[] = [];
        for (const teamId of profile.teams) {
            const team = await this.getTeam(teamId);
            if (team) teams.push(team);
        }
        return teams;
    }
    async processMatch(match: MatchResult): Promise<MatchResponse> {
      const mode = match.mode || '1v1'; // Default to 1v1 if missing
      let stats: ModeStats;
      let entityKey: string;
      let entity: UserProfile | TeamProfile;
      // Determine if we are updating a Team or a User
      if (match.teamId) {
          entityKey = `team_${match.teamId}`;
          const team = await this.getTeam(match.teamId);
          if (!team) throw new Error("Team not found");
          entity = team;
          stats = team.stats[mode];
      } else {
          entityKey = `user_${match.userId}`;
          const profile = await this.getUserProfile(match.userId);
          entity = profile;
          stats = profile.stats[mode];
      }
      const s = match.result === 'win' ? 1 : match.result === 'loss' ? 0 : 0.5;
      // Glicko-2 Simplified Calculation
      const qa = Math.log(10) / 400;
      const rdOpponent = 350; // Assume opponent has high uncertainty for now (or pass it in)
      const g_rd = 1 / Math.sqrt(1 + 3 * Math.pow(qa * rdOpponent / Math.PI, 2));
      const E = 1 / (1 + Math.pow(10, -g_rd * (stats.rating - match.opponentRating) / 400));
      const K = stats.rd / 10; // Simplified K-factor based on RD
      const ratingChange = K * (s - E);
      const newRating = stats.rating + ratingChange;
      const newRD = Math.max(30, stats.rd * 0.95); // Reduce uncertainty
      // Update Stats
      stats.rating = Math.round(newRating);
      stats.rd = newRD;
      if (match.result === 'win') stats.wins++;
      if (match.result === 'loss') stats.losses++;
      // Recalculate Tier
      const { tier, division } = this.calculateTier(stats.rating);
      stats.tier = tier;
      stats.division = division;
      // Save Entity
      await this.ctx.storage.put(entityKey, entity);
      return {
        newRating: stats.rating,
        ratingChange: Math.round(ratingChange),
        newTier: tier,
        newDivision: division,
        mode,
        teamId: match.teamId
      };
    }
    private calculateTier(rating: number): { tier: Tier, division: 1 | 2 | 3 } {
      if (rating < 900) return { tier: 'Bronze', division: rating < 300 ? 3 : rating < 600 ? 2 : 1 };
      if (rating < 1200) return { tier: 'Silver', division: rating < 1000 ? 3 : rating < 1100 ? 2 : 1 };
      if (rating < 1500) return { tier: 'Gold', division: rating < 1300 ? 3 : rating < 1400 ? 2 : 1 };
      if (rating < 1800) return { tier: 'Platinum', division: rating < 1600 ? 3 : rating < 1700 ? 2 : 1 };
      if (rating < 2100) return { tier: 'Diamond', division: rating < 1900 ? 3 : rating < 2000 ? 2 : 1 };
      return { tier: 'Master', division: 1 };
    }
    // --- Tournament Methods ---
    async getTournamentState(): Promise<TournamentState> {
        // Calculate next 5-minute interval
        const now = Date.now();
        const interval = 5 * 60 * 1000; // 5 minutes
        const nextStartTime = Math.ceil(now / interval) * interval;
        // If we passed the previous start time significantly, clear old participants
        // For simplicity in this phase, we just return the current pool for the "next" tournament
        // In a real system, we'd move them to an "active" match state
        return {
            nextStartTime,
            participants: this.tournamentParticipants,
            status: 'open'
        };
    }
    async joinTournament(userId: string): Promise<TournamentState> {
        const profile = await this.getUserProfile(userId);
        // Check if already joined
        if (!this.tournamentParticipants.find(p => p.userId === userId)) {
            this.tournamentParticipants.push({
                userId: profile.id,
                username: profile.username,
                country: profile.country || 'US',
                rank: `${profile.stats['1v1'].tier} ${profile.stats['1v1'].division === 1 ? 'I' : profile.stats['1v1'].division === 2 ? 'II' : 'III'}`,
                rating: profile.stats['1v1'].rating
            });
        }
        return this.getTournamentState();
    }
}