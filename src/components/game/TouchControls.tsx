import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
interface TouchControlsProps {
  onUpdate: (input: { move: { x: number; y: number }; kick: boolean }) => void;
}
export function TouchControls({ onUpdate }: TouchControlsProps) {
  // Refs for input state to avoid re-renders during high-frequency updates
  const inputState = useRef({
    move: { x: 0, y: 0 },
    kick: false
  });
  // Visual state for the joystick
  const [joystickVisual, setJoystickVisual] = useState<{
    x: number; // Origin X
    y: number; // Origin Y
    dx: number; // Delta X
    dy: number; // Delta Y
  } | null>(null);
  const [isKicking, setIsKicking] = useState(false);
  // Constants
  const MAX_RADIUS = 50;
  // Track pointer IDs
  const joystickPointerId = useRef<number | null>(null);
  const joystickOrigin = useRef<{ x: number; y: number } | null>(null);
  // Helper to update parent
  const updateParent = useCallback(() => {
    onUpdate(inputState.current);
  }, [onUpdate]);
  // --- Joystick Handlers ---
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // If already controlling joystick, ignore new touches on background
    if (joystickPointerId.current !== null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    joystickPointerId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    joystickOrigin.current = { x, y };
    // Show visual at touch point
    setJoystickVisual({ x, y, dx: 0, dy: 0 });
    // Reset move
    inputState.current.move = { x: 0, y: 0 };
    updateParent();
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joystickPointerId.current || !joystickOrigin.current) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    const dx = currentX - joystickOrigin.current.x;
    const dy = currentY - joystickOrigin.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    let inputX = 0;
    let inputY = 0;
    if (distance > 0) {
      // Clamp visual knob
      const clampedDistance = Math.min(distance, MAX_RADIUS);
      const ratio = clampedDistance / distance;
      const visualDx = dx * ratio;
      const visualDy = dy * ratio;
      setJoystickVisual(prev => prev ? { ...prev, dx: visualDx, dy: visualDy } : null);
      // Normalize input (0 to 1)
      const magnitude = Math.min(distance / MAX_RADIUS, 1.0);
      inputX = (dx / distance) * magnitude;
      inputY = (dy / distance) * magnitude;
    } else {
      setJoystickVisual(prev => prev ? { ...prev, dx: 0, dy: 0 } : null);
    }
    inputState.current.move = { x: inputX, y: inputY };
    updateParent();
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joystickPointerId.current) return;
    e.preventDefault();
    joystickPointerId.current = null;
    joystickOrigin.current = null;
    setJoystickVisual(null);
    inputState.current.move = { x: 0, y: 0 };
    updateParent();
  };
  // --- Kick Button Handlers ---
  const handleKickDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering joystick
    // Haptic Feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
    }
    setIsKicking(true);
    inputState.current.kick = true;
    updateParent();
  };
  const handleKickUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsKicking(false);
    inputState.current.kick = false;
    updateParent();
  };
  // Reset on unmount
  useEffect(() => {
    return () => {
      onUpdate({ move: { x: 0, y: 0 }, kick: false });
    };
  }, [onUpdate]);
  return (
    <div
      className="absolute inset-0 z-20 touch-none select-none md:hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Dynamic Joystick Visual */}
      {joystickVisual && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: joystickVisual.x,
            top: joystickVisual.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          {/* Base */}
          <div className="w-24 h-24 rounded-full bg-slate-900/30 border-2 border-white/10 backdrop-blur-sm" />
          {/* Knob */}
          <div
            className="absolute w-10 h-10 rounded-full bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.3)]"
            style={{
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${joystickVisual.dx}px), calc(-50% + ${joystickVisual.dy}px))`
            }}
          />
        </div>
      )}
      {/* Kick Button */}
      <button
        className={cn(
          "absolute bottom-8 right-8 w-20 h-20 rounded-full border-4 shadow-xl flex items-center justify-center pointer-events-auto touch-none select-none transition-all duration-100 active:scale-95",
          isKicking
            ? "bg-red-600 border-red-800 scale-95 shadow-inner"
            : "bg-red-500/80 border-red-600/80 hover:bg-red-500 backdrop-blur-sm"
        )}
        onPointerDown={handleKickDown}
        onPointerUp={handleKickUp}
        onPointerCancel={handleKickUp}
        onPointerLeave={handleKickUp}
      >
        <span className="font-display font-bold text-white text-lg tracking-wider drop-shadow-md">
          KICK
        </span>
      </button>
    </div>
  );
}