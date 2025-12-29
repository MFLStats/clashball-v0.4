import { GameEvent } from './types';
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
export interface BallTouch {
  id: string;
  team: 'red' | 'blue';
  time: number;
}
export interface Ball {
  pos: Vector;
  vel: Vector;
  radius: number;
  lastTouch: BallTouch | null;
  previousTouch: BallTouch | null;
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
  static readonly PLAYER_MAX_SPEED = 210;
  static readonly PLAYER_ACCELERATION = 2880;
  // Damping Base (Applied per 1/60s)
  static readonly PLAYER_DAMPING_BASE = 0.90;
  static readonly BALL_DAMPING_BASE = 0.990;
  // Kick Strength (Instantaneous Velocity Change)
  static readonly KICK_STRENGTH = 360;
  static readonly WALL_BOUNCE = 0.75;
  static readonly PLAYER_BOUNCE = 0.5;
  // Velocity threshold for stopping
  static readonly STOP_THRESHOLD = 0.6;
  // Assist Window (seconds)
  static readonly ASSIST_WINDOW = 3.0;
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
        radius: this.BALL_RADIUS,
        lastTouch: null,
        previousTouch: null
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
  static update(state: GameState, dt: number): { state: GameState; events: GameEvent[] } {
    const events: GameEvent[] = [];
    if (state.status !== 'playing') return { state, events };
    // Deep copy for immutability
    const newState = JSON.parse(JSON.stringify(state)) as GameState;
    // Update Time
    newState.timeRemaining -= dt;
    if (newState.timeRemaining <= 0) {
        newState.timeRemaining = 0;
        newState.status = 'ended';
        events.push({ type: 'whistle' });
    }
    // Calculate time-adjusted damping
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
        events.push({ type: 'wall' });
    }
    if (b.pos.y > newState.field.height - b.radius) {
        b.pos.y = newState.field.height - b.radius;
        b.vel.y *= -this.WALL_BOUNCE;
        events.push({ type: 'wall' });
    }
    // Goal Detection & X-Axis Walls
    const checkGoal = (isLeft: boolean) => {
        const isGoal = b.pos.y > (newState.field.height - newState.field.goalHeight)/2 &&
                       b.pos.y < (newState.field.height + newState.field.goalHeight)/2;
        if (isGoal) {
            const scoringTeam = isLeft ? 'blue' : 'red';
            newState.score[scoringTeam]++;
            // Determine Scorer & Assister
            let scorerId: string | undefined;
            let assisterId: string | undefined;
            if (b.lastTouch) {
                if (b.lastTouch.team === scoringTeam) {
                    scorerId = b.lastTouch.id;
                    // Check Assist
                    if (b.previousTouch &&
                        b.previousTouch.team === scoringTeam &&
                        b.previousTouch.id !== scorerId &&
                        Math.abs(b.lastTouch.time - b.previousTouch.time) < this.ASSIST_WINDOW) {
                        assisterId = b.previousTouch.id;
                    }
                } else {
                    // Own Goal
                    scorerId = b.lastTouch.id; // Still attribute to last toucher, but logic handles it as OG
                }
            }
            events.push({ type: 'goal', team: scoringTeam, scorerId, assisterId });
            this.resetPositions(newState);
            return true;
        }
        return false;
    };
    // Left Side
    if (b.pos.x < 0) {
        if (checkGoal(true)) return { state: newState, events };
        b.pos.x = b.radius;
        b.vel.x *= -this.WALL_BOUNCE;
        events.push({ type: 'wall' });
    }
    // Right Side
    if (b.pos.x > newState.field.width) {
        if (checkGoal(false)) return { state: newState, events };
        b.pos.x = newState.field.width - b.radius;
        b.vel.x *= -this.WALL_BOUNCE;
        events.push({ type: 'wall' });
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
            const j = -(1 + this.PLAYER_BOUNCE) * velAlongNormal;
            // Apply impulse to ball
            b.vel.x += j * nx;
            b.vel.y += j * ny;
            // Add some of player's velocity directly for "grip" feel
            b.vel.x += p.vel.x * 0.2;
            b.vel.y += p.vel.y * 0.2;
            // Update Touch History
            if (b.lastTouch?.id !== p.id) {
                b.previousTouch = b.lastTouch;
            }
            b.lastTouch = {
                id: p.id,
                team: p.team,
                time: newState.timeRemaining // Use game time
            };
            // Event
            if (p.isKicking) {
                events.push({ type: 'kick' });
            } else {
                events.push({ type: 'player' });
            }
        }
        // 3. Kick Mechanic
        if (p.isKicking) {
            // Add strong impulse in normal direction
            b.vel.x += nx * this.KICK_STRENGTH;
            b.vel.y += ny * this.KICK_STRENGTH;
        }
      }
    });
    return { state: newState, events };
  }
  static resetPositions(state: GameState) {
    state.ball.pos = { x: state.field.width / 2, y: state.field.height / 2 };
    state.ball.vel = { x: 0, y: 0 };
    state.ball.lastTouch = null;
    state.ball.previousTouch = null;
    const redPlayers = state.players.filter(p => p.team === 'red');
    const bluePlayers = state.players.filter(p => p.team === 'blue');
    const setFormation = (players: Player[], isRed: boolean) => {
        const count = players.length;
        // Base X: Red on left (150), Blue on right (Width - 150)
        const baseX = isRed ? 150 : state.field.width - 150;
        players.forEach((p, index) => {
            p.vel = { x: 0, y: 0 };
            p.input = { move: { x: 0, y: 0 }, kick: false }; // Reset inputs
            if (count === 1) {
                // Center
                p.pos = { x: baseX, y: state.field.height / 2 };
            } else {
                // Distribute vertically
                const segment = state.field.height / (count + 1);
                p.pos = { x: baseX, y: segment * (index + 1) };
            }
        });
    };
    setFormation(redPlayers, true);
    setFormation(bluePlayers, false);
    state.status = 'playing';
  }
}