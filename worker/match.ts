import { PhysicsEngine, GameState } from '@shared/physics';
import { WSMessage, PlayerMatchStats, LobbySettings } from '@shared/types';
export class Match {
  id: string;
  players: Map<string, { ws: WebSocket; team: 'red' | 'blue'; username: string }>;
  spectators: Map<string, { ws: WebSocket; username: string }>;
  gameState: GameState;
  interval: any;
  onEnd: (matchId: string, winner: 'red' | 'blue', score: { red: number; blue: number }) => void;
  matchStats: Map<string, PlayerMatchStats> = new Map();
  settings: LobbySettings;
  private lastTime: number = Date.now();
  constructor(
    id: string,
    players: { id: string; ws: WebSocket; team: 'red' | 'blue'; username: string; jersey?: string }[],
    spectators: { id: string; ws: WebSocket; username: string }[],
    settings: LobbySettings,
    onEnd: (id: string, winner: 'red' | 'blue', score: { red: number; blue: number }) => void
  ) {
    this.id = id;
    this.players = new Map();
    this.spectators = new Map();
    this.settings = settings;
    this.onEnd = onEnd;
    // Initialize Game State with custom time limit and field size
    this.gameState = PhysicsEngine.createInitialState(settings.timeLimit, settings.fieldSize);
    // Override players in state with actual connected players
    this.gameState.players = players.map(p => ({
      id: p.id,
      team: p.team,
      username: p.username,
      jersey: p.jersey, // Set custom jersey
      pos: { x: 0, y: 0 }, // Will be set by resetPositions
      vel: { x: 0, y: 0 },
      radius: PhysicsEngine.PLAYER_RADIUS,
      isKicking: false,
      input: { move: { x: 0, y: 0 }, kick: false }
    }));
    // Apply correct formation based on team size
    PhysicsEngine.resetPositions(this.gameState);
    // Store WS connections and Init Stats
    players.forEach(p => {
      this.players.set(p.id, { ws: p.ws, team: p.team, username: p.username });
      this.matchStats.set(p.id, {
        goals: 0,
        assists: 0,
        ownGoals: 0,
        isMvp: false,
        cleanSheet: false
      });
    });
    // Store Spectators
    spectators.forEach(s => {
        this.spectators.set(s.id, { ws: s.ws, username: s.username });
    });
  }
  start() {
    this.lastTime = Date.now();
    // Broadcast initial state
    this.broadcast({ type: 'game_state', state: this.gameState });
    // Start Game Loop
    // We aim for 60 TPS, but calculate actual dt to be robust against lag
    this.interval = setInterval(() => {
      const now = Date.now();
      const dt = (now - this.lastTime) / 1000; // Convert ms to seconds
      this.lastTime = now;
      this.update(dt);
    }, 1000 / 60);
  }
  stop() {
    if (this.interval) clearInterval(this.interval);
  }
  handleInput(userId: string, input: { move: { x: number; y: number }; kick: boolean }) {
    // Only process input if user is a player
    if (this.players.has(userId)) {
        const player = this.gameState.players.find(p => p.id === userId);
        if (player) {
            player.input = input;
        }
    }
  }
  handleChat(userId: string, message: string) {
    let senderName = 'Unknown';
    let team: 'red' | 'blue' | 'spectator' = 'spectator';
    if (this.players.has(userId)) {
        const p = this.players.get(userId)!;
        senderName = p.username;
        team = p.team;
    } else if (this.spectators.has(userId)) {
        const s = this.spectators.get(userId)!;
        senderName = s.username;
        team = 'spectator';
    } else {
        return; // Unknown user
    }
    // Basic sanitization (truncate)
    const cleanMessage = message.slice(0, 100);
    this.broadcast({
        type: 'chat',
        message: cleanMessage,
        sender: senderName,
        team: team
    });
  }
  private update(dt: number) {
    // Run physics with delta time
    const { state, events } = PhysicsEngine.update(this.gameState, dt);
    this.gameState = state;
    // Process Events for Stats
    events.forEach(event => {
        if (event.type === 'goal' && event.team) {
            // Handle Scorer
            if (event.scorerId) {
                const scorer = this.gameState.players.find(p => p.id === event.scorerId);
                const stats = this.matchStats.get(event.scorerId);
                if (scorer && stats) {
                    if (scorer.team === event.team) {
                        stats.goals++;
                    } else {
                        stats.ownGoals++;
                    }
                }
            }
            // Handle Assister
            if (event.assisterId) {
                const stats = this.matchStats.get(event.assisterId);
                if (stats) stats.assists++;
            }
        }
    });
    // Broadcast State
    this.broadcast({ type: 'game_state', state: this.gameState });
    // Broadcast Events
    if (events.length > 0) {
        this.broadcast({ type: 'game_events', events });
    }
    // Check Win Condition (Score or Time)
    if (this.gameState.status === 'ended') {
        // Game ended via Time Expiry (Regulation) or Golden Goal (Overtime)
        if (this.gameState.score.red > this.gameState.score.blue) {
            this.endGame('red');
        } else if (this.gameState.score.blue > this.gameState.score.red) {
            this.endGame('blue');
        } else {
            // Fallback for extremely rare edge cases (should not happen with Golden Goal logic)
            this.endGame('red');
        }
    } else if (this.settings.scoreLimit > 0) {
        // Check Score Limit (Mercy Rule)
        if (this.gameState.score.red >= this.settings.scoreLimit && !this.gameState.isOvertime) {
            this.endGame('red');
        } else if (this.gameState.score.blue >= this.settings.scoreLimit && !this.gameState.isOvertime) {
            this.endGame('blue');
        }
    }
  }
  private endGame(winner: 'red' | 'blue') {
    this.stop();
    // Calculate MVP and Clean Sheets
    let maxScore = -1;
    let mvpId = '';
    this.matchStats.forEach((stats, userId) => {
        // MVP Score: Goals * 10 + Assists * 5 - OwnGoals * 5
        const score = (stats.goals * 10) + (stats.assists * 5) - (stats.ownGoals * 5);
        if (score > maxScore) {
            maxScore = score;
            mvpId = userId;
        }
        // Clean Sheet
        const player = this.gameState.players.find(p => p.id === userId);
        if (player) {
            const opponentScore = player.team === 'red' ? this.gameState.score.blue : this.gameState.score.red;
            if (opponentScore === 0) {
                stats.cleanSheet = true;
            }
        }
    });
    // Set MVP
    if (mvpId) {
        const stats = this.matchStats.get(mvpId);
        if (stats) stats.isMvp = true;
    }
    // Convert Map to Object for transmission
    const statsObj = Object.fromEntries(this.matchStats);
    // Broadcast Game Over with Stats
    this.broadcast({ type: 'game_over', winner, stats: statsObj });
    this.onEnd(this.id, winner, this.gameState.score);
  }
  private broadcast(msg: WSMessage) {
    const str = JSON.stringify(msg);
    // Send to Players
    this.players.forEach(({ ws }) => {
      try {
        ws.send(str);
      } catch (e) {
        // Handle disconnects?
      }
    });
    // Send to Spectators
    this.spectators.forEach(({ ws }) => {
        try {
            ws.send(str);
        } catch (e) {
            // Handle disconnects?
        }
    });
  }
}