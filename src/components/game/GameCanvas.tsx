import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PhysicsEngine, GameState } from '@shared/physics';
import { PlayerMatchStats } from '@shared/types';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw } from 'lucide-react';
import { TouchControls } from './TouchControls';
import { SoundEngine } from '@/lib/audio';
import { useSettingsStore } from '@/store/useSettingsStore';
import { PostMatchSummary } from './PostMatchSummary';
interface GameCanvasProps {
  onGameEnd?: (winner: 'red' | 'blue') => void;
  winningScore?: number;
  externalState?: GameState | null;
  externalWinner?: 'red' | 'blue' | null; // New prop
  onInput?: (input: { move: { x: number; y: number }; kick: boolean }) => void;
  botDifficulty?: 'easy' | 'medium' | 'hard';
  playerNames?: { red: string; blue: string };
  currentUserId?: string;
  finalStats?: Record<string, PlayerMatchStats>; // Stats from server
  onLeave?: () => void; // Callback for leaving from summary
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
  onLeave
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const gameStateRef = useRef<GameState>(PhysicsEngine.createInitialState());
  const displayStateRef = useRef<GameState>(PhysicsEngine.createInitialState());
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
  // Sync external state ref
  useEffect(() => {
    latestExternalStateRef.current = externalState || null;
  }, [externalState]);
  // Initialize Local Stats
  useEffect(() => {
    if (!externalState) {
        // Initialize stats for p1 and p2
        ['p1', 'p2'].forEach(id => {
            localStatsRef.current[id] = {
                goals: 0,
                assists: 0,
                ownGoals: 0,
                isMvp: false,
                cleanSheet: false
            };
        });
    }
  }, [externalState]);
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
    if (!externalState) {
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
    if (onGameEnd) onGameEnd(winner);
  }, [onGameEnd, particles, externalState]);
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
  // Update local names if provided
  useEffect(() => {
    if (!externalState && playerNames) {
        const state = gameStateRef.current;
        const p1 = state.players.find(p => p.team === 'red');
        const p2 = state.players.find(p => p.team === 'blue');
        if (p1) p1.username = playerNames.red;
        if (p2) p2.username = playerNames.blue;
    }
  }, [playerNames, externalState]);
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
    // --- 1. Draw Field (Striped Turf) ---
    const stripeCount = 7;
    const stripeWidth = width / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#718c5a' : '#6c8655';
        ctx.fillRect(i * stripeWidth, 0, stripeWidth, height);
    }
    // --- 2. Draw Lines (White) ---
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    // Border
    ctx.strokeRect(5, 5, width - 10, height - 10);
    // Center Line
    ctx.beginPath();
    ctx.moveTo(width / 2, 5);
    ctx.lineTo(width / 2, height - 5);
    ctx.stroke();
    // Center Circle
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 70 * scaleX, 0, Math.PI * 2);
    ctx.stroke();
    // --- 3. Draw Goals ---
    const goalH = state.field.goalHeight * scaleY;
    const goalTop = (height - goalH) / 2;
    // Goal Posts (Simple Black Lines)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    // Left Goal
    ctx.beginPath();
    ctx.moveTo(5, goalTop);
    ctx.lineTo(0, goalTop);
    ctx.lineTo(0, goalTop + goalH);
    ctx.lineTo(5, goalTop + goalH);
    ctx.stroke();
    // Right Goal
    ctx.beginPath();
    ctx.moveTo(width - 5, goalTop);
    ctx.lineTo(width, goalTop);
    ctx.lineTo(width, goalTop + goalH);
    ctx.lineTo(width - 5, goalTop + goalH);
    ctx.stroke();
    // --- 4. Draw Players ---
    state.players.forEach(p => {
      const x = p.pos.x * scaleX;
      const y = p.pos.y * scaleY;
      const r = p.radius * scaleX;
      // Classic Haxball Colors
      const color = p.team === 'red' ? '#e56e56' : '#5689e5';
      // Kick Range Ring (New Feature)
      const kickRange = (p.radius + state.ball.radius + PhysicsEngine.KICK_TOLERANCE) * scaleX;
      ctx.beginPath();
      ctx.arc(x, y, kickRange, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash
      // Kick Indicator (White Ring on Player)
      if (p.isKicking) {
        ctx.beginPath();
        ctx.arc(x, y, r + 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      // Body
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      // Stroke (Black Border)
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Username (Conditional)
      if (showNames) {
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(p.username, x, y - r - 10);
        ctx.shadowBlur = 0; // Reset shadow
      }
      // "YOU" Indicator
      if (currentUserId && p.id === currentUserId) {
          ctx.beginPath();
          ctx.moveTo(x, y - r - 30);
          ctx.lineTo(x - 6, y - r - 40);
          ctx.lineTo(x + 6, y - r - 40);
          ctx.closePath();
          ctx.fillStyle = '#fbbf24'; // Amber-400
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          ctx.stroke();
      }
    });
    // --- 5. Draw Ball ---
    const b = state.ball;
    const bx = b.pos.x * scaleX;
    const by = b.pos.y * scaleY;
    const br = b.radius * scaleX;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // --- 6. Overtime Overlay ---
    if (state.isOvertime && state.status !== 'goal') {
        ctx.save();
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;
        // Pulse effect
        const scale = 1 + Math.sin(Date.now() / 200) * 0.05;
        ctx.translate(width / 2, height / 4);
        ctx.scale(scale, scale);
        ctx.fillStyle = '#fbbf24'; // Gold
        ctx.fillText('GOLDEN GOAL', 0, 0);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeText('GOLDEN GOAL', 0, 0);
        ctx.restore();
    }
    // --- 7. Goal Celebration Overlay ---
    if (state.status === 'goal') {
        ctx.save();
        ctx.translate(width / 2, height / 2);
        // Pulse/Scale animation
        const scale = 1 + Math.sin(Date.now() / 150) * 0.1;
        ctx.scale(scale, scale);
        ctx.font = '900 120px sans-serif'; // Heavy font
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Text Stroke
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText('GOAL!', 0, 0);
        // Text Fill (Gold Gradient)
        const gradient = ctx.createLinearGradient(0, -60, 0, 60);
        gradient.addColorStop(0, '#fbbf24'); // Amber 400
        gradient.addColorStop(1, '#d97706'); // Amber 600
        ctx.fillStyle = gradient;
        ctx.fillText('GOAL!', 0, 0);
        ctx.restore();
    }
    // --- 8. Spectator Overlay ---
    // Check if we are in online mode (externalState exists) and user is NOT playing
    const isOnline = !!latestExternalStateRef.current;
    const isSpectating = isOnline && currentUserId && !state.players.some(p => p.id === currentUserId);
    if (isSpectating) {
        ctx.save();
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText('SPECTATING', width / 2, 20);
        ctx.restore();
    }
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
        gameStateRef.current.players[0].input = p1Input;
        // --- Bot Logic (Predictive AI) ---
        const ball = gameStateRef.current.ball;
        const p2 = gameStateRef.current.players[1];
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
        const dx = targetX - p2.pos.x;
        const dy = targetY - p2.pos.y;
        const distToTarget = Math.sqrt(dx*dx + dy*dy);
        const distToBall = Math.sqrt((ball.pos.x - p2.pos.x)**2 + (ball.pos.y - p2.pos.y)**2);
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
        // Blue (P2) attacks Left Goal (x=0). Ball should be to the left of bot.
        const isClose = distToBall < (p2.radius + ball.radius + 15);
        const aligned = (p2.team === 'blue' && ball.pos.x < p2.pos.x) || (p2.team === 'red' && ball.pos.x > p2.pos.x);
        const botKick = isClose && aligned && Math.random() < kickChance;
        gameStateRef.current.players[1].input = { move: botMove, kick: botKick };
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
      } else {
        // Local Mode: Run physics
        const { state: newState, events } = PhysicsEngine.update(gameStateRef.current, dt);
        gameStateRef.current = newState;
        displayStateRef.current = newState;
        // Play Local Sounds & Track Stats
        events.forEach(event => {
            switch (event.type) {
                case 'kick': SoundEngine.playKick(); break;
                case 'wall': SoundEngine.playWall(); break;
                case 'player': SoundEngine.playPlayer(); break;
                case 'goal': {
                    SoundEngine.playGoal();
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
    gameStateRef.current = PhysicsEngine.createInitialState();
    displayStateRef.current = PhysicsEngine.createInitialState();
    // Reset Stats
    ['p1', 'p2'].forEach(id => {
        localStatsRef.current[id] = {
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
  const summaryPlayers = externalState
    ? externalState.players.map(p => ({ id: p.id, username: p.username, team: p.team }))
    : gameStateRef.current.players.map(p => ({ id: p.id, username: p.username, team: p.team }));
  // Determine user team for victory/defeat message
  const userTeam = externalState
    ? summaryPlayers.find(p => p.id === currentUserId)?.team
    : 'red';
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
                score={score}
                stats={summaryStats}
                players={summaryPlayers}
                onPlayAgain={!externalState ? handleReset : undefined}
                onLeave={onLeave || (() => {})}
                isLocal={!externalState}
            />
        )}
        {/* Controls Overlay (Visible on Hover/Pause) */}
        {!gameOver && !externalState && (
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
      <div className="text-sm text-slate-500 font-medium font-mono bg-slate-900 px-4 py-2 rounded-full border border-slate-800 hidden md:block">
        Controls: WASD to Move • SPACE to Kick
      </div>
    </div>
  );
}