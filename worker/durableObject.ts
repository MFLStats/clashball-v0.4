import { DurableObject } from "cloudflare:workers";
import type {
    DemoItem, UserProfile, MatchResult, MatchResponse, Tier, WSMessage,
    GameMode, ModeStats, TeamProfile, AuthPayload, AuthResponse,
    TournamentState, TournamentParticipant, LobbyState, LeaderboardEntry, MatchHistoryEntry,
    TeamMember, LobbyInfo, PlayerMatchStats
} from '@shared/types';
import { MOCK_ITEMS } from '@shared/mock-data';
import { Match } from './match';
// Glicko-2 Constants
const TAU = 0.5;
const VOLATILITY_DEFAULT = 0.06;
const RATING_DEFAULT = 1200;
const RD_DEFAULT = 350;
interface Lobby {
    code: string;
    hostId: string;
    players: { id: string; ws: WebSocket; username: string }[];
    status: 'waiting' | 'playing';
}
export class GlobalDurableObject extends DurableObject {
    // State
    // Updated queue to store rating for matchmaking
    queues: Map<GameMode, { userId: string; ws: WebSocket; username: string; rating: number }[]> = new Map();
    matches: Map<string, Match> = new Map();
    sessions: Map<WebSocket, { userId: string; matchId?: string; lobbyCode?: string }> = new Map();
    lobbies: Map<string, Lobby> = new Map();
    leaderboards: Map<GameMode, LeaderboardEntry[]> = new Map();
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
                await this.handleMessage(ws, msg);
            } catch (e) {
                console.error('WS Error:', e);
            }
        });
        ws.addEventListener('close', () => {
            this.handleDisconnect(ws);
        });
    }
    async handleMessage(ws: WebSocket, msg: WSMessage) {
        try {
            switch (msg.type) {
                case 'join_queue': {
                    if (!msg.userId || !msg.mode) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid queue request: Missing userId or mode' }));
                        return;
                    }
                    // Fetch user profile to get rating
                    const profile = await this.getUserProfile(msg.userId);
                    const rating = profile.stats[msg.mode].rating;
                    this.addToQueue(ws, msg.userId, msg.username, msg.mode, rating);
                    break;
                }
                case 'leave_queue': {
                    this.removeFromQueue(ws);
                    break;
                }
                case 'create_lobby': {
                    this.handleCreateLobby(ws, msg.userId, msg.username);
                    break;
                }
                case 'join_lobby': {
                    this.handleJoinLobby(ws, msg.code, msg.userId, msg.username);
                    break;
                }
                case 'start_lobby_match': {
                    this.handleStartLobbyMatch(ws);
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
                case 'chat': {
                    const session = this.sessions.get(ws);
                    if (session && session.matchId) {
                        const match = this.matches.get(session.matchId);
                        if (match) {
                            match.handleChat(session.userId, msg.message);
                        }
                    }
                    break;
                }
            }
        } catch (err) {
            console.error("Error handling message:", err);
            ws.send(JSON.stringify({ type: 'error', message: 'Internal server error processing message' }));
        }
    }
    handleDisconnect(ws: WebSocket) {
        this.removeFromQueue(ws);
        const session = this.sessions.get(ws);
        // Handle Lobby Disconnect
        if (session && session.lobbyCode) {
            const lobby = this.lobbies.get(session.lobbyCode);
            if (lobby) {
                lobby.players = lobby.players.filter(p => p.ws !== ws);
                if (lobby.players.length === 0) {
                    this.lobbies.delete(session.lobbyCode);
                } else {
                    // If host left, assign new host
                    if (lobby.hostId === session.userId) {
                        lobby.hostId = lobby.players[0].id;
                    }
                    this.broadcastLobbyUpdate(lobby);
                }
            }
        }
        if (session && session.matchId) {
            // Handle player disconnect during match (pause? forfeit?)
            // For MVP, we just let the match continue or end
        }
        this.sessions.delete(ws);
    }
    // --- Queue Logic ---
    addToQueue(ws: WebSocket, userId: string, username: string, mode: GameMode, rating: number) {
        // Remove from other queues first
        this.removeFromQueue(ws);
        const queue = this.queues.get(mode) || [];
        // Prevent duplicates
        if (!queue.find(p => p.userId === userId)) {
            queue.push({ userId, ws, username, rating });
            // Sort queue by rating to group similar skill levels
            queue.sort((a, b) => a.rating - b.rating);
            this.queues.set(mode, queue);
            this.sessions.set(ws, { userId });
            // Broadcast queue update
            this.broadcastQueueStatus(mode);
            this.checkQueue(mode);
        }
    }
    removeFromQueue(ws: WebSocket) {
        let updatedMode: GameMode | null = null;
        this.queues.forEach((queue, mode) => {
            const idx = queue.findIndex(p => p.ws === ws);
            if (idx !== -1) {
                queue.splice(idx, 1);
                updatedMode = mode;
            }
        });
        if (updatedMode) {
            this.broadcastQueueStatus(updatedMode);
        }
    }
    broadcastQueueStatus(mode: GameMode) {
        const queue = this.queues.get(mode) || [];
        const count = queue.length;
        const msg = JSON.stringify({ type: 'queue_update', count });
        queue.forEach(p => {
            try { p.ws.send(msg); } catch(e) { /* empty */ }
        });
    }
    checkQueue(mode: GameMode) {
        const queue = this.queues.get(mode) || [];
        const requiredPlayers = mode === '1v1' ? 2 : mode === '2v2' ? 4 : mode === '3v3' ? 6 : 8;
        if (queue.length >= requiredPlayers) {
            // Since queue is sorted by rating, taking adjacent players gives best match
            // We take the first N players (lowest ratings)
            // In a more advanced system, we might search for the tightest cluster
            const players = queue.splice(0, requiredPlayers);
            // Update queue status for remaining players
            this.broadcastQueueStatus(mode);
            this.startMatch(players, mode);
        }
    }
    // --- Lobby Logic ---
    handleCreateLobby(ws: WebSocket, userId: string, username: string) {
        // Generate 6-char code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        // Ensure uniqueness (simple check)
        while (this.lobbies.has(code)) {
            code = '';
            for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const lobby: Lobby = {
            code,
            hostId: userId,
            players: [{ id: userId, ws, username }],
            status: 'waiting'
        };
        this.lobbies.set(code, lobby);
        this.sessions.set(ws, { userId, lobbyCode: code });
        this.broadcastLobbyUpdate(lobby);
    }
    handleJoinLobby(ws: WebSocket, code: string, userId: string, username: string) {
        const lobby = this.lobbies.get(code.toUpperCase());
        if (!lobby) {
            ws.send(JSON.stringify({ type: 'error', message: 'Lobby not found' }));
            return;
        }
        if (lobby.status !== 'waiting') {
            ws.send(JSON.stringify({ type: 'error', message: 'Match already in progress' }));
            return;
        }
        if (lobby.players.length >= 8) { // Max 4v4
            ws.send(JSON.stringify({ type: 'error', message: 'Lobby is full' }));
            return;
        }
        // Add player
        lobby.players.push({ id: userId, ws, username });
        this.sessions.set(ws, { userId, lobbyCode: code });
        this.broadcastLobbyUpdate(lobby);
    }
    handleStartLobbyMatch(ws: WebSocket) {
        const session = this.sessions.get(ws);
        if (!session || !session.lobbyCode) return;
        const lobby = this.lobbies.get(session.lobbyCode);
        if (!lobby) return;
        if (lobby.hostId !== session.userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only host can start match' }));
            return;
        }
        if (lobby.players.length < 2) {
            ws.send(JSON.stringify({ type: 'error', message: 'Need at least 2 players' }));
            return;
        }
        lobby.status = 'playing';
        this.broadcastLobbyUpdate(lobby);
        // Determine mode based on player count
        const count = lobby.players.length;
        const mode: GameMode = count <= 2 ? '1v1' : count <= 4 ? '2v2' : count <= 6 ? '3v3' : '4v4';
        // Start Match
        // We need to map lobby players to match players format
        const matchPlayers = lobby.players.map(p => ({
            userId: p.id,
            ws: p.ws,
            username: p.username
        }));
        this.startMatch(matchPlayers, mode);
    }
    broadcastLobbyUpdate(lobby: Lobby) {
        const state: LobbyState = {
            code: lobby.code,
            hostId: lobby.hostId,
            players: lobby.players.map(p => ({ id: p.id, username: p.username })),
            status: lobby.status
        };
        const msg = JSON.stringify({ type: 'lobby_update', state });
        lobby.players.forEach(p => {
            try { p.ws.send(msg); } catch(e) { /* empty */ }
        });
    }
    async getLobbies(): Promise<LobbyInfo[]> {
        const lobbies: LobbyInfo[] = [];
        for (const lobby of this.lobbies.values()) {
            if (lobby.status === 'waiting') {
                const host = lobby.players.find(p => p.id === lobby.hostId);
                lobbies.push({
                    code: lobby.code,
                    hostName: host ? host.username : 'Unknown',
                    playerCount: lobby.players.length,
                    maxPlayers: 8,
                    status: lobby.status
                });
            }
        }
        return lobbies;
    }
    // --- Match Logic ---
    startMatch(players: { userId: string; ws: WebSocket; username: string }[], mode: GameMode) {
        const matchId = crypto.randomUUID();
        const matchPlayers = players.map((p, i) => ({
            id: p.userId,
            ws: p.ws,
            username: p.username,
            team: (i < players.length / 2 ? 'red' : 'blue') as 'red' | 'blue'
        }));
        const match = new Match(matchId, matchPlayers, (id, winner) => {
            // Retrieve stats before deleting match
            const matchInstance = this.matches.get(id);
            const playerStats = matchInstance ? Object.fromEntries(matchInstance.matchStats) : undefined;
            this.matches.delete(id);
            // Fire and forget rating updates
            this.ctx.waitUntil(this.handleMatchEnd(id, winner, matchPlayers, mode, playerStats));
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
    async handleMatchEnd(matchId: string, winner: 'red' | 'blue', players: { id: string, team: 'red' | 'blue', username: string }[], mode: GameMode, playerStats?: Record<string, PlayerMatchStats>) {
        // 1. Get all user profiles to calculate team averages and detect teams
        const playerProfiles = await Promise.all(players.map(p => this.getUserProfile(p.id)));
        const redPlayers = players.filter(p => p.team === 'red');
        const bluePlayers = players.filter(p => p.team === 'blue');
        // Helper to get profiles for a specific side
        const getSideProfiles = (sidePlayers: typeof players) => {
            return sidePlayers.map(p => playerProfiles.find(prof => prof.id === p.id)).filter(Boolean) as UserProfile[];
        };
        const redProfiles = getSideProfiles(redPlayers);
        const blueProfiles = getSideProfiles(bluePlayers);
        // Helper to find common team ID among a group of players
        const findCommonTeam = (profiles: UserProfile[]) => {
            if (profiles.length < 2) return null; // Need at least 2 players to form a "team" context for ranking usually
            const first = profiles[0].teams || [];
            // Find intersection of all players' team lists
            const common = first.filter(teamId => 
                profiles.every(p => (p.teams || []).includes(teamId))
            );
            return common.length > 0 ? common[0] : null; // Return first common team found
        };
        const redTeamId = redPlayers.length >= 2 ? findCommonTeam(redProfiles) : null;
        const blueTeamId = bluePlayers.length >= 2 ? findCommonTeam(blueProfiles) : null;
        // Calculate Averages (Player based)
        const getAvgRating = (profiles: UserProfile[]) => {
            if (profiles.length === 0) return 1200;
            const total = profiles.reduce((sum, p) => sum + (p.stats[mode]?.rating || 1200), 0);
            return total / profiles.length;
        };
        const redAvg = getAvgRating(redProfiles);
        const blueAvg = getAvgRating(blueProfiles);
        // Fetch Team Names if teams are detected (for history logs)
        let redTeamName = 'Team Red';
        let blueTeamName = 'Team Blue';
        if (redTeamId) {
            const t = await this.getTeam(redTeamId);
            if (t) redTeamName = t.name;
        }
        if (blueTeamId) {
            const t = await this.getTeam(blueTeamId);
            if (t) blueTeamName = t.name;
        }
        // 2. Process updates for individual players
        const updates = players.map(async (p) => {
            const isRed = p.team === 'red';
            const opponentRating = isRed ? blueAvg : redAvg;
            const result = (winner === 'red' && isRed) || (winner === 'blue' && !isRed) ? 'win' : 'loss';
            // Determine Opponent Name
            let opponentName = 'Opponent';
            if (mode === '1v1') {
                const opponent = players.find(op => op.team !== p.team);
                opponentName = opponent ? opponent.username : 'Opponent';
            } else {
                // If opposing side is a team, use team name
                opponentName = isRed ? blueTeamName : redTeamName;
            }
            await this.processMatch({
                matchId,
                userId: p.id,
                opponentRating,
                opponentName,
                result,
                timestamp: Date.now(),
                mode,
                playerStats // Pass the stats map
            });
        });
        // Helper to aggregate stats for a team
        const getAggregatedStats = (teamPlayers: typeof players): PlayerMatchStats | undefined => {
            if (!playerStats) return undefined;
            const agg: PlayerMatchStats = {
                goals: 0,
                assists: 0,
                ownGoals: 0,
                isMvp: false,
                cleanSheet: false
            };
            // Check clean sheet from first player (same for all in team)
            if (teamPlayers.length > 0 && playerStats[teamPlayers[0].id]?.cleanSheet) {
                agg.cleanSheet = true;
            }
            teamPlayers.forEach(p => {
                const s = playerStats[p.id];
                if (s) {
                    agg.goals += s.goals;
                    agg.assists += s.assists;
                    agg.ownGoals += s.ownGoals;
                    if (s.isMvp) agg.isMvp = true;
                }
            });
            return agg;
        };
        // 3. Process updates for Teams (if detected)
        const teamUpdates: Promise<any>[] = [];
        if (redTeamId) {
            const result = winner === 'red' ? 'win' : 'loss';
            const aggStats = getAggregatedStats(redPlayers);
            const representativeId = redPlayers[0].id;
            teamUpdates.push(this.processMatch({
                matchId,
                userId: representativeId, // Placeholder, teamId is what matters
                teamId: redTeamId,
                opponentRating: blueAvg, // Use player average of opponents
                opponentName: blueTeamId ? blueTeamName : 'Opponents',
                result,
                timestamp: Date.now(),
                mode,
                playerStats: aggStats ? { [representativeId]: aggStats } : undefined
            }));
        }
        if (blueTeamId) {
            const result = winner === 'blue' ? 'win' : 'loss';
            const aggStats = getAggregatedStats(bluePlayers);
            const representativeId = bluePlayers[0].id;
            teamUpdates.push(this.processMatch({
                matchId,
                userId: representativeId,
                teamId: blueTeamId,
                opponentRating: redAvg,
                opponentName: redTeamId ? redTeamName : 'Opponents',
                result,
                timestamp: Date.now(),
                mode,
                playerStats: aggStats ? { [representativeId]: aggStats } : undefined
            }));
        }
        await Promise.all([...updates, ...teamUpdates]);
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
        division: 3,
        goals: 0,
        assists: 0,
        mvps: 0,
        cleanSheets: 0,
        ownGoals: 0
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
            lastMatchTime: Date.now(),
            recentMatches: []
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
            division: profile.division || 3,
            goals: 0,
            assists: 0,
            mvps: 0,
            cleanSheets: 0,
            ownGoals: 0
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
            lastMatchTime: profile.lastMatchTime || Date.now(),
            recentMatches: profile.recentMatches || []
        };
        await this.ctx.storage.put(key, profile);
      }
      // Migration: Ensure teams array exists
      if (!profile.teams) {
          profile.teams = [];
          await this.ctx.storage.put(key, profile);
      }
      // Migration: Ensure recentMatches exists
      if (!profile.recentMatches) {
          profile.recentMatches = [];
          await this.ctx.storage.put(key, profile);
      }
      // Migration: Ensure new stats fields exist
      ['1v1', '2v2', '3v3', '4v4'].forEach(mode => {
          if (profile.stats[mode]) {
              if (profile.stats[mode].goals === undefined) profile.stats[mode].goals = 0;
              if (profile.stats[mode].assists === undefined) profile.stats[mode].assists = 0;
              if (profile.stats[mode].mvps === undefined) profile.stats[mode].mvps = 0;
              if (profile.stats[mode].cleanSheets === undefined) profile.stats[mode].cleanSheets = 0;
              if (profile.stats[mode].ownGoals === undefined) profile.stats[mode].ownGoals = 0;
          }
      });
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
            division: 3,
            goals: 0,
            assists: 0,
            mvps: 0,
            cleanSheets: 0,
            ownGoals: 0
        };
        // Generate Unique Code
        let code = '';
        let isUnique = false;
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        while (!isUnique) {
            code = '';
            for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
            const existing = await this.ctx.storage.get(`team_code_${code}`);
            if (!existing) isUnique = true;
        }
        // Get Creator Profile for Username
        const creatorProfile = await this.getUserProfile(creatorId);
        const newTeam: TeamProfile = {
            id: teamId,
            name,
            code,
            members: [{ id: creatorId, username: creatorProfile.username }],
            stats: {
                '1v1': { ...defaultStats },
                '2v2': { ...defaultStats },
                '3v3': { ...defaultStats },
                '4v4': { ...defaultStats }
            },
            createdAt: Date.now(),
            creatorId,
            recentMatches: []
        };
        // Save Team and Code Mapping
        await this.ctx.storage.put(`team_${teamId}`, newTeam);
        await this.ctx.storage.put(`team_code_${code}`, teamId);
        // Update Creator's Profile
        if (!creatorProfile.teams.includes(teamId)) {
            creatorProfile.teams.push(teamId);
            await this.ctx.storage.put(`user_${creatorId}`, creatorProfile);
        }
        return newTeam;
    }
    async joinTeam(code: string, userId: string, username: string): Promise<TeamProfile> {
        const teamId = await this.ctx.storage.get<string>(`team_code_${code.toUpperCase()}`);
        if (!teamId) throw new Error("Invalid invite code");
        const team = await this.getTeam(teamId);
        if (!team) throw new Error("Team not found");
        // Check if already member
        if (team.members.some(m => m.id === userId)) {
            throw new Error("You are already a member of this team");
        }
        // Add Member
        team.members.push({ id: userId, username });
        await this.ctx.storage.put(`team_${teamId}`, team);
        // Update User Profile
        const userProfile = await this.getUserProfile(userId);
        if (!userProfile.teams.includes(teamId)) {
            userProfile.teams.push(teamId);
            await this.ctx.storage.put(`user_${userId}`, userProfile);
        }
        return team;
    }
    async getTeam(teamId: string): Promise<TeamProfile | null> {
        let team = await this.ctx.storage.get<any>(`team_${teamId}`);
        if (!team) return null;
        // Migration: members string[] -> object[]
        if (team.members.length > 0 && typeof team.members[0] === 'string') {
            const newMembers: TeamMember[] = [];
            for (const memberId of team.members) {
                 const profile = await this.getUserProfile(memberId);
                 newMembers.push({ id: memberId, username: profile.username });
            }
            team.members = newMembers;
            // Ensure code exists (legacy teams)
            if (!team.code) {
                 let code = '';
                 let isUnique = false;
                 const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                 while (!isUnique) {
                    code = '';
                    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
                    const existing = await this.ctx.storage.get(`team_code_${code}`);
                    if (!existing) isUnique = true;
                 }
                 team.code = code;
                 await this.ctx.storage.put(`team_code_${code}`, teamId);
            }
            await this.ctx.storage.put(`team_${teamId}`, team);
        }
        return team as TeamProfile;
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
      // --- PROVISIONAL PHASE LOGIC ---
      const totalMatches = (stats.wins || 0) + (stats.losses || 0);
      const isProvisional = totalMatches < 10;
      // K-Factor: High volatility for provisional, standard for established
      const K = isProvisional ? 150 : stats.rd / 10;
      // RD Decay: Keep uncertainty high during provisional
      const decayFactor = isProvisional ? 0.98 : 0.95;
      const ratingChange = K * (s - E);
      const newRating = stats.rating + ratingChange;
      const newRD = Math.max(30, stats.rd * decayFactor); // Apply decay
      // Update Stats
      stats.rating = Math.round(newRating);
      stats.rd = newRD;
      if (match.result === 'win') stats.wins++;
      if (match.result === 'loss') stats.losses++;
      // Update Advanced Stats
      if (match.playerStats && match.playerStats[match.userId]) {
          const pStats = match.playerStats[match.userId];
          stats.goals = (stats.goals || 0) + pStats.goals;
          stats.assists = (stats.assists || 0) + pStats.assists;
          stats.ownGoals = (stats.ownGoals || 0) + pStats.ownGoals;
          if (pStats.isMvp) stats.mvps = (stats.mvps || 0) + 1;
          if (pStats.cleanSheet) stats.cleanSheets = (stats.cleanSheets || 0) + 1;
      }
      // Recalculate Tier
      const { tier, division } = this.calculateTier(stats.rating);
      stats.tier = tier;
      stats.division = division;
      // Add to Match History
      const historyEntry: MatchHistoryEntry = {
          matchId: match.matchId || crypto.randomUUID(),
          opponentName: match.opponentName || 'Opponent',
          result: match.result,
          ratingChange: Math.round(ratingChange),
          timestamp: match.timestamp,
          mode
      };
      if (!entity.recentMatches) entity.recentMatches = [];
      entity.recentMatches.unshift(historyEntry);
      if (entity.recentMatches.length > 10) entity.recentMatches.pop();
      // Save Entity
      await this.ctx.storage.put(entityKey, entity);
      // Update Leaderboard (Only for Users for now, or Teams if we had Team Leaderboards)
      // Since we are tracking Individual MMR even in team modes (unless playing as a registered Team),
      // we update the leaderboard if it's a UserProfile.
      if (!match.teamId) {
          await this.updateLeaderboard(mode, entity as UserProfile);
      }
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
    // --- Leaderboard Methods ---
    async getLeaderboard(mode: GameMode): Promise<LeaderboardEntry[]> {
        if (!this.leaderboards.has(mode)) {
            const stored = await this.ctx.storage.get<LeaderboardEntry[]>(`leaderboard_${mode}`);
            this.leaderboards.set(mode, stored || []);
        }
        return this.leaderboards.get(mode)!;
    }
    async updateLeaderboard(mode: GameMode, profile: UserProfile) {
        const lb = await this.getLeaderboard(mode);
        const stats = profile.stats[mode];
        // Create Entry
        const entry: LeaderboardEntry = {
            userId: profile.id,
            username: profile.username,
            rating: stats.rating,
            tier: stats.tier,
            division: stats.division,
            country: profile.country
        };
        // Find existing
        const idx = lb.findIndex(e => e.userId === profile.id);
        if (idx !== -1) {
            lb[idx] = entry;
        } else {
            lb.push(entry);
        }
        // Sort Descending
        lb.sort((a, b) => b.rating - a.rating);
        // Slice Top 50
        if (lb.length > 50) {
            lb.length = 50;
        }
        // Save
        this.leaderboards.set(mode, lb);
        await this.ctx.storage.put(`leaderboard_${mode}`, lb);
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