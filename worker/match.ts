import { PhysicsEngine, GameState } from '@shared/physics';
import { WSMessage } from '@shared/types';
export class Match {
  id: string;
  players: Map<string, { ws: WebSocket; team: 'red' | 'blue'; username: string }>;
  gameState: GameState;
  interval: any;
  onEnd: (matchId: string, winner: 'red' | 'blue') => void;
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
      pos: p.team === 'red' 
        ? { x: 150, y: PhysicsEngine.FIELD_HEIGHT / 2 } 
        : { x: PhysicsEngine.FIELD_WIDTH - 150, y: PhysicsEngine.FIELD_HEIGHT / 2 },
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
  private update(dt: number) {
    // Run physics with delta time
    this.gameState = PhysicsEngine.update(this.gameState, dt);
    // Broadcast
    this.broadcast({ type: 'game_state', state: this.gameState });
    // Check Win Condition (Score or Time)
    if (this.gameState.status === 'ended') {
        // Time up - determine winner by score
        if (this.gameState.score.red > this.gameState.score.blue) {
            this.endGame('red');
        } else if (this.gameState.score.blue > this.gameState.score.red) {
            this.endGame('blue');
        } else {
            // Draw - for now, maybe sudden death? Or just end as draw (random winner for tournament logic simplicity in MVP)
            // For MVP, let's just say Red wins draws or handle it in the client
            // Actually, let's just pick Red for now to avoid stuck states
            this.endGame('red'); 
        }
    } else if (this.gameState.score.red >= 3) {
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