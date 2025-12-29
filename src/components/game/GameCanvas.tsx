import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PhysicsEngine, GameState } from '@shared/physics';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw, Trophy } from 'lucide-react';
interface GameCanvasProps {
  onGameEnd?: (winner: 'red' | 'blue') => void;
  winningScore?: number;
  externalState?: GameState | null;
  onInput?: (input: { move: { x: number; y: number }; kick: boolean }) => void;
  botDifficulty?: 'easy' | 'medium' | 'hard';
  playerNames?: { red: string; blue: string };
}
export function GameCanvas({
  onGameEnd,
  winningScore = 3,
  externalState,
  onInput,
  botDifficulty = 'medium',
  playerNames
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const gameStateRef = useRef<GameState>(PhysicsEngine.createInitialState());
  const keysRef = useRef<Record<string, boolean>>({});
  const [score, setScore] = useState({ red: 0, blue: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState<'red' | 'blue' | null>(null);
  // Handle Game Over Logic
  const handleGameOver = useCallback((winner: 'red' | 'blue') => {
    setGameOver(winner);
    confetti({
      particleCount: 200,
      spread: 100,
      origin: { y: 0.6 },
      colors: winner === 'red' ? ['#e56e56'] : ['#5689e5']
    });
    if (onGameEnd) onGameEnd(winner);
  }, [onGameEnd]);
  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;
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
  // Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const loop = () => {
      if (isPaused || gameOver) {
        if (!gameOver) requestRef.current = requestAnimationFrame(loop);
        return;
      }
      // 1. Process Input
      const p1Input = { move: { x: 0, y: 0 }, kick: false };
      if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) p1Input.move.y -= 1;
      if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) p1Input.move.y += 1;
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) p1Input.move.x -= 1;
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) p1Input.move.x += 1;
      if (keysRef.current['Space'] || keysRef.current['KeyX']) p1Input.kick = true;
      if (onInput) {
        // Online Mode: Send input to server
        onInput(p1Input);
      } else {
        // Local Mode: Update local ref
        gameStateRef.current.players[0].input = p1Input;
        // Bot Logic for P2 (Local only)
        const ball = gameStateRef.current.ball;
        const p2 = gameStateRef.current.players[1];
        const dx = ball.pos.x - p2.pos.x;
        const dy = ball.pos.y - p2.pos.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        // Difficulty Settings
        let reactionDist = 400;
        let kickChance = 0.05;
        if (botDifficulty === 'easy') {
            reactionDist = 200;
            kickChance = 0.02;
        } else if (botDifficulty === 'hard') {
            reactionDist = 1000; // Always tracks
            kickChance = 0.15;
        }
        const botMove = { x: 0, y: 0 };
        // Only move if ball is within reaction distance
        if (dist < reactionDist) {
            if (Math.abs(dx) > 10) botMove.x = Math.sign(dx);
            if (Math.abs(dy) > 10) botMove.y = Math.sign(dy);
        }
        const botKick = dist < 30 && Math.random() < kickChance;
        gameStateRef.current.players[1].input = { move: botMove, kick: botKick };
      }
      // 2. State Update
      let currentState: GameState;
      if (externalState) {
        // Online Mode: Use server state
        currentState = externalState;
      } else {
        // Local Mode: Run physics
        const newState = PhysicsEngine.update(gameStateRef.current);
        gameStateRef.current = newState;
        currentState = newState;
      }
      // Check for score change (Visual only for online, authoritative for local)
      if (currentState.score.red !== score.red || currentState.score.blue !== score.blue) {
        setScore(currentState.score);
        // Only trigger local win condition if not online (server sends game_over)
        if (!externalState) {
            if (currentState.score.red >= winningScore) {
                handleGameOver('red');
            } else if (currentState.score.blue >= winningScore) {
                handleGameOver('blue');
            } else {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: currentState.score.red > score.red ? ['#e56e56'] : ['#5689e5']
                });
            }
        }
      }
      // 3. Render
      render(ctx, currentState);
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [score, isPaused, gameOver, winningScore, externalState, onInput, handleGameOver, botDifficulty]);
  const render = (ctx: CanvasRenderingContext2D, state: GameState) => {
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
      // Kick Indicator (White Ring)
      if (p.isKicking) {
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
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
      // Username
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(p.username, x, y - r - 10);
      ctx.shadowBlur = 0; // Reset shadow
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
  };
  const handleReset = () => {
    gameStateRef.current = PhysicsEngine.createInitialState();
    setScore({ red: 0, blue: 0 });
    setGameOver(null);
    setIsPaused(false);
  };
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-4xl mx-auto">
      {/* Scoreboard - Classic Style */}
      <div className="flex items-center justify-between w-full px-8 py-3 bg-slate-800 rounded-lg shadow-md border border-slate-700">
        <div className="flex items-center gap-4">
          <div className="w-6 h-6 rounded-full bg-haxball-red border-2 border-black" />
          <span className="text-4xl font-display font-bold text-white">{score.red}</span>
        </div>
        <div className="flex flex-col items-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                {gameOver ? 'MATCH ENDED' : `First to ${winningScore}`}
            </div>
            <div className="px-3 py-1 bg-slate-900 rounded text-white font-mono text-sm">
                {Math.floor(gameStateRef.current.timeRemaining / 60)}:{(gameStateRef.current.timeRemaining % 60).toString().padStart(2, '0')}
            </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-4xl font-display font-bold text-white">{score.blue}</span>
          <div className="w-6 h-6 rounded-full bg-haxball-blue border-2 border-black" />
        </div>
      </div>
      {/* Game Area */}
      <div ref={containerRef} className="game-container group">
        <canvas
          ref={canvasRef}
          width={1200}
          height={600}
          className="w-full h-full object-contain"
        />
        {/* Game Over Overlay */}
        {gameOver && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center animate-fade-in z-10">
                <Trophy className={`w-16 h-16 mb-4 ${gameOver === 'red' ? 'text-haxball-red' : 'text-haxball-blue'}`} />
                <h2 className="text-4xl font-display font-bold text-white mb-2 tracking-wider drop-shadow-md">
                    {gameOver === 'red' ? 'RED VICTORY' : 'BLUE VICTORY'}
                </h2>
                <p className="text-slate-200 mb-6 font-medium">Match results are being processed...</p>
                <Button onClick={handleReset} variant="secondary" className="btn-kid-secondary border-none shadow-lg">
                    Play Again
                </Button>
            </div>
        )}
        {/* Controls Overlay (Visible on Hover/Pause) */}
        {!gameOver && !externalState && (
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="secondary" onClick={handleReset} className="bg-white text-slate-800 hover:bg-slate-100 border border-slate-300 shadow-sm">
                <RotateCcw className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="secondary" onClick={() => setIsPaused(!isPaused)} className="bg-white text-slate-800 hover:bg-slate-100 border border-slate-300 shadow-sm">
                <Play className="w-4 h-4" />
            </Button>
            </div>
        )}
      </div>
      <div className="text-sm text-slate-500 font-medium font-mono bg-slate-100 px-4 py-2 rounded-full border border-slate-200">
        Controls: WASD to Move • SPACE to Kick
      </div>
    </div>
  );
}