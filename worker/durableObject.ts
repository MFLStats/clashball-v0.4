import { DurableObject } from "cloudflare:workers";
import type {
    UserProfile, MatchResult, MatchResponse, Tier, WSMessage,
    GameMode, ModeStats, TeamProfile, AuthPayload, AuthResponse,
    TournamentState, TournamentParticipant, LobbyState, LeaderboardEntry, MatchHistoryEntry,
    TeamMember, LobbyInfo, PlayerMatchStats, LobbySettings, LobbyTeam, TournamentMatch
} from '@shared/types';
import { Match } from './match';
// Glicko-2 Constants
const TAU = 0.5;
const VOLATILITY_DEFAULT = 0.06;
const RATING_DEFAULT = 1200;
const RD_DEFAULT = 350;
// Default Ranked Settings
const RANKED_SETTINGS: LobbySettings = {
    scoreLimit: 3,
    timeLimit: 180,
    fieldSize: 'medium'
};
interface Lobby {
    code: string;
    hostId: string;
    players: { id: string; ws: WebSocket; username: string; team: LobbyTeam; jersey?: string }[];
    status: 'waiting' | 'playing';
    settings: LobbySettings;
}
export class GlobalDurableObject extends DurableObject {
    // State
    queues: Map<GameMode, { userId: string; ws: WebSocket; username: string; rating: number; jersey?: string }[]> = new Map();
    matches: Map<string, Match> = new Map();
    sessions: Map<WebSocket, { userId: string; matchId?: string; lobbyCode?: string }> = new Map();
    lobbies: Map<string, Lobby> = new Map();
    leaderboards: Map<GameMode, LeaderboardEntry[]> = new Map();
    // Tournament State
    tournamentParticipants: TournamentParticipant[] = [];
    currentSlot: number = 0;
    tournamentStatus: 'open' | 'in_progress' | 'completed' = 'open';
    bracket: TournamentMatch[] = [];
    pendingTournamentMatches: Map<string, { userId: string; ws: WebSocket; username: string; team: 'red' | 'blue'; jersey?: string }[]> = new Map();
    constructor(ctx: DurableObjectState, env: any) {
        super(ctx, env);
        this.queues.set('1v1', []);
        this.queues.set('2v2', []);
        this.queues.set('3v3', []);
        this.queues.set('4v4', []);
    }
    // --- WebSocket Handling ---
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);
        this.ctx.acceptWebSocket(server);
        return new Response(null, { status: 101, webSocket: client });
    }
    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
        try {
            const msg = JSON.parse(message as string) as WSMessage;
            await this.handleMessage(ws, msg);
        } catch (e) {
            console.error('[DurableObject] WS Message Error:', e);
        }
    }
    async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
        this.handleDisconnect(ws);
    }
    async webSocketError(ws: WebSocket, error: any) {
        this.handleDisconnect(ws);
    }
    // --- Core Logic ---
    async handleMessage(ws: WebSocket, msg: WSMessage) {
        try {
            switch (msg.type) {
                case 'join_queue': {
                    if (!msg.userId || !msg.mode) return;
                    const profile = await this.getUserProfile(msg.userId);
                    this.addToQueue(ws, msg.userId, msg.username, msg.mode, profile.stats[msg.mode].rating, profile.jersey);
                    break;
                }
                case 'join_match': {
                    // Direct join for Tournament matches
                    if (!msg.matchId || !msg.userId) return;
                    // 1. Check active matches (reconnect)
                    const match = this.matches.get(msg.matchId);
                    if (match) {
                        // Match already running, reconnect
                        const player = match.gameState.players.find(p => p.id === msg.userId);
                        if (player) {
                            match.players.set(msg.userId, { ws, team: player.team, username: msg.username });
                            this.sessions.set(ws, { userId: msg.userId, matchId: msg.matchId });
                            // Send current state
                            ws.send(JSON.stringify({ type: 'game_state', state: match.gameState }));
                        }
                        return;
                    }
                    // 2. Check pending tournament matches
                    const tMatch = this.bracket.find(m => m.id === msg.matchId);
                    if (tMatch && tMatch.status === 'in_progress') {
                        // Determine team
                        let team: 'red' | 'blue' | null = null;
                        if (tMatch.player1?.userId === msg.userId) team = 'red';
                        else if (tMatch.player2?.userId === msg.userId) team = 'blue';
                        if (!team) return; // User not in this match
                        // Get pending list
                        let pending = this.pendingTournamentMatches.get(msg.matchId) || [];
                        // Remove existing connection for this user if any (reconnect during pending)
                        pending = pending.filter(p => p.userId !== msg.userId);
                        const profile = await this.getUserProfile(msg.userId);
                        pending.push({
                            userId: msg.userId,
                            ws,
                            username: msg.username,
                            team,
                            jersey: profile.jersey
                        });
                        this.pendingTournamentMatches.set(msg.matchId, pending);
                        this.sessions.set(ws, { userId: msg.userId, matchId: msg.matchId });
                        // Check if ready to start (both players connected)
                        const p1 = pending.find(p => p.team === 'red');
                        const p2 = pending.find(p => p.team === 'blue');
                        if (p1 && p2) {
                            // Start Match
                            this.startMatch([p1, p2], [], '1v1', RANKED_SETTINGS, msg.matchId);
                            this.pendingTournamentMatches.delete(msg.matchId);
                        } else {
                            // Wait for opponent
                            ws.send(JSON.stringify({ type: 'tournament_waiting' }));
                        }
                    }
                    break;
                }
                case 'leave_queue':
                    this.removeFromQueue(ws);
                    break;
                case 'create_lobby':
                    this.handleCreateLobby(ws, msg.userId, msg.username);
                    break;
                case 'join_lobby':
                    this.handleJoinLobby(ws, msg.code, msg.userId, msg.username);
                    break;
                case 'update_lobby_settings':
                    this.handleUpdateLobbySettings(ws, msg.settings);
                    break;
                case 'switch_team':
                    this.handleSwitchTeam(ws, msg.team);
                    break;
                case 'kick_player':
                    this.handleKickPlayer(ws, msg.targetId);
                    break;
                case 'start_lobby_match':
                    this.handleStartLobbyMatch(ws);
                    break;
                case 'input': {
                    const session = this.sessions.get(ws);
                    if (session && session.matchId) {
                        const match = this.matches.get(session.matchId);
                        if (match) match.handleInput(session.userId, { move: msg.move, kick: msg.kick });
                    }
                    break;
                }
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
                case 'chat':
                    this.handleChat(ws, msg);
                    break;
                case 'emote':
                    this.handleEmote(ws, msg.emoji);
                    break;
            }
        } catch (err) {
            console.error("[DurableObject] Error handling message:", err);
        }
    }
    handleChat(ws: WebSocket, msg: any) {
        const session = this.sessions.get(ws);
        if (session) {
            if (session.matchId) {
                const match = this.matches.get(session.matchId);
                if (match) match.handleChat(session.userId, msg.message, msg.scope);
            } else if (session.lobbyCode) {
                const lobby = this.lobbies.get(session.lobbyCode);
                if (lobby) {
                    const sender = lobby.players.find(p => p.id === session.userId);
                    if (sender) {
                        const chatMsg = JSON.stringify({
                            type: 'chat',
                            message: msg.message.slice(0, 100),
                            sender: sender.username,
                            team: sender.team,
                            scope: msg.scope
                        });
                        // Filter recipients if team scope
                        lobby.players.forEach(p => {
                            if (msg.scope === 'team' && p.team !== sender.team) return;
                            try { p.ws.send(chatMsg); } catch(e){ /* empty */ }
                        });
                    }
                }
            }
        }
    }
    handleEmote(ws: WebSocket, emoji: string) {
        const session = this.sessions.get(ws);
        if (session) {
            if (session.matchId) {
                const match = this.matches.get(session.matchId);
                if (match) match.handleEmote(session.userId, emoji);
            } else if (session.lobbyCode) {
                const lobby = this.lobbies.get(session.lobbyCode);
                if (lobby) {
                    const msg = JSON.stringify({
                        type: 'emote',
                        emoji: emoji,
                        userId: session.userId
                    });
                    lobby.players.forEach(p => { try { p.ws.send(msg); } catch(e){ /* empty */ } });
                }
            }
        }
    }
    handleDisconnect(ws: WebSocket) {
        this.removeFromQueue(ws);
        const session = this.sessions.get(ws);
        if (session && session.lobbyCode) {
            const lobby = this.lobbies.get(session.lobbyCode);
            if (lobby) {
                lobby.players = lobby.players.filter(p => p.ws !== ws);
                if (lobby.players.length === 0) {
                    this.lobbies.delete(session.lobbyCode);
                } else {
                    if (lobby.hostId === session.userId) lobby.hostId = lobby.players[0].id;
                    this.broadcastLobbyUpdate(lobby);
                }
            }
        }
        // Clean up pending tournament matches
        for (const [matchId, players] of this.pendingTournamentMatches.entries()) {
            const idx = players.findIndex(p => p.ws === ws);
            if (idx !== -1) {
                players.splice(idx, 1);
                if (players.length === 0) {
                    this.pendingTournamentMatches.delete(matchId);
                } else {
                    this.pendingTournamentMatches.set(matchId, players);
                }
                break; // Found and removed
            }
        }
        this.sessions.delete(ws);
    }
    // --- Queue & Lobby Logic (Preserved) ---
    addToQueue(ws: WebSocket, userId: string, username: string, mode: GameMode, rating: number, jersey?: string) {
        this.removeFromQueue(ws);
        const queue = this.queues.get(mode) || [];
        if (!queue.find(p => p.userId === userId)) {
            queue.push({ userId, ws, username, rating, jersey });
            // Sort by rating ascending (lowest first) to match similar skills
            queue.sort((a, b) => a.rating - b.rating);
            this.queues.set(mode, queue);
            this.sessions.set(ws, { userId });
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
        if (updatedMode) this.broadcastQueueStatus(updatedMode);
    }
    broadcastQueueStatus(mode: GameMode) {
        const queue = this.queues.get(mode) || [];
        const msg = JSON.stringify({ type: 'queue_update', count: queue.length });
        queue.forEach(p => { try { p.ws.send(msg); } catch(e){ /* empty */ } });
    }
    checkQueue(mode: GameMode) {
        const queue = this.queues.get(mode) || [];
        const requiredPlayers = mode === '1v1' ? 2 : mode === '2v2' ? 4 : mode === '3v3' ? 6 : 8;
        if (queue.length >= requiredPlayers) {
            // Take the first N players (who are close in rating due to sort)
            const players = queue.splice(0, requiredPlayers);
            this.broadcastQueueStatus(mode);
            // Balance teams based on rating
            const balancedPlayers = this.balanceTeams(players, mode);
            // Map to match format
            const matchPlayers = balancedPlayers.map(p => ({
                userId: p.userId,
                ws: p.ws,
                username: p.username,
                team: p.team,
                jersey: p.jersey
            }));
            this.startMatch(matchPlayers, [], mode, RANKED_SETTINGS);
        }
    }
    // Random Team Assignment (No Skill Balancing)
    balanceTeams(players: { userId: string; ws: WebSocket; username: string; rating: number; jersey?: string }[], mode: GameMode) {
        // Random Shuffle (Fisher-Yates style via map-sort)
        const shuffled = players
            .map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);
        const mid = Math.ceil(shuffled.length / 2);
        const red = shuffled.slice(0, mid);
        const blue = shuffled.slice(mid);
        return [
            ...red.map(p => ({ ...p, team: 'red' as const })),
            ...blue.map(p => ({ ...p, team: 'blue' as const }))
        ];
    }
    // --- Lobby Methods (Preserved) ---
    async handleCreateLobby(ws: WebSocket, userId: string, username: string) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        const profile = await this.getUserProfile(userId);
        const lobby: Lobby = {
            code, hostId: userId,
            players: [{ id: userId, ws, username, team: 'spectator', jersey: profile.jersey }],
            status: 'waiting',
            settings: { scoreLimit: 3, timeLimit: 180, fieldSize: 'medium' }
        };
        this.lobbies.set(code, lobby);
        this.sessions.set(ws, { userId, lobbyCode: code });
        this.broadcastLobbyUpdate(lobby);
    }
    async handleJoinLobby(ws: WebSocket, code: string, userId: string, username: string) {
        const lobby = this.lobbies.get(code.toUpperCase());
        if (!lobby || lobby.status !== 'waiting' || lobby.players.length >= 16) {
            ws.send(JSON.stringify({ type: 'error', message: 'Cannot join lobby' }));
            return;
        }
        const profile = await this.getUserProfile(userId);
        lobby.players.push({ id: userId, ws, username, team: 'spectator', jersey: profile.jersey });
        this.sessions.set(ws, { userId, lobbyCode: code });
        this.broadcastLobbyUpdate(lobby);
    }
    handleUpdateLobbySettings(ws: WebSocket, settings: Partial<LobbySettings>) {
        const session = this.sessions.get(ws);
        if (!session?.lobbyCode) return;
        const lobby = this.lobbies.get(session.lobbyCode);
        if (lobby && lobby.hostId === session.userId) {
            lobby.settings = { ...lobby.settings, ...settings };
            this.broadcastLobbyUpdate(lobby);
        }
    }
    handleSwitchTeam(ws: WebSocket, team: LobbyTeam) {
        const session = this.sessions.get(ws);
        if (!session?.lobbyCode) return;
        const lobby = this.lobbies.get(session.lobbyCode);
        if (lobby) {
            const player = lobby.players.find(p => p.id === session.userId);
            if (player) {
                player.team = team;
                this.broadcastLobbyUpdate(lobby);
            }
        }
    }
    handleKickPlayer(ws: WebSocket, targetId: string) {
        const session = this.sessions.get(ws);
        if (!session?.lobbyCode) return;
        const lobby = this.lobbies.get(session.lobbyCode);
        if (lobby && lobby.hostId === session.userId && targetId !== session.userId) {
            const idx = lobby.players.findIndex(p => p.id === targetId);
            if (idx !== -1) {
                try { lobby.players[idx].ws.send(JSON.stringify({ type: 'kicked' })); } catch(e){ /* empty */ }
                lobby.players.splice(idx, 1);
                this.broadcastLobbyUpdate(lobby);
            }
        }
    }
    handleStartLobbyMatch(ws: WebSocket) {
        const session = this.sessions.get(ws);
        if (!session?.lobbyCode) return;
        const lobby = this.lobbies.get(session.lobbyCode);
        if (lobby && lobby.hostId === session.userId) {
            const red = lobby.players.filter(p => p.team === 'red');
            const blue = lobby.players.filter(p => p.team === 'blue');
            if (red.length > 0 && blue.length > 0) {
                lobby.status = 'playing';
                this.broadcastLobbyUpdate(lobby);
                const mode: GameMode = Math.max(red.length, blue.length) <= 1 ? '1v1' : '2v2'; // Simplified
                const players = [...red, ...blue].map(p => ({ userId: p.id, ws: p.ws, username: p.username, team: p.team as 'red'|'blue', jersey: p.jersey }));
                const spectators = lobby.players.filter(p => p.team === 'spectator').map(p => ({ userId: p.id, ws: p.ws, username: p.username }));
                this.startMatch(players, spectators, mode, lobby.settings);
            }
        }
    }
    broadcastLobbyUpdate(lobby: Lobby) {
        const state: LobbyState = {
            code: lobby.code,
            hostId: lobby.hostId,
            players: lobby.players.map(p => ({ id: p.id, username: p.username, team: p.team })),
            status: lobby.status,
            settings: lobby.settings
        };
        const msg = JSON.stringify({ type: 'lobby_update', state });
        lobby.players.forEach(p => { try { p.ws.send(msg); } catch(e){ /* empty */ } });
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
                    maxPlayers: 16,
                    status: lobby.status
                });
            }
        }
        return lobbies;
    }
    // --- Match Logic ---
    startMatch(
        players: { userId: string; ws: WebSocket; username: string; team?: 'red' | 'blue'; jersey?: string }[],
        spectators: { userId: string; ws: WebSocket; username: string }[],
        mode: GameMode,
        settings: LobbySettings,
        matchIdOverride?: string
    ) {
        const matchId = matchIdOverride || crypto.randomUUID();
        const matchPlayers = players.map((p, i) => ({
            id: p.userId,
            ws: p.ws,
            username: p.username,
            // Use assigned team if available, otherwise fallback to simple split
            team: p.team || (i < players.length / 2 ? 'red' : 'blue') as 'red' | 'blue',
            jersey: p.jersey
        }));
        const matchSpectators = spectators.map(s => ({ id: s.userId, ws: s.ws, username: s.username }));
        const match = new Match(matchId, matchPlayers, matchSpectators, settings, (id, winner, score) => {
            const matchInstance = this.matches.get(id);
            const playerStats = matchInstance ? Object.fromEntries(matchInstance.matchStats) : undefined;
            this.matches.delete(id);
            // If this was a tournament match, update the bracket
            const tMatch = this.bracket.find(m => m.id === id);
            if (tMatch) {
                this.handleTournamentMatchEnd(tMatch, winner, score);
            } else {
                this.ctx.waitUntil(this.handleMatchEnd(id, winner, matchPlayers, mode, score, playerStats));
            }
        });
        this.matches.set(matchId, match);
        // Notify players
        matchPlayers.forEach(p => {
            try {
                const session = this.sessions.get(p.ws);
                if (session) session.matchId = matchId;
                const opponents = matchPlayers.filter(op => op.team !== p.team).map(op => op.username);
                const type = session?.lobbyCode ? 'match_started' : 'match_found';
                p.ws.send(JSON.stringify({ type, matchId, team: p.team, opponent: opponents.join(', '), opponents }));
            } catch (err) { /* empty */ }
        });
        match.start();
    }
    // --- Tournament Logic (New) ---
    async getTournamentState(): Promise<TournamentState> {
        const now = Date.now();
        const interval = 5 * 60 * 1000; // 5 minutes
        const nextStartTime = Math.ceil(now / interval) * interval;
        if (this.currentSlot === 0) this.currentSlot = nextStartTime;
        // Check for rollover to new tournament
        if (nextStartTime > this.currentSlot) {
            // If previous tournament was open and had players, start it now
            if (this.tournamentStatus === 'open' && this.tournamentParticipants.length >= 2) {
                this.generateBracket();
                this.tournamentStatus = 'in_progress';
            } else {
                // Reset for new slot
                this.tournamentParticipants = [];
                this.bracket = [];
                this.tournamentStatus = 'open';
            }
            this.currentSlot = nextStartTime;
        }
        // Check timers for active matches
        if (this.tournamentStatus === 'in_progress') {
            this.checkMatchTimers();
        }
        return {
            nextStartTime: this.currentSlot,
            participants: this.tournamentParticipants,
            status: this.tournamentStatus,
            bracket: this.bracket
        };
    }
    generateBracket() {
        // Shuffle participants
        const shuffled = [...this.tournamentParticipants].sort(() => Math.random() - 0.5);
        const count = shuffled.length;
        // Calculate size (next power of 2)
        let size = 2;
        while (size < count) size *= 2;
        // Round 0 Matches
        const matches: TournamentMatch[] = [];
        const byes = size - count;
        // Create matches
        const slots: (TournamentParticipant | null)[] = new Array(size).fill(null);
        for (let i = 0; i < count; i++) {
            slots[i] = shuffled[i];
        }
        // Now create Round 0 matches
        const round0Matches = size / 2;
        for (let i = 0; i < round0Matches; i++) {
            const p1 = slots[i * 2];
            const p2 = slots[i * 2 + 1];
            const matchId = crypto.randomUUID();
            const match: TournamentMatch = {
                id: matchId,
                round: 0,
                matchIndex: i,
                player1: p1,
                player2: p2,
                p1Ready: false,
                p2Ready: false,
                status: 'scheduled'
            };
            // Handle Byes immediately
            if (p1 && !p2) {
                match.winnerId = p1.userId;
                match.status = 'completed';
                match.score = { p1: 3, p2: 0 }; // Default win score
            } else if (!p1 && p2) {
                // Should not happen with our fill strategy but handle it
                match.winnerId = p2.userId;
                match.status = 'completed';
                match.score = { p1: 0, p2: 3 };
            } else if (!p1 && !p2) {
                match.status = 'completed'; // Double bye?
            } else {
                // Real match
                match.startTime = Date.now();
            }
            matches.push(match);
        }
        // Generate future rounds placeholders
        let currentRoundMatches = round0Matches;
        let round = 1;
        while (currentRoundMatches > 1) {
            currentRoundMatches /= 2;
            for (let i = 0; i < currentRoundMatches; i++) {
                matches.push({
                    id: crypto.randomUUID(),
                    round: round,
                    matchIndex: i,
                    player1: null,
                    player2: null,
                    p1Ready: false,
                    p2Ready: false,
                    status: 'pending'
                });
            }
            round++;
        }
        this.bracket = matches;
        // Advance any auto-winners from Round 0
        this.advanceWinners();
    }
    advanceWinners() {
        // Check for completed matches and propagate winners to next round
        // We iterate rounds.
        const maxRound = Math.max(...this.bracket.map(m => m.round));
        for (let r = 0; r < maxRound; r++) {
            const roundMatches = this.bracket.filter(m => m.round === r);
            roundMatches.forEach(match => {
                if (match.status === 'completed' && match.winnerId) {
                    // Find next match
                    const nextRound = r + 1;
                    const nextMatchIndex = Math.floor(match.matchIndex / 2);
                    const isP1InNext = match.matchIndex % 2 === 0;
                    const nextMatch = this.bracket.find(m => m.round === nextRound && m.matchIndex === nextMatchIndex);
                    if (nextMatch) {
                        // Get winner participant details
                        const winner = match.winnerId === match.player1?.userId ? match.player1 : match.player2;
                        // Update next match
                        let changed = false;
                        if (isP1InNext && nextMatch.player1?.userId !== winner?.userId) {
                            nextMatch.player1 = winner || null;
                            changed = true;
                        } else if (!isP1InNext && nextMatch.player2?.userId !== winner?.userId) {
                            nextMatch.player2 = winner || null;
                            changed = true;
                        }
                        // If next match is now ready (both players present), schedule it
                        if (changed && nextMatch.player1 && nextMatch.player2 && nextMatch.status === 'pending') {
                            nextMatch.status = 'scheduled';
                            nextMatch.startTime = Date.now();
                            nextMatch.p1Ready = false;
                            nextMatch.p2Ready = false;
                        }
                    }
                }
            });
        }
        // Check if tournament is over (Final match completed)
        const finalMatch = this.bracket.find(m => m.round === maxRound);
        if (finalMatch && finalMatch.status === 'completed') {
            this.tournamentStatus = 'completed';
        }
    }
    checkMatchTimers() {
        const now = Date.now();
        const timeout = 2 * 60 * 1000; // 2 minutes
        this.bracket.forEach(match => {
            if (match.status === 'scheduled' && match.startTime) {
                if (now - match.startTime > timeout) {
                    // Timeout!
                    if (match.p1Ready && !match.p2Ready) {
                        match.winnerId = match.player1?.userId;
                        match.status = 'completed';
                        match.score = { p1: 3, p2: 0 }; // Forfeit score
                    } else if (!match.p1Ready && match.p2Ready) {
                        match.winnerId = match.player2?.userId;
                        match.status = 'completed';
                        match.score = { p1: 0, p2: 3 };
                    } else {
                        // Both timed out - Random winner or Coin Flip
                        // To keep bracket moving, pick random
                        const winner = Math.random() > 0.5 ? match.player1 : match.player2;
                        match.winnerId = winner?.userId;
                        match.status = 'completed';
                        match.score = { p1: 0, p2: 0 }; // Double forfeit stats?
                    }
                    this.advanceWinners();
                }
            }
        });
    }
    async joinTournamentMatch(matchId: string, userId: string): Promise<TournamentState> {
        const match = this.bracket.find(m => m.id === matchId);
        if (!match) throw new Error("Match not found");
        if (match.status !== 'scheduled') throw new Error("Match is not ready to join");
        if (match.player1?.userId === userId) {
            match.p1Ready = true;
        } else if (match.player2?.userId === userId) {
            match.p2Ready = true;
        } else {
            throw new Error("You are not in this match");
        }
        // Check if both ready
        if (match.p1Ready && match.p2Ready) {
            match.status = 'in_progress';
        }
        return this.getTournamentState();
    }
    handleTournamentMatchEnd(match: TournamentMatch, winner: 'red' | 'blue', score: { red: number; blue: number }) {
        // Map red/blue to player1/player2
        // In startMatch, we assigned team based on index.
        // P1 is index 0 (Red), P2 is index 1 (Blue).
        const winnerId = winner === 'red' ? match.player1?.userId : match.player2?.userId;
        match.winnerId = winnerId;
        match.status = 'completed';
        match.score = { p1: score.red, p2: score.blue };
        this.advanceWinners();
    }
    async joinTournament(userId: string): Promise<TournamentState> {
        if (this.tournamentStatus !== 'open') throw new Error("Tournament is closed");
        const profile = await this.getUserProfile(userId);
        if (!this.tournamentParticipants.find(p => p.userId === userId)) {
            this.tournamentParticipants.push({
                userId: profile.id,
                username: profile.username,
                country: profile.country || 'US',
                rank: `${profile.stats['1v1'].tier} ${profile.stats['1v1'].division}`,
                rating: profile.stats['1v1'].rating
            });
        }
        return this.getTournamentState();
    }
    async leaveTournament(userId: string): Promise<TournamentState> {
        if (this.tournamentStatus === 'open') {
            this.tournamentParticipants = this.tournamentParticipants.filter(p => p.userId !== userId);
        } else {
            // If in progress, maybe forfeit?
            // For MVP, just allow leaving, they will timeout in their match.
        }
        return this.getTournamentState();
    }
    // --- User & Auth Methods (Preserved) ---
    async signup(payload: AuthPayload): Promise<AuthResponse> {
        const { email, password, username, country } = payload;
        if (!email || !password || !username) throw new Error("Missing required fields");
        const emailIndex = (await this.ctx.storage.get<Record<string, string>>("email_index")) || {};
        if (emailIndex[email]) throw new Error("Email already registered");
        const userId = crypto.randomUUID();
        const credentials = { userId, password };
        await this.ctx.storage.put(`auth_${email}`, credentials);
        emailIndex[email] = userId;
        await this.ctx.storage.put("email_index", emailIndex);
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
        if (!credentials || credentials.password !== password) throw new Error("Invalid credentials");
        const profile = await this.getUserProfile(credentials.userId);
        return { userId: credentials.userId, profile };
    }
    async getUserProfile(userId: string, username: string = 'Player'): Promise<UserProfile> {
        const key = `user_${userId}`;
        let profile = await this.ctx.storage.get<any>(key);
        const defaultStats: ModeStats = { rating: RATING_DEFAULT, rd: RD_DEFAULT, volatility: VOLATILITY_DEFAULT, wins: 0, losses: 0, tier: 'Silver', division: 3, streak: 0, goals: 0, assists: 0, mvps: 0, cleanSheets: 0, ownGoals: 0 };
        if (!profile) {
            const newProfile: UserProfile = { id: userId, username, jersey: username.substring(0, 2).toUpperCase(), tournamentsWon: 0, stats: { '1v1': { ...defaultStats }, '2v2': { ...defaultStats }, '3v3': { ...defaultStats }, '4v4': { ...defaultStats } }, teams: [], lastMatchTime: Date.now(), recentMatches: [] };
            await this.ctx.storage.put(key, newProfile);
            return newProfile;
        }
        // Migrations
        if (!profile.stats) {
             const oldStats = { rating: profile.rating || RATING_DEFAULT, rd: profile.rd || RD_DEFAULT, volatility: profile.volatility || VOLATILITY_DEFAULT, wins: profile.wins || 0, losses: profile.losses || 0, tier: profile.tier || 'Silver', division: profile.division || 3, streak: 0, goals: 0, assists: 0, mvps: 0, cleanSheets: 0, ownGoals: 0 };
             profile = { id: profile.id, username: profile.username, stats: { '1v1': oldStats, '2v2': { ...defaultStats }, '3v3': { ...defaultStats }, '4v4': { ...defaultStats } }, teams: profile.teams || [], lastMatchTime: profile.lastMatchTime || Date.now(), recentMatches: profile.recentMatches || [] };
             await this.ctx.storage.put(key, profile);
        }
        if (!profile.teams) { profile.teams = []; await this.ctx.storage.put(key, profile); }
        if (!profile.recentMatches) { profile.recentMatches = []; await this.ctx.storage.put(key, profile); }
        if (!profile.jersey) { profile.jersey = profile.username.substring(0, 2).toUpperCase(); await this.ctx.storage.put(key, profile); }
        return profile as UserProfile;
    }
    async updateProfile(userId: string, updates: { jersey?: string }) {
        const profile = await this.getUserProfile(userId);
        if (updates.jersey) profile.jersey = updates.jersey.substring(0, 2).toUpperCase();
        await this.ctx.storage.put(`user_${userId}`, profile);
        return profile;
    }
    async recordTournamentWin(userId: string) {
        const profile = await this.getUserProfile(userId);
        profile.tournamentsWon = (profile.tournamentsWon || 0) + 1;
        await this.ctx.storage.put(`user_${userId}`, profile);
        return profile;
    }
    async createTeam(name: string, creatorId: string): Promise<TeamProfile> {
        const teamId = crypto.randomUUID();
        const defaultStats: ModeStats = { rating: RATING_DEFAULT, rd: RD_DEFAULT, volatility: VOLATILITY_DEFAULT, wins: 0, losses: 0, tier: 'Silver', division: 3, streak: 0, goals: 0, assists: 0, mvps: 0, cleanSheets: 0, ownGoals: 0 };
        let code = '';
        let isUnique = false;
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        while (!isUnique) {
            code = '';
            for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
            const existing = await this.ctx.storage.get(`team_code_${code}`);
            if (!existing) isUnique = true;
        }
        const creatorProfile = await this.getUserProfile(creatorId);
        const newTeam: TeamProfile = { id: teamId, name, code, members: [{ id: creatorId, username: creatorProfile.username }], stats: { '1v1': { ...defaultStats }, '2v2': { ...defaultStats }, '3v3': { ...defaultStats }, '4v4': { ...defaultStats } }, createdAt: Date.now(), creatorId, recentMatches: [] };
        await this.ctx.storage.put(`team_${teamId}`, newTeam);
        await this.ctx.storage.put(`team_code_${code}`, teamId);
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
        if (team.members.some(m => m.id === userId)) throw new Error("You are already a member of this team");
        team.members.push({ id: userId, username });
        await this.ctx.storage.put(`team_${teamId}`, team);
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
        if (team.members.length > 0 && typeof team.members[0] === 'string') {
            const newMembers: TeamMember[] = [];
            for (const memberId of team.members) {
                 const profile = await this.getUserProfile(memberId);
                 newMembers.push({ id: memberId, username: profile.username });
            }
            team.members = newMembers;
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
        const mode = match.mode || '1v1';
        let stats: ModeStats;
        let entityKey: string;
        let entity: UserProfile | TeamProfile;
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
        const qa = Math.log(10) / 400;
        const rdOpponent = 350;
        const g_rd = 1 / Math.sqrt(1 + 3 * Math.pow(qa * rdOpponent / Math.PI, 2));
        const E = 1 / (1 + Math.pow(10, -g_rd * (stats.rating - match.opponentRating) / 400));
        const totalMatches = (stats.wins || 0) + (stats.losses || 0);
        const isProvisional = totalMatches < 10;
        const K = isProvisional ? 150 : stats.rd / 10;
        const decayFactor = isProvisional ? 0.98 : 0.95;
        let ratingChange = K * (s - E);
        let streak = stats.streak || 0;
        if (match.result === 'win') streak++; else streak = 0;
        if (ratingChange > 0 && streak >= 3) ratingChange *= Math.min(1 + (streak - 2) * 0.1, 2.0);
        const newRating = stats.rating + ratingChange;
        const newRD = Math.max(30, stats.rd * decayFactor);
        stats.rating = Math.round(newRating);
        stats.rd = newRD;
        stats.streak = streak;
        if (match.result === 'win') stats.wins++;
        if (match.result === 'loss') stats.losses++;
        const statsKey = match.teamId || match.userId;
        if (match.playerStats && match.playerStats[statsKey]) {
            const pStats = match.playerStats[statsKey];
            stats.goals = (stats.goals || 0) + pStats.goals;
            stats.assists = (stats.assists || 0) + pStats.assists;
            stats.ownGoals = (stats.ownGoals || 0) + pStats.ownGoals;
            if (pStats.isMvp) stats.mvps = (stats.mvps || 0) + 1;
            if (pStats.cleanSheet) stats.cleanSheets = (stats.cleanSheets || 0) + 1;
        }
        const { tier, division } = this.calculateTier(stats.rating);
        stats.tier = tier;
        stats.division = division;
        const historyEntry: MatchHistoryEntry = {
            matchId: match.matchId || crypto.randomUUID(),
            opponentName: match.opponentName || 'Opponent',
            result: match.result,
            ratingChange: Math.round(ratingChange),
            timestamp: match.timestamp,
            mode,
            score: match.score
        };
        if (!entity.recentMatches) entity.recentMatches = [];
        entity.recentMatches.unshift(historyEntry);
        if (entity.recentMatches.length > 10) entity.recentMatches.pop();
        await this.ctx.storage.put(entityKey, entity);
        if (!match.teamId) await this.updateLeaderboard(mode, entity as UserProfile);
        return { newRating: stats.rating, ratingChange: Math.round(ratingChange), newTier: tier, newDivision: division, mode, teamId: match.teamId };
    }
    private calculateTier(rating: number): { tier: Tier, division: 1 | 2 | 3 } {
        if (rating < 900) return { tier: 'Bronze', division: rating < 300 ? 3 : rating < 600 ? 2 : 1 };
        if (rating < 1200) return { tier: 'Silver', division: rating < 1000 ? 3 : rating < 1100 ? 2 : 1 };
        if (rating < 1500) return { tier: 'Gold', division: rating < 1300 ? 3 : rating < 1400 ? 2 : 1 };
        if (rating < 1800) return { tier: 'Platinum', division: rating < 1600 ? 3 : rating < 1700 ? 2 : 1 };
        if (rating < 2100) return { tier: 'Diamond', division: rating < 1900 ? 3 : rating < 2000 ? 2 : 1 };
        return { tier: 'Master', division: 1 };
    }
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
        const entry: LeaderboardEntry = { userId: profile.id, username: profile.username, rating: stats.rating, tier: stats.tier, division: stats.division, country: profile.country };
        const idx = lb.findIndex(e => e.userId === profile.id);
        if (idx !== -1) lb[idx] = entry; else lb.push(entry);
        lb.sort((a, b) => b.rating - a.rating);
        if (lb.length > 50) lb.length = 50;
        this.leaderboards.set(mode, lb);
        await this.ctx.storage.put(`leaderboard_${mode}`, lb);
    }
    async handleMatchEnd(matchId: string, winner: 'red' | 'blue', players: { id: string, team: 'red' | 'blue', username: string }[], mode: GameMode, score: { red: number; blue: number }, playerStats?: Record<string, PlayerMatchStats>) {
        const playerProfiles = await Promise.all(players.map(p => this.getUserProfile(p.id)));
        const redPlayers = players.filter(p => p.team === 'red');
        const bluePlayers = players.filter(p => p.team === 'blue');
        const getSideProfiles = (sidePlayers: typeof players) => sidePlayers.map(p => playerProfiles.find(prof => prof.id === p.id)).filter(Boolean) as UserProfile[];
        const redProfiles = getSideProfiles(redPlayers);
        const blueProfiles = getSideProfiles(bluePlayers);
        const findCommonTeam = (profiles: UserProfile[]) => {
            if (profiles.length < 2) return null;
            const first = profiles[0].teams || [];
            const common = first.filter(teamId => profiles.every(p => (p.teams || []).includes(teamId)));
            return common.length > 0 ? common[0] : null;
        };
        const redTeamId = redPlayers.length >= 2 ? findCommonTeam(redProfiles) : null;
        const blueTeamId = bluePlayers.length >= 2 ? findCommonTeam(blueProfiles) : null;
        const getAvgRating = (profiles: UserProfile[]) => {
            if (profiles.length === 0) return 1200;
            const total = profiles.reduce((sum, p) => sum + (p.stats[mode]?.rating || 1200), 0);
            return total / profiles.length;
        };
        const redAvg = getAvgRating(redProfiles);
        const blueAvg = getAvgRating(blueProfiles);
        let redTeamName = 'Team Red';
        let blueTeamName = 'Team Blue';
        if (redTeamId) { const t = await this.getTeam(redTeamId); if (t) redTeamName = t.name; }
        if (blueTeamId) { const t = await this.getTeam(blueTeamId); if (t) blueTeamName = t.name; }
        const updates = players.map(async (p) => {
            const isRed = p.team === 'red';
            const opponentRating = isRed ? blueAvg : redAvg;
            const result = (winner === 'red' && isRed) || (winner === 'blue' && !isRed) ? 'win' : 'loss';
            const myScore = isRed ? score.red : score.blue;
            const opScore = isRed ? score.blue : score.red;
            let opponentName = 'Opponent';
            if (mode === '1v1') {
                const opponent = players.find(op => op.team !== p.team);
                opponentName = opponent ? opponent.username : 'Opponent';
            } else {
                opponentName = isRed ? blueTeamName : redTeamName;
            }
            await this.processMatch({ matchId, userId: p.id, opponentRating, opponentName, result, timestamp: Date.now(), mode, playerStats, score: { my: myScore, op: opScore } });
        });
        const teamUpdates: Promise<any>[] = [];
        const getAggregatedStats = (teamPlayers: typeof players, opponentPlayers: typeof players): PlayerMatchStats | undefined => {
            if (!playerStats || teamPlayers.length === 0) return undefined;
            let opponentGoals = 0;
            opponentPlayers.forEach(p => { if (playerStats[p.id]) opponentGoals += playerStats[p.id].goals; });
            const agg: PlayerMatchStats = { goals: 0, assists: 0, ownGoals: 0, isMvp: false, cleanSheet: opponentGoals === 0 };
            let hasStats = false;
            teamPlayers.forEach(p => { const s = playerStats[p.id]; if (s) { hasStats = true; agg.goals += s.goals; agg.assists += s.assists; agg.ownGoals += s.ownGoals; } });
            if (!hasStats) return undefined;
            return agg;
        };
        if (redTeamId) {
            const result = winner === 'red' ? 'win' : 'loss';
            const aggStats = getAggregatedStats(redPlayers, bluePlayers);
            const myScore = score.red;
            const opScore = score.blue;
            teamUpdates.push(this.processMatch({ matchId, userId: redPlayers[0].id, teamId: redTeamId, opponentRating: blueAvg, opponentName: blueTeamId ? blueTeamName : 'Opponents', result, timestamp: Date.now(), mode, playerStats: aggStats ? { [redTeamId]: aggStats } : undefined, score: { my: myScore, op: opScore } }));
        }
        if (blueTeamId) {
            const result = winner === 'blue' ? 'win' : 'loss';
            const aggStats = getAggregatedStats(bluePlayers, redPlayers);
            const myScore = score.blue;
            const opScore = score.red;
            teamUpdates.push(this.processMatch({ matchId, userId: bluePlayers[0].id, teamId: blueTeamId, opponentRating: redAvg, opponentName: redTeamId ? redTeamName : 'Opponents', result, timestamp: Date.now(), mode, playerStats: aggStats ? { [blueTeamId]: aggStats } : undefined, score: { my: myScore, op: opScore } }));
        }
        await Promise.all([...updates, ...teamUpdates]);
    }
}