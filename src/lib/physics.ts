/**
 * KickStar League Physics Engine
 * Pure TypeScript implementation of 2D circle physics
 */
export type Vector = { x: number; y: number };
export interface Entity {
  id: string;
  pos: Vector;
  vel: Vector;
  radius: number;
  mass: number;
  damping: number;
  restitution: number; // Bounciness (0-1)
}
export interface Player extends Entity {
  type: 'player';
  team: 'red' | 'blue';
  input: {
    move: Vector;
    kick: boolean;
  };
  isKicking: boolean;
  kickCooldown: number;
}
export interface Ball extends Entity {
  type: 'ball';
}
export interface GameState {
  players: Player[];
  ball: Ball;
  field: {
    width: number;
    height: number;
    goalHeight: number;
  };
  score: {
    red: number;
    blue: number;
  };
  isPlaying: boolean;
  lastGoalTime: number;
}
// Constants
export const PHYSICS_CONFIG = {
  PLAYER_RADIUS: 15,
  BALL_RADIUS: 10,
  PLAYER_MASS: 2,
  BALL_MASS: 1,
  PLAYER_DAMPING: 0.90, // Friction
  BALL_DAMPING: 0.98,
  PLAYER_ACCEL: 0.8,
  KICK_FORCE: 8,
  KICK_RADIUS: 22, // Distance to ball to kick
  WALL_RESTITUTION: 0.7,
  GOAL_WIDTH: 5, // Visual depth of goal
};
// Vector Math Helpers
export const Vec2 = {
  add: (v1: Vector, v2: Vector): Vector => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
  sub: (v1: Vector, v2: Vector): Vector => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
  mul: (v: Vector, s: number): Vector => ({ x: v.x * s, y: v.y * s }),
  mag: (v: Vector): number => Math.sqrt(v.x * v.x + v.y * v.y),
  norm: (v: Vector): Vector => {
    const m = Vec2.mag(v);
    return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
  },
  dist: (v1: Vector, v2: Vector): number => Vec2.mag(Vec2.sub(v1, v2)),
  dot: (v1: Vector, v2: Vector): number => v1.x * v2.x + v1.y * v2.y,
};
export class PhysicsEngine {
  static createInitialState(width = 800, height = 400): GameState {
    return {
      players: [
        {
          id: 'p1',
          type: 'player',
          team: 'red',
          pos: { x: width * 0.25, y: height * 0.5 },
          vel: { x: 0, y: 0 },
          radius: PHYSICS_CONFIG.PLAYER_RADIUS,
          mass: PHYSICS_CONFIG.PLAYER_MASS,
          damping: PHYSICS_CONFIG.PLAYER_DAMPING,
          restitution: 0.5,
          input: { move: { x: 0, y: 0 }, kick: false },
          isKicking: false,
          kickCooldown: 0,
        },
        // Bot / Player 2
        {
          id: 'p2',
          type: 'player',
          team: 'blue',
          pos: { x: width * 0.75, y: height * 0.5 },
          vel: { x: 0, y: 0 },
          radius: PHYSICS_CONFIG.PLAYER_RADIUS,
          mass: PHYSICS_CONFIG.PLAYER_MASS,
          damping: PHYSICS_CONFIG.PLAYER_DAMPING,
          restitution: 0.5,
          input: { move: { x: 0, y: 0 }, kick: false },
          isKicking: false,
          kickCooldown: 0,
        }
      ],
      ball: {
        id: 'ball',
        type: 'ball',
        pos: { x: width * 0.5, y: height * 0.5 },
        vel: { x: 0, y: 0 },
        radius: PHYSICS_CONFIG.BALL_RADIUS,
        mass: PHYSICS_CONFIG.BALL_MASS,
        damping: PHYSICS_CONFIG.BALL_DAMPING,
        restitution: 0.7,
      },
      field: {
        width,
        height,
        goalHeight: 120,
      },
      score: { red: 0, blue: 0 },
      isPlaying: true,
      lastGoalTime: 0,
    };
  }
  static update(state: GameState): GameState {
    if (!state.isPlaying) return state;
    const { width, height, goalHeight } = state.field;
    const goalTop = (height - goalHeight) / 2;
    const goalBottom = (height + goalHeight) / 2;
    // 1. Update Players
    const updatedPlayers = state.players.map(p => {
      // Apply Input Acceleration
      if (p.input.move.x !== 0 || p.input.move.y !== 0) {
        const accel = Vec2.mul(Vec2.norm(p.input.move), PHYSICS_CONFIG.PLAYER_ACCEL);
        p.vel = Vec2.add(p.vel, accel);
      }
      // Apply Physics
      p.pos = Vec2.add(p.pos, p.vel);
      p.vel = Vec2.mul(p.vel, p.damping);
      // Cooldowns
      if (p.kickCooldown > 0) p.kickCooldown--;
      // Handle Kick Input
      if (p.input.kick && p.kickCooldown === 0) {
        p.isKicking = true;
        p.kickCooldown = 10; // Frames
      } else {
        p.isKicking = false;
      }
      // Wall Collisions (Players can't enter goals)
      if (p.pos.x < p.radius) { p.pos.x = p.radius; p.vel.x *= -0.5; }
      if (p.pos.x > width - p.radius) { p.pos.x = width - p.radius; p.vel.x *= -0.5; }
      if (p.pos.y < p.radius) { p.pos.y = p.radius; p.vel.y *= -0.5; }
      if (p.pos.y > height - p.radius) { p.pos.y = height - p.radius; p.vel.y *= -0.5; }
      return p;
    });
    // 2. Update Ball
    let ball = { ...state.ball };
    ball.pos = Vec2.add(ball.pos, ball.vel);
    ball.vel = Vec2.mul(ball.vel, ball.damping);
    // 3. Ball-Wall Collisions
    // Check Goals
    let goalScored = false;
    let scoringTeam: 'red' | 'blue' | null = null;
    // Left Goal (Blue Scores)
    if (ball.pos.x < 0 && ball.pos.y > goalTop && ball.pos.y < goalBottom) {
      if (ball.pos.x < -20) { // Fully in
        goalScored = true;
        scoringTeam = 'blue';
      }
    } else if (ball.pos.x < ball.radius) {
      ball.pos.x = ball.radius;
      ball.vel.x *= -ball.restitution;
    }
    // Right Goal (Red Scores)
    if (ball.pos.x > width && ball.pos.y > goalTop && ball.pos.y < goalBottom) {
      if (ball.pos.x > width + 20) {
        goalScored = true;
        scoringTeam = 'red';
      }
    } else if (ball.pos.x > width - ball.radius) {
      ball.pos.x = width - ball.radius;
      ball.vel.x *= -ball.restitution;
    }
    // Top/Bottom Walls
    if (ball.pos.y < ball.radius) {
      ball.pos.y = ball.radius;
      ball.vel.y *= -ball.restitution;
    }
    if (ball.pos.y > height - ball.radius) {
      ball.pos.y = height - ball.radius;
      ball.vel.y *= -ball.restitution;
    }
    // Goal Post Collisions (Corner circles)
    const posts = [
      { x: 0, y: goalTop }, { x: 0, y: goalBottom },
      { x: width, y: goalTop }, { x: width, y: goalBottom }
    ];
    posts.forEach(post => {
      const dist = Vec2.dist(ball.pos, post);
      if (dist < ball.radius) {
        const normal = Vec2.norm(Vec2.sub(ball.pos, post));
        ball.pos = Vec2.add(post, Vec2.mul(normal, ball.radius));
        // Reflect velocity
        const dot = Vec2.dot(ball.vel, normal);
        ball.vel = Vec2.sub(ball.vel, Vec2.mul(normal, 2 * dot));
        ball.vel = Vec2.mul(ball.vel, 0.8); // Post damping
      }
    });
    // 4. Player-Ball Collisions & Kicking
    updatedPlayers.forEach(p => {
      const dist = Vec2.dist(p.pos, ball.pos);
      const minDist = p.radius + ball.radius;
      // Kick Logic
      if (p.isKicking && dist < p.radius + ball.radius + 5) {
        const kickDir = Vec2.norm(Vec2.sub(ball.pos, p.pos));
        ball.vel = Vec2.add(ball.vel, Vec2.mul(kickDir, PHYSICS_CONFIG.KICK_FORCE));
      }
      // Collision Logic
      else if (dist < minDist) {
        const normal = Vec2.norm(Vec2.sub(ball.pos, p.pos));
        const overlap = minDist - dist;
        // Separate
        const separation = Vec2.mul(normal, overlap);
        // Move ball mostly (it's lighter)
        ball.pos = Vec2.add(ball.pos, separation);
        // Momentum Transfer
        const relativeVel = Vec2.sub(ball.vel, p.vel);
        const velAlongNormal = Vec2.dot(relativeVel, normal);
        if (velAlongNormal < 0) {
          const j = -(1 + 0.5) * velAlongNormal; // 0.5 restitution
          const impulse = Vec2.mul(normal, j);
          // Apply impulse
          ball.vel = Vec2.add(ball.vel, impulse);
          // Player is heavy, barely affected
        }
      }
    });
    // 5. Handle Scoring Reset
    if (goalScored && scoringTeam) {
      return {
        ...state,
        score: {
          ...state.score,
          [scoringTeam]: state.score[scoringTeam] + 1
        },
        players: state.players.map((p, i) => ({
          ...p,
          pos: i === 0 
            ? { x: width * 0.25, y: height * 0.5 } 
            : { x: width * 0.75, y: height * 0.5 },
          vel: { x: 0, y: 0 }
        })),
        ball: {
          ...state.ball,
          pos: { x: width * 0.5, y: height * 0.5 },
          vel: { x: 0, y: 0 }
        },
        lastGoalTime: Date.now()
      };
    }
    return {
      ...state,
      players: updatedPlayers,
      ball
    };
  }
}