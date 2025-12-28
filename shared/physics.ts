import { GameEvent, GameMode } from './types';
export interface Vector {
  x: number;
  y: number;
}
export interface Player {
  id: string;
  team: 'red' | 'blue';
  username: string;
  jersey?: string; // Custom 2-char code
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
export interface GoalPost {
  pos: Vector;
  radius: number;
}
export interface Field {
  width: number;
  height: number;
  goalHeight: number;
  goalPosts: GoalPost[];
}
export interface GameState {
  players: Player[];
  ball: Ball;
  score: { red: number; blue: number };
  field: Field;
  status: 'playing' | 'goal' | 'ended';
  timeRemaining: number;
  isOvertime: boolean;
  goalTimer?: number;
}
export class PhysicsEngine {
  // Arcade Physics Constants - Tuned for Timestep Independence (Units per Second)
  static readonly PLAYER_RADIUS = 15;
  static readonly BALL_RADIUS = 10;
  static readonly POST_RADIUS = 8;
  // Kick Mechanics
  static readonly KICK_TOLERANCE = 5; // Extra range for kicking
  static readonly KICK_STRENGTH = 550; // Increased for faster gameplay
  // Field Dimensions
  static readonly FIELD_SIZES = {
    small: { width: 900, height: 450 },
    medium: { width: 1200, height: 600 },
    large: { width: 1500, height: 750 }
  };
  static readonly GOAL_HEIGHT = 180;
  // Movement & Physics (Per Second)
  static readonly PLAYER_MAX_SPEED = 240;
  static readonly PLAYER_ACCELERATION = 1200;
  // Damping Base (Applied per 1/60s)
  static readonly PLAYER_DAMPING_BASE = 0.89;
  static readonly BALL_DAMPING_BASE = 0.990;
  static readonly WALL_BOUNCE = 0.75;
  static readonly PLAYER_BOUNCE = 0.5;
  static readonly POST_BOUNCE = 0.7;
  // Velocity threshold for stopping
  static readonly STOP_THRESHOLD = 0.6;
  // Assist Window (seconds)
  static readonly ASSIST_WINDOW = 3.0;
  static createInitialState(
      timeLimit: number = 180,
      fieldSize: 'small' | 'medium' | 'large' = 'medium',
      mode: GameMode = '1v1'
  ): GameState {
    const dims = this.FIELD_SIZES[fieldSize];
    const goalTopY = (dims.height - this.GOAL_HEIGHT) / 2;
    const goalBottomY = (dims.height + this.GOAL_HEIGHT) / 2;
    const field: Field = {
        width: dims.width,
        height: dims.height,
        goalHeight: this.GOAL_HEIGHT,
        goalPosts: [
            { pos: { x: 0, y: goalTopY }, radius: this.POST_RADIUS }, // Top-Left
            { pos: { x: 0, y: goalBottomY }, radius: this.POST_RADIUS }, // Bottom-Left
            { pos: { x: dims.width, y: goalTopY }, radius: this.POST_RADIUS }, // Top-Right
            { pos: { x: dims.width, y: goalBottomY }, radius: this.POST_RADIUS } // Bottom-Right
        ]
    };
    const players: Player[] = [];
    const teamSize = mode === '1v1' ? 1 : mode === '2v2' ? 2 : mode === '3v3' ? 3 : 4;
    // Create Red Team
    for (let i = 0; i < teamSize; i++) {
        players.push({
            id: `red_${i}`,
            team: 'red',
            username: i === 0 ? 'Player' : `Bot R${i}`, // First red is Player
            jersey: i === 0 ? 'P1' : `R${i}`,
            pos: { x: 0, y: 0 }, // Will be set by resetPositions
            vel: { x: 0, y: 0 },
            radius: this.PLAYER_RADIUS,
            isKicking: false,
            input: { move: { x: 0, y: 0 }, kick: false }
        });
    }
    // Create Blue Team
    for (let i = 0; i < teamSize; i++) {
        players.push({
            id: `blue_${i}`,
            team: 'blue',
            username: `Bot B${i+1}`,
            jersey: `B${i+1}`,
            pos: { x: 0, y: 0 },
            vel: { x: 0, y: 0 },
            radius: this.PLAYER_RADIUS,
            isKicking: false,
            input: { move: { x: 0, y: 0 }, kick: false }
        });
    }
    const state: GameState = {
      players,
      ball: {
        pos: { x: field.width / 2, y: field.height / 2 },
        vel: { x: 0, y: 0 },
        radius: this.BALL_RADIUS,
        lastTouch: null,
        previousTouch: null
      },
      score: { red: 0, blue: 0 },
      field: field,
      status: 'playing',
      timeRemaining: timeLimit,
      isOvertime: false,
      goalTimer: 0
    };
    this.resetPositions(state);
    return state;
  }
  static update(state: GameState, dt: number): { state: GameState; events: GameEvent[] } {
    const events: GameEvent[] = [];
    // Deep copy for immutability
    const newState = JSON.parse(JSON.stringify(state)) as GameState;
    // Handle Goal Pause State
    if (newState.status === 'goal') {
        if (newState.goalTimer !== undefined) {
            newState.goalTimer -= dt;
            if (newState.goalTimer <= 0) {
                this.resetPositions(newState);
            }
        } else {
            this.resetPositions(newState);
        }
        return { state: newState, events };
    }
    if (newState.status !== 'playing') return { state: newState, events };
    // Update Time
    if (newState.timeRemaining > 0) {
        newState.timeRemaining -= dt;
        if (newState.timeRemaining <= 0) {
            newState.timeRemaining = 0;
            // Check for Overtime Condition
            if (newState.score.red === newState.score.blue) {
                if (!newState.isOvertime) {
                    newState.isOvertime = true;
                }
            } else {
                // Regulation ended with a winner
                newState.status = 'ended';
                events.push({ type: 'whistle' });
            }
        }
    }
    // Calculate time-adjusted damping
    const playerDamping = Math.pow(this.PLAYER_DAMPING_BASE, dt * 60);
    const ballDamping = Math.pow(this.BALL_DAMPING_BASE, dt * 60);
    // --- 1. Update Players (Refactored for Collision) ---
    // Phase 1: Movement & Input
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
      // Update Kick State
      p.isKicking = p.input.kick;
    });
    // Phase 2: Player-Player Collisions
    const players = newState.players;
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const p1 = players[i];
        const p2 = players[j];
        const dx = p2.pos.x - p1.pos.x;
        const dy = p2.pos.y - p1.pos.y;
        const distSq = dx * dx + dy * dy;
        const minDist = p1.radius + p2.radius;
        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          // Handle exact overlap (rare but possible)
          let nx = 0, ny = 0;
          if (dist === 0) {
             nx = 1; 
             ny = 0;
          } else {
             nx = dx / dist;
             ny = dy / dist;
          }
          // 1. Position Correction (Separation)
          const overlap = minDist - dist;
          // Move each player apart by half the overlap
          const separationX = nx * overlap * 0.5;
          const separationY = ny * overlap * 0.5;
          p1.pos.x -= separationX;
          p1.pos.y -= separationY;
          p2.pos.x += separationX;
          p2.pos.y += separationY;
          // 2. Velocity Resolution (Impulse)
          const rvx = p2.vel.x - p1.vel.x;
          const rvy = p2.vel.y - p1.vel.y;
          const velAlongNormal = rvx * nx + rvy * ny;
          // Only resolve if moving towards each other
          if (velAlongNormal < 0) {
             // Restitution (0.1 for low bounce/inelastic)
             const e = 0.1;
             // Impulse scalar (assuming equal mass m=1)
             // j = -(1 + e) * velAlongNormal / (1/m1 + 1/m2)
             let j = -(1 + e) * velAlongNormal;
             j /= 2; 
             const impulseX = j * nx;
             const impulseY = j * ny;
             p1.vel.x -= impulseX;
             p1.vel.y -= impulseY;
             p2.vel.x += impulseX;
             p2.vel.y += impulseY;
          }
        }
      }
    }
    // Phase 3: Wall Constraints
    newState.players.forEach(p => {
      if (p.pos.x < p.radius) { p.pos.x = p.radius; p.vel.x = 0; }
      if (p.pos.x > newState.field.width - p.radius) { p.pos.x = newState.field.width - p.radius; p.vel.x = 0; }
      if (p.pos.y < p.radius) { p.pos.y = p.radius; p.vel.y = 0; }
      if (p.pos.y > newState.field.height - p.radius) { p.pos.y = newState.field.height - p.radius; p.vel.y = 0; }
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
    // --- 2a. Goal Post Collisions (Circle-Circle) ---
    newState.field.goalPosts.forEach(post => {
        const dx = b.pos.x - post.pos.x;
        const dy = b.pos.y - post.pos.y;
        const distSq = dx*dx + dy*dy;
        const minDist = b.radius + post.radius;
        if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq);
            const nx = dx / (dist || 1);
            const ny = dy / (dist || 1);
            // Resolve Overlap
            const overlap = minDist - dist;
            b.pos.x += nx * overlap;
            b.pos.y += ny * overlap;
            // Bounce
            const vn = b.vel.x * nx + b.vel.y * ny;
            if (vn < 0) {
                const j = -(1 + this.POST_BOUNCE) * vn;
                b.vel.x += j * nx;
                b.vel.y += j * ny;
                events.push({ type: 'wall' });
            }
        }
    });
    // --- 2b. Wall Collisions ---
    // Top/Bottom Walls
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
    // Side Walls (Segments)
    // Only collide if NOT in the goal mouth vertical range
    const goalTopY = (newState.field.height - newState.field.goalHeight) / 2;
    const goalBottomY = (newState.field.height + newState.field.goalHeight) / 2;
    // Left Wall
    if (b.pos.x < b.radius) {
        // If ball is above top post OR below bottom post
        if (b.pos.y < goalTopY || b.pos.y > goalBottomY) {
            b.pos.x = b.radius;
            b.vel.x *= -this.WALL_BOUNCE;
            events.push({ type: 'wall' });
        }
    }
    // Right Wall
    if (b.pos.x > newState.field.width - b.radius) {
        // If ball is above top post OR below bottom post
        if (b.pos.y < goalTopY || b.pos.y > goalBottomY) {
            b.pos.x = newState.field.width - b.radius;
            b.vel.x *= -this.WALL_BOUNCE;
            events.push({ type: 'wall' });
        }
    }
    // --- 2c. Goal Detection (Strict) ---
    const checkGoal = (isLeft: boolean) => {
        // Ball must be fully across the line
        // Left Goal: x < -radius
        // Right Goal: x > width + radius
        // And within Y bounds (handled by wall collision logic preventing exit elsewhere)
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
                scorerId = b.lastTouch.id;
            }
        }
        events.push({ type: 'goal', team: scoringTeam, scorerId, assisterId });
        // GOLDEN GOAL LOGIC
        if (newState.isOvertime) {
            newState.status = 'ended';
            events.push({ type: 'whistle' });
        } else {
            // Regular Goal - Pause for celebration
            newState.status = 'goal';
            newState.goalTimer = 3.0; // 3 seconds celebration
        }
        return true;
    };
    // Check Left Goal
    if (b.pos.x < -b.radius) {
        if (checkGoal(true)) return { state: newState, events };
    }
    // Check Right Goal
    if (b.pos.x > newState.field.width + b.radius) {
        if (checkGoal(false)) return { state: newState, events };
    }
    // --- 3. Player-Ball Interaction (Kick & Collision) ---
    newState.players.forEach(p => {
      const dx = b.pos.x - p.pos.x;
      const dy = b.pos.y - p.pos.y;
      const distSq = dx*dx + dy*dy;
      const dist = Math.sqrt(distSq);
      // A. Kick Mechanic (Check tolerance zone)
      const kickRange = p.radius + b.radius + this.KICK_TOLERANCE;
      if (p.isKicking && dist <= kickRange) {
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);
        // Apply Kick Impulse
        b.vel.x += nx * this.KICK_STRENGTH;
        b.vel.y += ny * this.KICK_STRENGTH;
        // Update touch info for kick
        if (b.lastTouch?.id !== p.id) {
            b.previousTouch = b.lastTouch;
        }
        b.lastTouch = {
            id: p.id,
            team: p.team,
            time: newState.timeRemaining
        };
        events.push({ type: 'kick' });
      }
      // B. Collision Resolution (Standard Dribble)
      const minDist = p.radius + b.radius;
      if (dist < minDist) {
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
        if (velAlongNormal < 0) {
            const j = -(1 + this.PLAYER_BOUNCE) * velAlongNormal;
            b.vel.x += j * nx;
            b.vel.y += j * ny;
            // Add some of player's velocity directly for "grip" feel
            b.vel.x += p.vel.x * 0.2;
            b.vel.y += p.vel.y * 0.2;
            if (b.lastTouch?.id !== p.id) {
                b.previousTouch = b.lastTouch;
            }
            b.lastTouch = {
                id: p.id,
                team: p.team,
                time: newState.timeRemaining
            };
            events.push({ type: 'player' });
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
        const baseX = isRed ? 150 : state.field.width - 150;
        players.forEach((p, index) => {
            p.vel = { x: 0, y: 0 };
            p.input = { move: { x: 0, y: 0 }, kick: false };
            if (count === 1) {
                p.pos = { x: baseX, y: state.field.height / 2 };
            } else {
                const segment = state.field.height / (count + 1);
                p.pos = { x: baseX, y: segment * (index + 1) };
            }
        });
    };
    setFormation(redPlayers, true);
    setFormation(bluePlayers, false);
    state.status = 'playing';
    state.goalTimer = 0;
  }
}