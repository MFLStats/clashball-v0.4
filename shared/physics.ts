export interface Vector {
  x: number;
  y: number;
}
export interface Player {
  id: string;
  team: 'red' | 'blue';
  username: string;
  pos: Vector;
  vel: Vector;
  radius: number;
  isKicking: boolean;
  input: {
    move: Vector;
    kick: boolean;
  };
}
export interface Ball {
  pos: Vector;
  vel: Vector;
  radius: number;
}
export interface Field {
  width: number;
  height: number;
  goalHeight: number;
}
export interface GameState {
  players: Player[];
  ball: Ball;
  score: { red: number; blue: number };
  field: Field;
  status: 'playing' | 'goal' | 'ended';
  timeRemaining: number;
}
export class PhysicsEngine {
  // Arcade Physics Constants
  static readonly PLAYER_RADIUS = 15;
  static readonly BALL_RADIUS = 10;
  static readonly FIELD_WIDTH = 800;
  static readonly FIELD_HEIGHT = 400;
  static readonly GOAL_HEIGHT = 120;
  // Movement & Feel
  static readonly PLAYER_ACCELERATION = 2.0; // Snappy acceleration
  static readonly PLAYER_MAX_SPEED = 5.0;    // Capped top speed
  static readonly PLAYER_DAMPING = 0.93;     // High friction for quick stops (slide)
  // Ball Physics
  static readonly BALL_DAMPING = 0.99;       // Low friction for long rolls
  static readonly KICK_STRENGTH = 8.0;       // Strong impulse
  static readonly WALL_BOUNCE = 0.8;         // Wall restitution
  static readonly PLAYER_BOUNCE = 0.5;       // Player-Player restitution
  static createInitialState(): GameState {
    return {
      players: [
        {
          id: 'p1',
          team: 'red',
          username: 'Player 1',
          pos: { x: 100, y: 200 },
          vel: { x: 0, y: 0 },
          radius: this.PLAYER_RADIUS,
          isKicking: false,
          input: { move: { x: 0, y: 0 }, kick: false }
        },
        {
          id: 'p2',
          team: 'blue',
          username: 'Player 2',
          pos: { x: 700, y: 200 },
          vel: { x: 0, y: 0 },
          radius: this.PLAYER_RADIUS,
          isKicking: false,
          input: { move: { x: 0, y: 0 }, kick: false }
        }
      ],
      ball: {
        pos: { x: 400, y: 200 },
        vel: { x: 0, y: 0 },
        radius: this.BALL_RADIUS
      },
      score: { red: 0, blue: 0 },
      field: {
        width: this.FIELD_WIDTH,
        height: this.FIELD_HEIGHT,
        goalHeight: this.GOAL_HEIGHT
      },
      status: 'playing',
      timeRemaining: 180 // 3 minutes
    };
  }
  static update(state: GameState): GameState {
    if (state.status !== 'playing') return state;
    // Deep copy for immutability (essential for React state / prediction rollback)
    const newState = JSON.parse(JSON.stringify(state)) as GameState;
    // --- 1. Update Players ---
    newState.players.forEach(p => {
      // Acceleration Logic
      if (p.input.move.x !== 0 || p.input.move.y !== 0) {
        // Normalize input
        const len = Math.sqrt(p.input.move.x ** 2 + p.input.move.y ** 2);
        const nx = p.input.move.x / (len || 1);
        const ny = p.input.move.y / (len || 1);
        p.vel.x += nx * this.PLAYER_ACCELERATION;
        p.vel.y += ny * this.PLAYER_ACCELERATION;
      }
      // Cap Speed
      const speed = Math.sqrt(p.vel.x ** 2 + p.vel.y ** 2);
      if (speed > this.PLAYER_MAX_SPEED) {
        const scale = this.PLAYER_MAX_SPEED / speed;
        p.vel.x *= scale;
        p.vel.y *= scale;
      }
      // Apply Velocity
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      // Apply Damping (Friction)
      p.vel.x *= this.PLAYER_DAMPING;
      p.vel.y *= this.PLAYER_DAMPING;
      // Stop completely if very slow (prevents micro-sliding)
      if (Math.abs(p.vel.x) < 0.01) p.vel.x = 0;
      if (Math.abs(p.vel.y) < 0.01) p.vel.y = 0;
      // Wall Collisions (Players)
      if (p.pos.x < p.radius) { p.pos.x = p.radius; p.vel.x = 0; }
      if (p.pos.x > newState.field.width - p.radius) { p.pos.x = newState.field.width - p.radius; p.vel.x = 0; }
      if (p.pos.y < p.radius) { p.pos.y = p.radius; p.vel.y = 0; }
      if (p.pos.y > newState.field.height - p.radius) { p.pos.y = newState.field.height - p.radius; p.vel.y = 0; }
      p.isKicking = p.input.kick;
    });
    // --- 2. Update Ball ---
    const b = newState.ball;
    b.pos.x += b.vel.x;
    b.pos.y += b.vel.y;
    // Ball Damping
    b.vel.x *= this.BALL_DAMPING;
    b.vel.y *= this.BALL_DAMPING;
    if (Math.abs(b.vel.x) < 0.01) b.vel.x = 0;
    if (Math.abs(b.vel.y) < 0.01) b.vel.y = 0;
    // Ball Wall Collisions
    if (b.pos.y < b.radius) {
        b.pos.y = b.radius;
        b.vel.y *= -this.WALL_BOUNCE;
    }
    if (b.pos.y > newState.field.height - b.radius) {
        b.pos.y = newState.field.height - b.radius;
        b.vel.y *= -this.WALL_BOUNCE;
    }
    // Goal Detection & X-Axis Walls
    // Left Side
    if (b.pos.x < 0) {
        const isGoal = b.pos.y > (newState.field.height - newState.field.goalHeight)/2 &&
                       b.pos.y < (newState.field.height + newState.field.goalHeight)/2;
        if (isGoal) {
            newState.score.blue++;
            this.resetPositions(newState);
            return newState;
        } else {
            b.pos.x = b.radius;
            b.vel.x *= -this.WALL_BOUNCE;
        }
    }
    // Right Side
    if (b.pos.x > newState.field.width) {
        const isGoal = b.pos.y > (newState.field.height - newState.field.goalHeight)/2 &&
                       b.pos.y < (newState.field.height + newState.field.goalHeight)/2;
        if (isGoal) {
            newState.score.red++;
            this.resetPositions(newState);
            return newState;
        } else {
            b.pos.x = newState.field.width - b.radius;
            b.vel.x *= -this.WALL_BOUNCE;
        }
    }
    // --- 3. Player-Ball Collision ---
    newState.players.forEach(p => {
      const dx = b.pos.x - p.pos.x;
      const dy = b.pos.y - p.pos.y;
      const distSq = dx*dx + dy*dy;
      const minDist = p.radius + b.radius;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        // Collision Normal
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);
        // Resolve Overlap (Push ball out)
        const overlap = minDist - dist;
        b.pos.x += nx * overlap;
        b.pos.y += ny * overlap;
        // Resolve Velocity
        if (p.isKicking) {
            // Kick adds strong impulse
            b.vel.x += nx * this.KICK_STRENGTH + p.vel.x * 0.5;
            b.vel.y += ny * this.KICK_STRENGTH + p.vel.y * 0.5;
        } else {
            // Normal collision (elastic-ish)
            // Simple reflection + transfer of player velocity
            const relVelX = b.vel.x - p.vel.x;
            const relVelY = b.vel.y - p.vel.y;
            const velAlongNormal = relVelX * nx + relVelY * ny;
            if (velAlongNormal < 0) { // Only resolve if moving towards each other
                const j = -(1 + 0.5) * velAlongNormal; // 0.5 restitution
                b.vel.x += j * nx;
                b.vel.y += j * ny;
                // Add some of player's velocity directly
                b.vel.x += p.vel.x * 0.5;
                b.vel.y += p.vel.y * 0.5;
            }
        }
      }
    });
    return newState;
  }
  static resetPositions(state: GameState) {
    state.ball.pos = { x: state.field.width / 2, y: state.field.height / 2 };
    state.ball.vel = { x: 0, y: 0 };
    state.players.forEach(p => {
      if (p.team === 'red') {
        p.pos = { x: 100, y: state.field.height / 2 };
      } else {
        p.pos = { x: state.field.width - 100, y: state.field.height / 2 };
      }
      p.vel = { x: 0, y: 0 };
    });
  }
}