import { DurableObject } from "cloudflare:workers";
import type { DemoItem, UserProfile, MatchResult, MatchResponse, Tier, WSMessage, GameMode } from '@shared/types';
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
        // But usually routes are handled via RPC calls from worker/index.ts
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
            case 'join_queue':
                this.addToQueue(ws, msg.userId, msg.username, msg.mode);
                break;
            case 'leave_queue':
                this.removeFromQueue(ws);
                break;
            case 'input':
                const session = this.sessions.get(ws);
                if (session && session.matchId) {
                    const match = this.matches.get(session.matchId);
                    if (match) {
                        match.handleInput(session.userId, { move: msg.move, kick: msg.kick });
                    }
                }
                break;
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
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
            // Process ratings here if needed
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
    async getUserProfile(userId: string, username: string = 'Player'): Promise<UserProfile> {
      const key = `user_${userId}`;
      const profile = await this.ctx.storage.get<UserProfile>(key);
      if (profile) return profile;
      const newProfile: UserProfile = {
        id: userId,
        username,
        rating: RATING_DEFAULT,
        rd: RD_DEFAULT,
        volatility: VOLATILITY_DEFAULT,
        wins: 0,
        losses: 0,
        tier: 'Silver',
        division: 3,
        lastMatchTime: Date.now()
      };
      await this.ctx.storage.put(key, newProfile);
      return newProfile;
    }
    async processMatch(match: MatchResult): Promise<MatchResponse> {
      const profile = await this.getUserProfile(match.userId);
      const s = match.result === 'win' ? 1 : match.result === 'loss' ? 0 : 0.5;
      const qa = Math.log(10) / 400;
      const rdOpponent = 350;
      const g_rd = 1 / Math.sqrt(1 + 3 * Math.pow(qa * rdOpponent / Math.PI, 2));
      const E = 1 / (1 + Math.pow(10, -g_rd * (profile.rating - match.opponentRating) / 400));
      const K = profile.rd / 10;
      const ratingChange = K * (s - E);
      const newRating = profile.rating + ratingChange;
      const newRD = Math.max(30, profile.rd * 0.95);
      profile.rating = Math.round(newRating);
      profile.rd = newRD;
      if (match.result === 'win') profile.wins++;
      if (match.result === 'loss') profile.losses++;
      profile.lastMatchTime = Date.now();
      const { tier, division } = this.calculateTier(profile.rating);
      profile.tier = tier;
      profile.division = division;
      await this.ctx.storage.put(`user_${match.userId}`, profile);
      return {
        newRating: profile.rating,
        ratingChange: Math.round(ratingChange),
        newTier: tier,
        newDivision: division
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
}