import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PhysicsEngine, GameState } from '@shared/physics';
import { PlayerMatchStats, GameMode, WSMessage } from '@shared/types';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw } from 'lucide-react';
import { TouchControls } from './TouchControls';
import { SoundEngine } from '@/lib/audio';
import { useSettingsStore } from '@/store/useSettingsStore';
import { PostMatchSummary } from './PostMatchSummary';
import { GameSocket } from '@/lib/game-socket';
import {
    drawField,
    drawLines,
    drawGoalNet,
    drawGoalPosts,
    drawPlayers,
    drawBall,
    drawOverlays,
    ActiveEmote
} from '@/lib/canvas-utils';
interface GameCanvasProps {
  onGameEnd?: (winner: 'red' | 'blue', score: { red: number; blue: number }) => void;
  winningScore?: number;
  externalState?: GameState | null;
  externalWinner?: 'red' | 'blue' | null;
  onInput?: (input: { move: { x: number; y: number }; kick: boolean }) => void;
  botDifficulty?: 'easy' | 'medium' | 'hard';
  playerNames?: { red: string; blue: string };
  currentUserId?: string;
  finalStats?: Record<string, PlayerMatchStats>;
  onLeave?: () => void;
  onPlayAgain?: () => void;
  mode?: GameMode;
  emoteEvent?: { userId: string; emoji: string; id: string } | null;
  socket?: GameSocket;
}
export function GameCanvas({
  onGameEnd,
  winningScore = 3,
  externalState,
  externalWinner,
  onInput,
  botDifficulty = 'medium',
  playerNames,
  currentUserId,
  finalStats,
  onLeave,
  onPlayAgain,
  mode = '1v1',
  emoteEvent,
  socket
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  // Determine Field Size based on Mode
  const fieldSize = mode === '4v4' ? 'large' : 'medium';
  // Initialize with correct mode and field size
  const gameStateRef = useRef<GameState>(PhysicsEngine.createInitialState(180, fieldSize, mode));
  const displayStateRef = useRef<GameState>(PhysicsEngine.createInitialState(180, fieldSize, mode));
  const keysRef = useRef<Record<string, boolean>>({});
  const touchInputRef = useRef<{ move: { x: number; y: number }; kick: boolean }>({
    move: { x: 0, y: 0 },
    kick: false
  });
  const lastTimeRef = useRef<number>(0);
  const latestExternalStateRef = useRef<GameState | null>(null);
  // Local Stats Tracking
  const localStatsRef = useRef<Record<string, PlayerMatchStats>>({});
  const [score, setScore] = useState({ red: 0, blue: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState<'red' | 'blue' | null>(null);
  const [isOvertime, setIsOvertime] = useState(false);
  // Emotes
  const activeEmotesRef = useRef<ActiveEmote[]>([]);
  // STRICT ZUSTAND RULE: Select primitives individually
  const showNames = useSettingsStore(s => s.showNames);
  const particles = useSettingsStore(s => s.particles);
  // Initialize Audio on Mount
  useEffect(() => {
    const initAudio = () => SoundEngine.init();
    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });
    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
  }, []);
  // Sync external state ref (Socket or Prop)
  useEffect(() => {
    if (socket) {
        const onGameState = (msg: WSMessage) => {
            if (msg.type === 'game_state') {
                latestExternalStateRef.current = msg.state;
            }
        };
        socket.on('game_state', onGameState);
        return () => {
            socket.off('game_state', onGameState);
        };
    } else {
        latestExternalStateRef.current = externalState || null;
    }
  }, [socket, externalState]);
  // Handle Emote Events
  useEffect(() => {
      if (emoteEvent) {
          activeEmotesRef.current.push({
              ...emoteEvent,
              startTime: Date.now()
          });
      }
  }, [emoteEvent]);
  // Initialize Local Stats
  useEffect(() => {
    if (!socket && !externalState) {
        // Initialize stats for all local players
        const players = gameStateRef.current.players;
        players.forEach(p => {
            localStatsRef.current[p.id] = {
                goals: 0,
                assists: 0,
                ownGoals: 0,
                isMvp: false,
                cleanSheet: false
            };
        });
    }
  }, [socket, externalState, mode]);
  // Handle Game Over Logic
  const handleGameOver = useCallback((winner: 'red' | 'blue') => {
    setGameOver(winner);
    SoundEngine.playWhistle();
    if (particles) {
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 },
        colors: winner === 'red' ? ['#e56e56'] : ['#5689e5']
      });
    }
    // Calculate MVP for local game
    if (!socket && !externalState) {
        let maxScore = -1;
        let mvpId = '';
        Object.entries(localStatsRef.current).forEach(([id, stats]) => {
            const score = (stats.goals * 10) + (stats.assists * 5) - (stats.ownGoals * 5);
            if (score > maxScore) {
                maxScore = score;
                mvpId = id;
            }
            // Clean Sheet logic (simplified for local)
            const player = gameStateRef.current.players.find(p => p.id === id);
            if (player) {
                const opponentScore = player.team === 'red' ? gameStateRef.current.score.blue : gameStateRef.current.score.red;
                if (opponentScore === 0) stats.cleanSheet = true;
            }
        });
        if (mvpId && localStatsRef.current[mvpId]) {
            localStatsRef.current[mvpId].isMvp = true;
        }
    }
    if (onGameEnd) {
        // Pass the authoritative score (local ref or external state if available)
        const finalScore = latestExternalStateRef.current ? latestExternalStateRef.current.score : gameStateRef.current.score;
        onGameEnd(winner, finalScore);
    }
  }, [onGameEnd, particles, socket, externalState]);
  // Watch for external winner (Online/Lobby)
  useEffect(() => {
    if (externalWinner) {
      handleGameOver(externalWinner);
    }
  }, [externalWinner, handleGameOver]);
  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;
      // Prevent scrolling with Space
      if (e.code === 'Space') {
        e.preventDefault();
      }
      keysRef.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameOver]);
  // Update local names if provided (Only updates first players for now)
  useEffect(() => {
    if (!socket && !externalState && playerNames) {
        const state = gameStateRef.current;
        const p1 = state.players.find(p => p.team === 'red');
        const p2 = state.players.find(p => p.team === 'blue');
        if (p1) p1.username = playerNames.red;
        if (p2) p2.username = playerNames.blue;
    }
  }, [playerNames, socket, externalState]);
  // Handle Touch Input Update
  const handleTouchUpdate = useCallback((input: { move: { x: number; y: number }; kick: boolean }) => {
    touchInputRef.current = input;
  }, []);
  // Render Function
  const render = useCallback((ctx: CanvasRenderingContext2D, state: GameState) => {
    const { width, height } = ctx.canvas;
    const scaleX = width / state.field.width;
    const scaleY = height / state.field.height;
    // Clear
    ctx.clearRect(0, 0, width, height);
    // 1. Draw Field
    drawField(ctx, width, height);
    // 2. Draw Lines
    drawLines(ctx, width, height, scaleX);
    // 3. Draw Goals & Nets
    drawGoalNet(ctx, state.field, scaleX, scaleY);
    drawGoalPosts(ctx, state.field, scaleX, scaleY);
    // 4. Draw Players
    const isLocalGame = !latestExternalStateRef.current;
    drawPlayers(ctx, state.players, currentUserId, showNames, scaleX, scaleY, isLocalGame);
    // 5. Draw Ball
    drawBall(ctx, state.ball, scaleX, scaleY);
    // 6-9. Draw Overlays (Overtime, Goal, Spectator, Emotes)
    // Filter expired emotes first
    const now = Date.now();
    activeEmotesRef.current = activeEmotesRef.current.filter(e => now - e.startTime < 2000);
    drawOverlays(
        ctx,
        state,
        width,
        height,
        scaleX,
        scaleY,
        activeEmotesRef.current,
        currentUserId,
        !!latestExternalStateRef.current
    );
  }, [currentUserId, showNames]);
  // Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // Initialize time
    lastTimeRef.current = performance.now();
    const loop = () => {
      if (isPaused || gameOver) {
        if (!gameOver) {
            lastTimeRef.current = performance.now(); // Reset time to avoid huge dt jump on resume
            requestRef.current = requestAnimationFrame(loop);
        }
        return;
      }
      // Calculate Delta Time
      const now = performance.now();
      let dt = (now - lastTimeRef.current) / 1000; // Seconds
      lastTimeRef.current = now;
      // Cap dt to prevent physics explosions (e.g. tab backgrounded)
      if (dt > 0.1) dt = 0.1;
      // 1. Process Input
      const p1Input = { move: { x: 0, y: 0 }, kick: false };
      // Keyboard Input
      if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) p1Input.move.y -= 1;
      if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) p1Input.move.y += 1;
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) p1Input.move.x -= 1;
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) p1Input.move.x += 1;
      if (keysRef.current['Space'] || keysRef.current['KeyX']) p1Input.kick = true;
      // Touch Input (Merge/Override)
      if (Math.abs(touchInputRef.current.move.x) > 0 || Math.abs(touchInputRef.current.move.y) > 0) {
        p1Input.move = touchInputRef.current.move;
      }
      if (touchInputRef.current.kick) {
        p1Input.kick = true;
      }
      const targetState = latestExternalStateRef.current;
      if (onInput) {
        // Online Mode: Send input to server
        onInput(p1Input);
      } else if (!targetState) { // FIX: Only run local/bot logic if NOT online (targetState is null)
        // Local Mode: Update local ref
        // Player 0 is always the human in local mode
        gameStateRef.current.players[0].input = p1Input;
        // --- Bot Logic (Predictive AI) ---
        // Iterate through all other players (Bots)
        const ball = gameStateRef.current.ball;
        for (let i = 1; i < gameStateRef.current.players.length; i++) {
            const bot = gameStateRef.current.players[i];
            // Difficulty Settings
            let predictionFactor = 0.0; // Seconds ahead
            let kickChance = 0.05;
            let reactionDist = 400;
            if (botDifficulty === 'easy') {
                predictionFactor = 0.1;
                kickChance = 0.02;
                reactionDist = 300;
            } else if (botDifficulty === 'medium') {
                 predictionFactor = 0.3;
                 kickChance = 0.05;
                 reactionDist = 600;
            } else if (botDifficulty === 'hard') {
                predictionFactor = 0.5;
                kickChance = 0.15;
                reactionDist = 2000; // Infinite
            }
            // Calculate predicted ball position
            let targetX = ball.pos.x + ball.vel.x * predictionFactor;
            let targetY = ball.pos.y + ball.vel.y * predictionFactor;
            // Simple clamp to field
            targetX = Math.max(0, Math.min(1200, targetX));
            targetY = Math.max(0, Math.min(600, targetY));
            const dx = targetX - bot.pos.x;
            const dy = targetY - bot.pos.y;
            const distToTarget = Math.sqrt(dx*dx + dy*dy);
            const distToBall = Math.sqrt((ball.pos.x - bot.pos.x)**2 + (ball.pos.y - bot.pos.y)**2);
            const botMove = { x: 0, y: 0 };
            // Only move if ball is within reaction distance
            if (distToBall < reactionDist) {
                 // Normalize movement
                 if (distToTarget > 10) {
                     botMove.x = dx / distToTarget;
                     botMove.y = dy / distToTarget;
                 }
            }
            // Kick logic: Close to ball AND aligned with goal
            // If Bot is Blue, attacks Left (x=0). Ball should be to the left of bot.
            // If Bot is Red, attacks Right (x=1200). Ball should be to the right of bot.
            const isClose = distToBall < (bot.radius + ball.radius + 15);
            let aligned = false;
            if (bot.team === 'blue') {
                aligned = ball.pos.x < bot.pos.x;
            } else {
                aligned = ball.pos.x > bot.pos.x;
            }
            const botKick = isClose && aligned && Math.random() < kickChance;
            bot.input = { move: botMove, kick: botKick };
        }
      }
      // 2. State Update & Interpolation
      if (targetState) {
        // Online Mode: Lerp displayState towards targetState
        const factor = 0.2; // Smoothing factor
        const current = displayStateRef.current;
        // Lerp Ball
        current.ball.pos.x += (targetState.ball.pos.x - current.ball.pos.x) * factor;
        current.ball.pos.y += (targetState.ball.pos.y - current.ball.pos.y) * factor;
        // Sync other ball props
        current.ball.radius = targetState.ball.radius;
        // Lerp Players
        const newPlayers = targetState.players.map(tp => {
            const cp = current.players.find(p => p.id === tp.id);
            if (cp) {
                // Lerp existing
                const lx = cp.pos.x + (tp.pos.x - cp.pos.x) * factor;
                const ly = cp.pos.y + (tp.pos.y - cp.pos.y) * factor;
                // Snap if too far (teleport)
                const distSq = (tp.pos.x - cp.pos.x)**2 + (tp.pos.y - cp.pos.y)**2;
                if (distSq > 10000) { // > 100px diff
                    return JSON.parse(JSON.stringify(tp));
                }
                return { ...tp, pos: { x: lx, y: ly } };
            } else {
                // New player
                return JSON.parse(JSON.stringify(tp));
            }
        });
        current.players = newPlayers;
        current.score = targetState.score;
        current.timeRemaining = targetState.timeRemaining;
        current.field = targetState.field;
        current.status = targetState.status;
        current.isOvertime = targetState.isOvertime;
        // Detect events from state changes for effects (simplified)
        // In a real implementation, we'd receive events from the server
        if (targetState.status === 'goal' && displayStateRef.current.status !== 'goal') {
             SoundEngine.playCrowdCheer();
        }
      } else {
        // Local Mode: Run physics
        const { state: newState, events } = PhysicsEngine.update(gameStateRef.current, dt);
        gameStateRef.current = newState;
        displayStateRef.current = newState;
        // Play Local Sounds & Track Stats
        events.forEach(event => {
            switch (event.type) {
                case 'kick':
                    SoundEngine.playKick();
                    break;
                case 'wall':
                    SoundEngine.playWall();
                    SoundEngine.playHeavyImpact();
                    break;
                case 'player':
                    SoundEngine.playPlayer();
                    break;
                case 'goal': {
                    SoundEngine.playGoal();
                    SoundEngine.playCrowdCheer();
                    // Track Stats
                    if (event.team && event.scorerId) {
                        const scorer = newState.players.find(p => p.id === event.scorerId);
                        const stats = localStatsRef.current[event.scorerId];
                        if (scorer && stats) {
                            if (scorer.team === event.team) {
                                stats.goals++;
                            } else {
                                stats.ownGoals++;
                            }
                        }
                    }
                    if (event.assisterId) {
                        const stats = localStatsRef.current[event.assisterId];
                        if (stats) stats.assists++;
                    }
                    break;
                }
                case 'whistle': SoundEngine.playWhistle(); break;
            }
        });
      }
      const currentState = displayStateRef.current;
      // Update Overtime State for UI
      setIsOvertime(currentState.isOvertime);
      // Check for score change (Visual only for online, authoritative for local)
      if (currentState.score.red !== score.red || currentState.score.blue !== score.blue) {
        setScore(currentState.score);
        // Only trigger local win condition if not online (server sends game_over)
        if (!targetState) {
            if (currentState.status === 'ended') {
                // Golden Goal or Time Limit reached with winner
                if (currentState.score.red > currentState.score.blue) {
                    handleGameOver('red');
                } else if (currentState.score.blue > currentState.score.red) {
                    handleGameOver('blue');
                }
            } else if (winningScore > 0 && currentState.score.red >= winningScore && !currentState.isOvertime) {
                handleGameOver('red');
            } else if (winningScore > 0 && currentState.score.blue >= winningScore && !currentState.isOvertime) {
                handleGameOver('blue');
            } else {
                if (particles) {
                    confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: currentState.score.red > score.red ? ['#e56e56'] : ['#5689e5']
                    });
                }
            }
        }
      }
      // Check for Time Limit (Local Mode)
      if (!targetState && currentState.status === 'ended' && !gameOver) {
          if (currentState.score.red > currentState.score.blue) {
              handleGameOver('red');
          } else if (currentState.score.blue > currentState.score.red) {
              handleGameOver('blue');
          } else {
              // Should not happen with Golden Goal logic, but fallback
              handleGameOver('red');
          }
      }
      // 3. Render
      render(ctx, currentState);
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [score, isPaused, gameOver, winningScore, onInput, handleGameOver, botDifficulty, render, particles]);
  const handleReset = () => {
    // Use the derived fieldSize here
    gameStateRef.current = PhysicsEngine.createInitialState(180, fieldSize, mode);
    displayStateRef.current = PhysicsEngine.createInitialState(180, fieldSize, mode);
    // Reset Stats
    const players = gameStateRef.current.players;
    players.forEach(p => {
        localStatsRef.current[p.id] = {
            goals: 0,
            assists: 0,
            ownGoals: 0,
            isMvp: false,
            cleanSheet: false
        };
    });
    setScore({ red: 0, blue: 0 });
    setGameOver(null);
    setIsPaused(false);
    setIsOvertime(false);
    lastTimeRef.current = performance.now();
  };
  // Format time remaining
  const timeRemaining = latestExternalStateRef.current
    ? latestExternalStateRef.current.timeRemaining
    : gameStateRef.current.timeRemaining;
  const minutes = Math.floor(Math.max(0, timeRemaining) / 60);
  const seconds = Math.floor(Math.max(0, timeRemaining) % 60);
  // Prepare data for summary
  const summaryStats = finalStats || localStatsRef.current;
  const summaryPlayers = latestExternalStateRef.current
    ? latestExternalStateRef.current.players.map(p => ({ id: p.id, username: p.username, team: p.team }))
    : gameStateRef.current.players.map(p => ({ id: p.id, username: p.username, team: p.team }));
  // Determine user team for victory/defeat message
  const userTeam = latestExternalStateRef.current
    ? summaryPlayers.find(p => p.id === currentUserId)?.team
    : 'red';
  // Determine final score to display in summary (use external if available, else local state)
  const finalScore = latestExternalStateRef.current ? latestExternalStateRef.current.score : score;
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-4xl mx-auto">
      {/* Scoreboard - Clean Style */}
      <div className="flex items-center justify-between w-full px-8 py-3 bg-slate-900 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-6 h-6 rounded-full bg-haxball-red border-2 border-black" />
          <span className="text-4xl font-display font-bold text-white">{score.red}</span>
        </div>
        <div className="flex flex-col items-center">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                {gameOver ? 'MATCH ENDED' : isOvertime ? 'SUDDEN DEATH' : winningScore > 0 ? `First to ${winningScore}` : 'Unlimited Score'}
            </div>
            <div className={`px-3 py-1 rounded text-white font-mono text-sm border ${isOvertime ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400 animate-pulse' : 'bg-slate-800 border-slate-700'}`}>
                {isOvertime ? 'OVERTIME' : `${minutes}:${seconds.toString().padStart(2, '0')}`}
            </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-4xl font-display font-bold text-white">{score.blue}</span>
          <div className="w-6 h-6 rounded-full bg-haxball-blue border-2 border-black" />
        </div>
      </div>
      {/* Game Area */}
      <div ref={containerRef} className="game-container group relative touch-none">
        <canvas
          ref={canvasRef}
          width={1200}
          height={600}
          className="w-full h-full object-contain"
        />
        {/* Touch Controls Overlay */}
        <TouchControls onUpdate={handleTouchUpdate} />
        {/* Post Match Summary Overlay */}
        {gameOver && (
            <PostMatchSummary
                winner={gameOver}
                userTeam={userTeam}
                score={finalScore}
                stats={summaryStats}
                players={summaryPlayers}
                onPlayAgain={onPlayAgain || (!socket && !externalState ? handleReset : undefined)}
                onLeave={onLeave || (() => {})}
                isLocal={!socket && !externalState}
            />
        )}
        {/* Controls Overlay (Visible on Hover/Pause) */}
        {!gameOver && !socket && !externalState && (
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
            <Button size="icon" variant="secondary" onClick={handleReset} className="bg-slate-800 text-white hover:bg-slate-700 border border-slate-700">
                <RotateCcw className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="secondary" onClick={() => setIsPaused(!isPaused)} className="bg-slate-800 text-white hover:bg-slate-700 border border-slate-700">
                <Play className="w-4 h-4" />
            </Button>
            </div>
        )}
      </div>
      {/* Controls Overlay (Desktop) */}
      <div className="hidden md:flex items-center gap-6 bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-full border border-slate-800 shadow-xl mt-4">
        {/* Movement Group */}
        <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 bg-slate-800 border-b-4 border-slate-950 rounded flex items-center justify-center font-bold text-slate-200 text-xs shadow-lg">W</div>
                <div className="flex gap-1">
                    <div className="w-8 h-8 bg-slate-800 border-b-4 border-slate-950 rounded flex items-center justify-center font-bold text-slate-200 text-xs shadow-lg">A</div>
                    <div className="w-8 h-8 bg-slate-800 border-b-4 border-slate-950 rounded flex items-center justify-center font-bold text-slate-200 text-xs shadow-lg">S</div>
                    <div className="w-8 h-8 bg-slate-800 border-b-4 border-slate-950 rounded flex items-center justify-center font-bold text-slate-200 text-xs shadow-lg">D</div>
                </div>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Move</span>
        </div>
        <div className="w-px h-8 bg-slate-700" />
        {/* Action Group */}
        <div className="flex items-center gap-3">
            <div className="h-8 px-4 bg-slate-800 border-b-4 border-slate-950 rounded flex items-center justify-center font-bold text-slate-200 text-xs shadow-lg">
                SPACE
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kick</span>
        </div>
      </div>
    </div>
  );
}