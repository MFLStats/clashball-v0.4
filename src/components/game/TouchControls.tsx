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
  // Visual state for the joystick knob
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isKicking, setIsKicking] = useState(false);
  // Constants
  const JOYSTICK_RADIUS = 50; // Max distance knob can move from center
  const JOYSTICK_CENTER = { x: 75, y: 75 }; // Center of the joystick container
  // Track pointer IDs
  const joystickPointerId = useRef<number | null>(null);
  // Helper to update parent
  const updateParent = useCallback(() => {
    onUpdate(inputState.current);
  }, [onUpdate]);
  // --- Joystick Handlers ---
  const handleJoystickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (joystickPointerId.current !== null) return; // Already controlling
    const element = e.currentTarget;
    element.setPointerCapture(e.pointerId);
    joystickPointerId.current = e.pointerId;
    handleJoystickMove(e);
  };
  const handleJoystickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joystickPointerId.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    // Calculate delta from center
    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;
    // Calculate distance
    const distance = Math.sqrt(dx * dx + dy * dy);
    // Normalize input vector (0 to 1)
    let inputX = 0;
    let inputY = 0;
    if (distance > 0) {
      // Clamp visual knob to radius
      const clampedDistance = Math.min(distance, JOYSTICK_RADIUS);
      const ratio = clampedDistance / distance;
      const visualX = dx * ratio;
      const visualY = dy * ratio;
      setJoystickPos({ x: visualX, y: visualY });
      // Normalize input
      // We want full speed (1.0) when at edge
      inputX = dx / distance; // Direction
      inputY = dy / distance; // Direction
      // Apply magnitude (linear)
      const magnitude = Math.min(distance / JOYSTICK_RADIUS, 1.0);
      inputX *= magnitude;
      inputY *= magnitude;
    } else {
      setJoystickPos({ x: 0, y: 0 });
    }
    inputState.current.move = { x: inputX, y: inputY };
    updateParent();
  };
  const handleJoystickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joystickPointerId.current) return;
    e.preventDefault();
    e.stopPropagation();
    joystickPointerId.current = null;
    setJoystickPos({ x: 0, y: 0 });
    inputState.current.move = { x: 0, y: 0 };
    updateParent();
  };
  // --- Kick Button Handlers ---
  const handleKickDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
      onUpdate({ move: { x: 0, y: 0 }, kick: false });
    };
  }, [onUpdate]);
  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex justify-between items-end p-6 md:hidden select-none touch-none">
      {/* Joystick Area */}
      <div 
        className="relative w-36 h-36 bg-slate-900/20 rounded-full backdrop-blur-sm border-2 border-white/30 pointer-events-auto touch-none"
        onPointerDown={handleJoystickDown}
        onPointerMove={handleJoystickMove}
        onPointerUp={handleJoystickUp}
        onPointerCancel={handleJoystickUp}
        onPointerLeave={handleJoystickUp}
      >
        {/* Knob */}
        <div 
          className="absolute w-16 h-16 bg-gradient-to-b from-white to-slate-200 rounded-full shadow-lg border-2 border-slate-300 transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-out"
          style={{ 
            left: '50%', 
            top: '50%',
            transform: `translate(calc(-50% + ${joystickPos.x}px), calc(-50% + ${joystickPos.y}px))`
          }}
        />
      </div>
      {/* Kick Button */}
      <button
        className={cn(
          "w-24 h-24 rounded-full border-4 shadow-xl flex items-center justify-center pointer-events-auto touch-none transition-all duration-100 active:scale-95",
          isKicking 
            ? "bg-red-600 border-red-800 scale-95" 
            : "bg-red-500 border-red-700 hover:bg-red-400"
        )}
        onPointerDown={handleKickDown}
        onPointerUp={handleKickUp}
        onPointerCancel={handleKickUp}
        onPointerLeave={handleKickUp}
      >
        <span className="font-display font-bold text-white text-xl tracking-wider drop-shadow-md">
          KICK
        </span>
      </button>
    </div>
  );
}