import { PhysicsEngine, GameState } from '@shared/physics';
import { WSMessage, PlayerMatchStats } from '@shared/types';
export class Match {
  id: string;
  players: Map<string, { ws: WebSocket; team: 'red' | 'blue'; username: string }>;
  gameState: GameState;
  interval: any;
  onEnd: (matchId: string, winner: 'red' | 'blue') => void;
  matchStats: Map<string, PlayerMatchStats> = new Map();
  private lastTime: number = Date.now();
  constructor(id: string, players: { id: string; ws: WebSocket; team: 'red' | 'blue'; username: string }[], onEnd: (id: string, winner: 'red' | 'blue') => void) {
    this.id = id;
    this.players = new Map();
    this.onEnd = onEnd;
    // Initialize Game State
    this.gameState = PhysicsEngine.createInitialState();
    // Override players in state with actual connected players
    this.gameState.players = players.map(p => ({
      id: p.id,
      team: p.team,
      username: p.username,
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
    const player = this.gameState.players.find(p => p.id === userId);
    if (player) {
      player.input = input;
    }
  }
  handleChat(userId: string, message: string) {
    const player = this.gameState.players.find(p => p.id === userId);
    if (!player) return;
    // Basic sanitization (truncate)
    const cleanMessage = message.slice(0, 100);
    this.broadcast({
        type: 'chat',
        message: cleanMessage,
        sender: player.username,
        team: player.team
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
    } else if (this.gameState.score.red >= 3 && !this.gameState.isOvertime) {
        // Regulation Mercy Rule / Score Limit
        this.endGame('red');
    } else if (this.gameState.score.blue >= 3 && !this.gameState.isOvertime) {
        // Regulation Mercy Rule / Score Limit
        this.endGame('blue');
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
    this.onEnd(this.id, winner);
  }
  private broadcast(msg: WSMessage) {
    const str = JSON.stringify(msg);
    this.players.forEach(({ ws }) => {
      try {
        ws.send(str);
      } catch (e) {
        // Handle disconnects?
      }
    });
  }
}