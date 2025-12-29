import { Hono } from "hono";
import { Env } from './core-utils';
import type {
    ApiResponse, UserProfile, MatchResult, MatchResponse,
    TeamProfile, AuthPayload, AuthResponse, TournamentState, LeaderboardEntry, GameMode,
    JoinTeamPayload, LobbyInfo
} from '@shared/types';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    app.get('/api/test', (c) => c.json({ success: true, data: { name: 'CF Workers Demo' }}));
    // --- WebSocket Route ---
    app.get('/api/ws', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        return stub.fetch(c.req.raw);
    });
    // --- Auth Routes ---
    app.post('/api/auth/signup', async (c) => {
        try {
            const body = await c.req.json() as AuthPayload;
            const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
            const data = await stub.signup(body);
            return c.json({ success: true, data } satisfies ApiResponse<AuthResponse>);
        } catch (e) {
            return c.json({ success: false, error: (e as Error).message }, 400);
        }
    });
    app.post('/api/auth/login', async (c) => {
        try {
            const body = await c.req.json() as AuthPayload;
            const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
            const data = await stub.login(body);
            return c.json({ success: true, data } satisfies ApiResponse<AuthResponse>);
        } catch (e) {
            return c.json({ success: false, error: (e as Error).message }, 401);
        }
    });
    // --- Ranked Routes ---
    app.post('/api/profile', async (c) => {
        const { userId, username } = await c.req.json() as { userId: string, username: string };
        if (!userId) return c.json({ success: false, error: 'Missing userId' }, 400);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getUserProfile(userId, username);
        return c.json({ success: true, data } satisfies ApiResponse<UserProfile>);
    });
    app.post('/api/profile/update', async (c) => {
        const { userId, jersey } = await c.req.json() as { userId: string, jersey?: string };
        if (!userId) return c.json({ success: false, error: 'Missing userId' }, 400);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.updateProfile(userId, { jersey });
        return c.json({ success: true, data } satisfies ApiResponse<UserProfile>);
    });
    app.post('/api/match/end', async (c) => {
        const body = await c.req.json() as MatchResult;
        if (!body.userId || !body.result) return c.json({ success: false, error: 'Invalid match data' }, 400);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.processMatch(body);
        return c.json({ success: true, data } satisfies ApiResponse<MatchResponse>);
    });
    app.get('/api/leaderboard/:mode', async (c) => {
        const mode = c.req.param('mode') as GameMode;
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getLeaderboard(mode);
        return c.json({ success: true, data } satisfies ApiResponse<LeaderboardEntry[]>);
    });
    // --- Team Routes ---
    app.post('/api/teams', async (c) => {
        const { name, creatorId } = await c.req.json() as { name: string, creatorId: string };
        if (!name || !creatorId) return c.json({ success: false, error: 'Missing required fields' }, 400);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.createTeam(name, creatorId);
        return c.json({ success: true, data } satisfies ApiResponse<TeamProfile>);
    });
    app.post('/api/teams/join', async (c) => {
        try {
            const { code, userId, username } = await c.req.json() as JoinTeamPayload;
            if (!code || !userId || !username) return c.json({ success: false, error: 'Missing required fields' }, 400);
            const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
            const data = await stub.joinTeam(code, userId, username);
            return c.json({ success: true, data } satisfies ApiResponse<TeamProfile>);
        } catch (e) {
            return c.json({ success: false, error: (e as Error).message }, 400);
        }
    });
    app.get('/api/teams/:id', async (c) => {
        const id = c.req.param('id');
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getTeam(id);
        if (!data) return c.json({ success: false, error: 'Team not found' }, 404);
        return c.json({ success: true, data } satisfies ApiResponse<TeamProfile>);
    });
    app.get('/api/users/:id/teams', async (c) => {
        const id = c.req.param('id');
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getUserTeams(id);
        return c.json({ success: true, data } satisfies ApiResponse<TeamProfile[]>);
    });
    // --- Tournament Routes ---
    app.get('/api/tournament', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getTournamentState();
        return c.json({ success: true, data } satisfies ApiResponse<TournamentState>);
    });
    app.post('/api/tournament/join', async (c) => {
        const { userId } = await c.req.json() as { userId: string };
        if (!userId) return c.json({ success: false, error: 'Missing userId' }, 400);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.joinTournament(userId);
        return c.json({ success: true, data } satisfies ApiResponse<TournamentState>);
    });
    app.post('/api/tournament/leave', async (c) => {
        const { userId } = await c.req.json() as { userId: string };
        if (!userId) return c.json({ success: false, error: 'Missing userId' }, 400);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.leaveTournament(userId);
        return c.json({ success: true, data } satisfies ApiResponse<TournamentState>);
    });
    app.post('/api/tournament/win', async (c) => {
        const { userId } = await c.req.json() as { userId: string };
        if (!userId) return c.json({ success: false, error: 'Missing userId' }, 400);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.recordTournamentWin(userId);
        return c.json({ success: true, data } satisfies ApiResponse<UserProfile>);
    });
    app.post('/api/tournament/match/join', async (c) => {
        try {
            const { matchId, userId } = await c.req.json() as { matchId: string, userId: string };
            if (!matchId || !userId) return c.json({ success: false, error: 'Missing required fields' }, 400);
            const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
            const data = await stub.joinTournamentMatch(matchId, userId);
            return c.json({ success: true, data } satisfies ApiResponse<TournamentState>);
        } catch (e) {
            return c.json({ success: false, error: (e as Error).message }, 400);
        }
    });
    // --- Lobby Routes ---
    app.get('/api/lobbies', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getLobbies();
        return c.json({ success: true, data } satisfies ApiResponse<LobbyInfo[]>);
    });
}