import { PhysicsEngine, GameState, Player } from '@shared/physics';
import { WSMessage } from '@shared/types';
export class Match {
  id: string;
  players: Map<string, { ws: WebSocket; team: 'red' | 'blue'; username: string }>;
  gameState: GameState;
  interval: any;
  onEnd: (matchId: string, winner: 'red' | 'blue') => void;
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
      pos: p.team === 'red' ? { x: 100, y: 200 } : { x: 700, y: 200 },
      vel: { x: 0, y: 0 },
      radius: PhysicsEngine.PLAYER_RADIUS,
      isKicking: false,
      input: { move: { x: 0, y: 0 }, kick: false }
    }));
    // Store WS connections
    players.forEach(p => {
      this.players.set(p.id, { ws: p.ws, team: p.team, username: p.username });
    });
  }
  start() {
    // Broadcast initial state
    this.broadcast({ type: 'game_state', state: this.gameState });
    // Start Game Loop (approx 30 TPS for server to save DO CPU)
    // We rely on client interpolation for smoothness
    this.interval = setInterval(() => {
      this.update();
    }, 1000 / 30);
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
  private update() {
    // Run physics (maybe multiple steps if we want 60fps physics on 30fps loop)
    // For now, 1 step per tick
    this.gameState = PhysicsEngine.update(this.gameState);
    // Broadcast
    this.broadcast({ type: 'game_state', state: this.gameState });
    // Check Win Condition
    if (this.gameState.score.red >= 3) {
      this.endGame('red');
    } else if (this.gameState.score.blue >= 3) {
      this.endGame('blue');
    }
  }
  private endGame(winner: 'red' | 'blue') {
    this.stop();
    this.broadcast({ type: 'game_over', winner });
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