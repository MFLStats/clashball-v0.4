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
      colors: winner === 'red' ? ['#ef233c'] : ['#3a86ff']
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
                    colors: currentState.score.red > score.red ? ['#ef233c'] : ['#3a86ff']
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
    // Draw Field (Grass)
    ctx.fillStyle = '#52b788';
    ctx.fillRect(0, 0, width, height);
    // Draw Lines
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(width/2, 0);
    ctx.lineTo(width/2, height);
    ctx.moveTo(width/2 + 50 * scaleX, height/2);
    ctx.arc(width/2, height/2, 50 * scaleX, 0, Math.PI * 2);
    ctx.stroke();
    // Draw Goals
    const goalH = state.field.goalHeight * scaleY;
    const goalTop = (height - goalH) / 2;
    ctx.fillStyle = 'rgba(58, 134, 255, 0.2)';
    ctx.fillRect(0, goalTop, 40 * scaleX, goalH);
    ctx.fillStyle = 'rgba(239, 35, 60, 0.2)';
    ctx.fillRect(width - 40 * scaleX, goalTop, 40 * scaleX, goalH);
    // Draw Players
    state.players.forEach(p => {
      const x = p.pos.x * scaleX;
      const y = p.pos.y * scaleY;
      const r = p.radius * scaleX;
      // Kick Indicator (Visual Pulse)
      if (p.isKicking) {
        ctx.beginPath();
        ctx.arc(x, y, r + 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, r + 12, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // Shadow
      ctx.beginPath();
      ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fill();
      // Body
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.team === 'red' ? '#ef233c' : '#3a86ff';
      ctx.fill();
      // Border
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Draw Username
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(p.username, x + 1, y - r - 8);
      ctx.fillStyle = 'white';
      ctx.fillText(p.username, x, y - r - 9);
    });
    // Draw Ball
    const b = state.ball;
    const bx = b.pos.x * scaleX;
    const by = b.pos.y * scaleY;
    const br = b.radius * scaleX;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
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
      {/* Scoreboard */}
      <div className="flex items-center justify-between w-full px-8 py-4 bg-white rounded-2xl shadow-sm border-2 border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-4 h-4 rounded-full bg-red-500" />
          <span className="text-3xl font-display font-bold text-slate-800">{score.red}</span>
        </div>
        <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            {gameOver ? 'MATCH ENDED' : `First to ${winningScore}`}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-3xl font-display font-bold text-slate-800">{score.blue}</span>
          <div className="w-4 h-4 rounded-full bg-blue-500" />
        </div>
      </div>
      {/* Game Area */}
      <div ref={containerRef} className="game-container relative group">
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="w-full h-full object-contain"
        />
        {/* Game Over Overlay */}
        {gameOver && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm z-10">
                <Trophy className={`w-16 h-16 mb-4 ${gameOver === 'red' ? 'text-red-500' : 'text-blue-500'}`} />
                <h2 className="text-4xl font-display font-bold text-white mb-2">
                    {gameOver === 'red' ? 'VICTORY!' : 'DEFEAT'}
                </h2>
                <p className="text-white/80 mb-6">Match results are being processed...</p>
                <Button onClick={handleReset} variant="secondary" className="btn-kid-secondary">
                    Play Again
                </Button>
            </div>
        )}
        {/* Controls Overlay (Visible on Hover/Pause) */}
        {!gameOver && !externalState && (
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="secondary" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="secondary" onClick={() => setIsPaused(!isPaused)}>
                <Play className="w-4 h-4" />
            </Button>
            </div>
        )}
      </div>
      <div className="text-sm text-slate-500 font-medium">
        Controls: WASD to Move • SPACE to Kick
      </div>
    </div>
  );
}