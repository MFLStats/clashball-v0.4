import React, { useEffect, useRef, useState } from 'react';
import { PhysicsEngine, GameState, PHYSICS_CONFIG } from '@/lib/physics';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw } from 'lucide-react';
interface GameCanvasProps {
  onGameEnd?: (winner: 'red' | 'blue') => void;
}
export function GameCanvas({ onGameEnd }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const gameStateRef = useRef<GameState>(PhysicsEngine.createInitialState());
  const keysRef = useRef<Record<string, boolean>>({});
  const [score, setScore] = useState({ red: 0, blue: 0 });
  const [isPaused, setIsPaused] = useState(false);
  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, []);
  // Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const loop = () => {
      if (isPaused) {
        requestRef.current = requestAnimationFrame(loop);
        return;
      }
      // 1. Process Input for Local Player (P1)
      const p1Input = { move: { x: 0, y: 0 }, kick: false };
      if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) p1Input.move.y -= 1;
      if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) p1Input.move.y += 1;
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) p1Input.move.x -= 1;
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) p1Input.move.x += 1;
      if (keysRef.current['Space'] || keysRef.current['KeyX']) p1Input.kick = true;
      // Update P1 Input in State
      gameStateRef.current.players[0].input = p1Input;
      // Simple Bot Logic for P2
      const ball = gameStateRef.current.ball;
      const p2 = gameStateRef.current.players[1];
      const dx = ball.pos.x - p2.pos.x;
      const dy = ball.pos.y - p2.pos.y;
      // Simple follow ball
      const botMove = { x: 0, y: 0 };
      if (Math.abs(dx) > 10) botMove.x = Math.sign(dx);
      if (Math.abs(dy) > 10) botMove.y = Math.sign(dy);
      // Bot kick if close
      const dist = Math.sqrt(dx*dx + dy*dy);
      const botKick = dist < 30 && Math.random() < 0.05;
      gameStateRef.current.players[1].input = { move: botMove, kick: botKick };
      // 2. Physics Update
      const prevState = gameStateRef.current;
      const newState = PhysicsEngine.update(prevState);
      gameStateRef.current = newState;
      // Check for score change to trigger React state update & effects
      if (newState.score.red !== score.red || newState.score.blue !== score.blue) {
        setScore(newState.score);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: newState.score.red > score.red ? ['#ef233c'] : ['#3a86ff']
        });
      }
      // 3. Render
      render(ctx, newState);
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [score, isPaused]); // Re-bind if score changes to keep local state sync, though ref handles logic
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
    // Center Line
    ctx.moveTo(width/2, 0);
    ctx.lineTo(width/2, height);
    // Center Circle
    ctx.moveTo(width/2 + 50 * scaleX, height/2);
    ctx.arc(width/2, height/2, 50 * scaleX, 0, Math.PI * 2);
    ctx.stroke();
    // Draw Goals
    const goalH = state.field.goalHeight * scaleY;
    const goalTop = (height - goalH) / 2;
    // Left Goal Area
    ctx.fillStyle = 'rgba(58, 134, 255, 0.2)';
    ctx.fillRect(0, goalTop, 40 * scaleX, goalH);
    // Right Goal Area
    ctx.fillStyle = 'rgba(239, 35, 60, 0.2)';
    ctx.fillRect(width - 40 * scaleX, goalTop, 40 * scaleX, goalH);
    // Draw Players
    state.players.forEach(p => {
      const x = p.pos.x * scaleX;
      const y = p.pos.y * scaleY;
      const r = p.radius * scaleX;
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
      // Kick Indicator
      if (p.isKicking) {
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
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
        <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Time: 00:00</div>
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
        {/* Controls Overlay (Visible on Hover/Pause) */}
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
           <Button size="icon" variant="secondary" onClick={handleReset}>
             <RotateCcw className="w-4 h-4" />
           </Button>
           <Button size="icon" variant="secondary" onClick={() => setIsPaused(!isPaused)}>
             <Play className="w-4 h-4" />
           </Button>
        </div>
      </div>
      <div className="text-sm text-slate-500 font-medium">
        Controls: WASD to Move • SPACE to Kick
      </div>
    </div>
  );
}