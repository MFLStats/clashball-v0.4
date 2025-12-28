export interface Vector {
  x: number;
  y: number;
}
export interface Player {
  id: string;
  team: 'red' | 'blue';
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
  static readonly PLAYER_RADIUS = 15;
  static readonly BALL_RADIUS = 10;
  static readonly FIELD_WIDTH = 800;
  static readonly FIELD_HEIGHT = 400;
  static readonly GOAL_HEIGHT = 120;
  static readonly PLAYER_SPEED = 3;
  static readonly PLAYER_DAMPING = 0.9;
  static readonly BALL_DAMPING = 0.98;
  static readonly KICK_STRENGTH = 8;
  static createInitialState(): GameState {
    return {
      players: [
        {
          id: 'p1',
          team: 'red',
          pos: { x: 100, y: 200 },
          vel: { x: 0, y: 0 },
          radius: this.PLAYER_RADIUS,
          isKicking: false,
          input: { move: { x: 0, y: 0 }, kick: false }
        },
        {
          id: 'p2',
          team: 'blue',
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
    const newState = JSON.parse(JSON.stringify(state)) as GameState;
    // Update Players
    newState.players.forEach(p => {
      // Apply Input
      if (p.input.move.x !== 0 || p.input.move.y !== 0) {
        // Normalize input vector
        const len = Math.sqrt(p.input.move.x ** 2 + p.input.move.y ** 2);
        const nx = p.input.move.x / (len || 1);
        const ny = p.input.move.y / (len || 1);
        p.vel.x += nx * 0.5;
        p.vel.y += ny * 0.5;
      }
      // Cap Speed
      const speed = Math.sqrt(p.vel.x ** 2 + p.vel.y ** 2);
      if (speed > this.PLAYER_SPEED) {
        p.vel.x = (p.vel.x / speed) * this.PLAYER_SPEED;
        p.vel.y = (p.vel.y / speed) * this.PLAYER_SPEED;
      }
      // Apply Velocity
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      // Friction
      p.vel.x *= this.PLAYER_DAMPING;
      p.vel.y *= this.PLAYER_DAMPING;
      // Wall Collisions (Players)
      if (p.pos.x < p.radius) { p.pos.x = p.radius; p.vel.x *= -0.5; }
      if (p.pos.x > newState.field.width - p.radius) { p.pos.x = newState.field.width - p.radius; p.vel.x *= -0.5; }
      if (p.pos.y < p.radius) { p.pos.y = p.radius; p.vel.y *= -0.5; }
      if (p.pos.y > newState.field.height - p.radius) { p.pos.y = newState.field.height - p.radius; p.vel.y *= -0.5; }
      p.isKicking = p.input.kick;
    });
    // Update Ball
    const b = newState.ball;
    b.pos.x += b.vel.x;
    b.pos.y += b.vel.y;
    b.vel.x *= this.BALL_DAMPING;
    b.vel.y *= this.BALL_DAMPING;
    // Ball Wall Collisions
    if (b.pos.y < b.radius) { b.pos.y = b.radius; b.vel.y *= -0.8; }
    if (b.pos.y > newState.field.height - b.radius) { b.pos.y = newState.field.height - b.radius; b.vel.y *= -0.8; }
    // Goal Detection (Simplified X-axis check)
    if (b.pos.x < 0) {
        // Left Side
        if (b.pos.y > (newState.field.height - newState.field.goalHeight)/2 && b.pos.y < (newState.field.height + newState.field.goalHeight)/2) {
            newState.score.blue++;
            this.resetPositions(newState);
            return newState;
        } else {
            b.pos.x = b.radius; b.vel.x *= -0.8;
        }
    }
    if (b.pos.x > newState.field.width) {
        // Right Side
        if (b.pos.y > (newState.field.height - newState.field.goalHeight)/2 && b.pos.y < (newState.field.height + newState.field.goalHeight)/2) {
            newState.score.red++;
            this.resetPositions(newState);
            return newState;
        } else {
            b.pos.x = newState.field.width - b.radius; b.vel.x *= -0.8;
        }
    }
    // Player-Ball Collision & Kick
    newState.players.forEach(p => {
      const dx = b.pos.x - p.pos.x;
      const dy = b.pos.y - p.pos.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const minDist = p.radius + b.radius;
      if (dist < minDist) {
        // Collision Normal
        const nx = dx / dist;
        const ny = dy / dist;
        // Push ball out
        const overlap = minDist - dist;
        b.pos.x += nx * overlap;
        b.pos.y += ny * overlap;
        // Transfer momentum
        if (p.isKicking) {
          b.vel.x += nx * this.KICK_STRENGTH;
          b.vel.y += ny * this.KICK_STRENGTH;
        } else {
          b.vel.x += p.vel.x * 1.2;
          b.vel.y += p.vel.y * 1.2;
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