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
  // Arcade Physics Constants - Tuned for "Tactical" feel (Phase 2 Update)
  static readonly PLAYER_RADIUS = 15;
  static readonly BALL_RADIUS = 10;
  // Field Expansion
  static readonly FIELD_WIDTH = 1200;
  static readonly FIELD_HEIGHT = 600;
  static readonly GOAL_HEIGHT = 180; // Proportional increase
  // Movement & Feel - Slowed down significantly
  static readonly PLAYER_ACCELERATION = 0.8; // Was 3.0 - Heavy feel
  static readonly PLAYER_MAX_SPEED = 3.5;    // Was 6.0 - Slower pace
  static readonly PLAYER_DAMPING = 0.90;     // Was 0.88 - Smoother drift
  // Ball Physics
  static readonly BALL_DAMPING = 0.990;      // Was 0.992 - Slightly more friction over distance
  static readonly KICK_STRENGTH = 6.0;       // Was 9.0 - Weaker kick for control
  static readonly WALL_BOUNCE = 0.75;
  static readonly PLAYER_BOUNCE = 0.5;
  static createInitialState(): GameState {
    return {
      players: [
        {
          id: 'p1',
          team: 'red',
          username: 'Player 1',
          pos: { x: 150, y: 300 }, // Updated for 1200x600
          vel: { x: 0, y: 0 },
          radius: this.PLAYER_RADIUS,
          isKicking: false,
          input: { move: { x: 0, y: 0 }, kick: false }
        },
        {
          id: 'p2',
          team: 'blue',
          username: 'Player 2',
          pos: { x: 1050, y: 300 }, // Updated for 1200x600
          vel: { x: 0, y: 0 },
          radius: this.PLAYER_RADIUS,
          isKicking: false,
          input: { move: { x: 0, y: 0 }, kick: false }
        }
      ],
      ball: {
        pos: { x: 600, y: 300 }, // Center of 1200x600
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
    // Deep copy for immutability
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
      // Stop completely if very slow
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
    // --- 3. Player-Ball Collision (Impulse Based) ---
    newState.players.forEach(p => {
      const dx = b.pos.x - p.pos.x;
      const dy = b.pos.y - p.pos.y;
      const distSq = dx*dx + dy*dy;
      const minDist = p.radius + b.radius;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        // Collision Normal (from player to ball)
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);
        // 1. Resolve Overlap (Push ball out)
        const overlap = minDist - dist;
        b.pos.x += nx * overlap;
        b.pos.y += ny * overlap;
        // 2. Resolve Velocity (Impulse)
        const relVelX = b.vel.x - p.vel.x;
        const relVelY = b.vel.y - p.vel.y;
        const velAlongNormal = relVelX * nx + relVelY * ny;
        // Only resolve if moving towards each other
        if (velAlongNormal < 0) {
            // Calculate impulse scalar
            // j = -(1 + e) * v_rel_norm
            const j = -(1 + this.PLAYER_BOUNCE) * velAlongNormal;
            // Apply impulse to ball (assuming infinite mass player for arcade feel)
            b.vel.x += j * nx;
            b.vel.y += j * ny;
            // Add some of player's velocity directly for "grip" feel
            b.vel.x += p.vel.x * 0.2;
            b.vel.y += p.vel.y * 0.2;
        }
        // 3. Kick Mechanic
        if (p.isKicking) {
            // Add strong impulse in normal direction
            b.vel.x += nx * this.KICK_STRENGTH;
            b.vel.y += ny * this.KICK_STRENGTH;
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
        p.pos = { x: 150, y: state.field.height / 2 }; // Updated spawn
      } else {
        p.pos = { x: state.field.width - 150, y: state.field.height / 2 }; // Updated spawn
      }
      p.vel = { x: 0, y: 0 };
    });
  }
}