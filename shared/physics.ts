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
  // Arcade Physics Constants - Tuned for Timestep Independence (Units per Second)
  static readonly PLAYER_RADIUS = 15;
  static readonly BALL_RADIUS = 10;
  // Field Dimensions
  static readonly FIELD_WIDTH = 1200;
  static readonly FIELD_HEIGHT = 600;
  static readonly GOAL_HEIGHT = 180;
  // Movement & Physics (Per Second)
  // Previous: 3.5 units/frame * 60 = 210 units/sec
  static readonly PLAYER_MAX_SPEED = 210;
  // Previous: 0.8 units/frame^2 * 60 * 60 = 2880 units/sec^2
  static readonly PLAYER_ACCELERATION = 2880;
  // Damping Base (Applied per 1/60s)
  // We use Math.pow(BASE, dt * 60) to apply it correctly for any dt
  static readonly PLAYER_DAMPING_BASE = 0.90;
  static readonly BALL_DAMPING_BASE = 0.990;
  // Kick Strength (Instantaneous Velocity Change)
  // Previous: 6.0 units/frame -> 360 units/sec
  static readonly KICK_STRENGTH = 360;
  static readonly WALL_BOUNCE = 0.75;
  static readonly PLAYER_BOUNCE = 0.5;
  // Velocity threshold for stopping (approx 0.01 units/frame -> 0.6 units/sec)
  static readonly STOP_THRESHOLD = 0.6;
  static createInitialState(): GameState {
    return {
      players: [
        {
          id: 'p1',
          team: 'red',
          username: 'Player 1',
          pos: { x: 150, y: 300 },
          vel: { x: 0, y: 0 },
          radius: this.PLAYER_RADIUS,
          isKicking: false,
          input: { move: { x: 0, y: 0 }, kick: false }
        },
        {
          id: 'p2',
          team: 'blue',
          username: 'Player 2',
          pos: { x: 1050, y: 300 },
          vel: { x: 0, y: 0 },
          radius: this.PLAYER_RADIUS,
          isKicking: false,
          input: { move: { x: 0, y: 0 }, kick: false }
        }
      ],
      ball: {
        pos: { x: 600, y: 300 },
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
      timeRemaining: 180 // 3 minutes in seconds
    };
  }
  static update(state: GameState, dt: number): GameState {
    if (state.status !== 'playing') return state;
    // Deep copy for immutability
    const newState = JSON.parse(JSON.stringify(state)) as GameState;
    // Update Time
    newState.timeRemaining -= dt;
    if (newState.timeRemaining <= 0) {
        newState.timeRemaining = 0;
        newState.status = 'ended';
    }
    // Calculate time-adjusted damping
    // If dt is 1/60 (0.016s), exponent is 1.
    const playerDamping = Math.pow(this.PLAYER_DAMPING_BASE, dt * 60);
    const ballDamping = Math.pow(this.BALL_DAMPING_BASE, dt * 60);
    // --- 1. Update Players ---
    newState.players.forEach(p => {
      // Acceleration
      if (p.input.move.x !== 0 || p.input.move.y !== 0) {
        // Normalize input
        const len = Math.sqrt(p.input.move.x ** 2 + p.input.move.y ** 2);
        const nx = p.input.move.x / (len || 1);
        const ny = p.input.move.y / (len || 1);
        // Apply acceleration scaled by dt
        p.vel.x += nx * this.PLAYER_ACCELERATION * dt;
        p.vel.y += ny * this.PLAYER_ACCELERATION * dt;
      }
      // Cap Speed
      const speed = Math.sqrt(p.vel.x ** 2 + p.vel.y ** 2);
      if (speed > this.PLAYER_MAX_SPEED) {
        const scale = this.PLAYER_MAX_SPEED / speed;
        p.vel.x *= scale;
        p.vel.y *= scale;
      }
      // Apply Velocity to Position
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      // Apply Damping
      p.vel.x *= playerDamping;
      p.vel.y *= playerDamping;
      // Stop completely if very slow
      if (Math.abs(p.vel.x) < this.STOP_THRESHOLD) p.vel.x = 0;
      if (Math.abs(p.vel.y) < this.STOP_THRESHOLD) p.vel.y = 0;
      // Wall Collisions (Players)
      if (p.pos.x < p.radius) { p.pos.x = p.radius; p.vel.x = 0; }
      if (p.pos.x > newState.field.width - p.radius) { p.pos.x = newState.field.width - p.radius; p.vel.x = 0; }
      if (p.pos.y < p.radius) { p.pos.y = p.radius; p.vel.y = 0; }
      if (p.pos.y > newState.field.height - p.radius) { p.pos.y = newState.field.height - p.radius; p.vel.y = 0; }
      p.isKicking = p.input.kick;
    });
    // --- 2. Update Ball ---
    const b = newState.ball;
    b.pos.x += b.vel.x * dt;
    b.pos.y += b.vel.y * dt;
    // Ball Damping
    b.vel.x *= ballDamping;
    b.vel.y *= ballDamping;
    if (Math.abs(b.vel.x) < this.STOP_THRESHOLD) b.vel.x = 0;
    if (Math.abs(b.vel.y) < this.STOP_THRESHOLD) b.vel.y = 0;
    // Ball Wall Collisions (Top/Bottom)
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
            // Apply impulse to ball
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
        p.pos = { x: 150, y: state.field.height / 2 };
      } else {
        p.pos = { x: state.field.width - 150, y: state.field.height / 2 };
      }
      p.vel = { x: 0, y: 0 };
    });
    state.status = 'playing';
  }
}