import { Hono } from "hono";
import { Env } from './core-utils';
import type {
    DemoItem, ApiResponse, UserProfile, MatchResult, MatchResponse,
    TeamProfile, AuthPayload, AuthResponse, TournamentState, LeaderboardEntry, GameMode,
    JoinTeamPayload, LobbyInfo
} from '@shared/types';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    app.get('/api/test', (c) => c.json({ success: true, data: { name: 'CF Workers Demo' }}));
    // --- WebSocket Route ---
    app.get('/api/ws', async (c) => {
        const upgradeHeader = c.req.header('Upgrade');
        if (!upgradeHeader || upgradeHeader !== 'websocket') {
            return c.text('Expected Upgrade: websocket', 426);
        }
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        return stub.fetch(c.req.raw);
    });
    // --- Existing Demo Routes ---
    app.get('/api/demo', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getDemoItems();
        return c.json({ success: true, data } satisfies ApiResponse<DemoItem[]>);
    });
    app.get('/api/counter', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getCounterValue();
        return c.json({ success: true, data } satisfies ApiResponse<number>);
    });
    app.post('/api/counter/increment', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.increment();
        return c.json({ success: true, data } satisfies ApiResponse<number>);
    });
    app.post('/api/demo', async (c) => {
        const body = await c.req.json() as DemoItem;
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.addDemoItem(body);
        return c.json({ success: true, data } satisfies ApiResponse<DemoItem[]>);
    });
    app.put('/api/demo/:id', async (c) => {
        const id = c.req.param('id');
        const body = await c.req.json() as Partial<Omit<DemoItem, 'id'>>;
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.updateDemoItem(id, body);
        return c.json({ success: true, data } satisfies ApiResponse<DemoItem[]>);
    });
    app.delete('/api/demo/:id', async (c) => {
        const id = c.req.param('id');
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.deleteDemoItem(id);
        return c.json({ success: true, data } satisfies ApiResponse<DemoItem[]>);
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
    // Get or Create User Profile
    app.post('/api/profile', async (c) => {
        const { userId, username } = await c.req.json() as { userId: string, username: string };
        if (!userId) return c.json({ success: false, error: 'Missing userId' }, 400);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getUserProfile(userId, username);
        return c.json({ success: true, data } satisfies ApiResponse<UserProfile>);
    });
    // Report Match Result
    app.post('/api/match/end', async (c) => {
        const body = await c.req.json() as MatchResult;
        if (!body.userId || !body.result) return c.json({ success: false, error: 'Invalid match data' }, 400);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.processMatch(body);
        return c.json({ success: true, data } satisfies ApiResponse<MatchResponse>);
    });
    // Get Leaderboard
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
    // --- Lobby Routes ---
    app.get('/api/lobbies', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getLobbies();
        return c.json({ success: true, data } satisfies ApiResponse<LobbyInfo[]>);
    });
}