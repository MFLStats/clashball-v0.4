import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameCanvas } from './GameCanvas';
import { GameState } from '@shared/physics';
import { WSMessage, GameMode } from '@shared/types';
import { useUserStore } from '@/store/useUserStore';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
interface OnlineGameManagerProps {
  mode: GameMode;
  onExit: () => void;
}
export function OnlineGameManager({ mode, onExit }: OnlineGameManagerProps) {
  const profile = useUserStore(s => s.profile);
  const [status, setStatus] = useState<'connecting' | 'searching' | 'playing' | 'error'>('connecting');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // Use refs to access latest state in callbacks without triggering re-renders or effect re-runs
  const matchInfoRef = useRef<{ matchId: string; team: 'red' | 'blue' } | null>(null);
  const [matchInfo, setMatchInfo] = useState<{ matchId: string; team: 'red' | 'blue' } | null>(null);
  // Sync ref with state
  useEffect(() => {
    matchInfoRef.current = matchInfo;
  }, [matchInfo]);
  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case 'match_found':
        const info = { matchId: msg.matchId, team: msg.team };
        setMatchInfo(info);
        matchInfoRef.current = info; // Update ref immediately for subsequent messages in same tick
        setStatus('playing');
        toast.success(`Match Found! You are Team ${msg.team.toUpperCase()}`);
        break;
      case 'game_state':
        setGameState(msg.state);
        break;
      case 'game_over':
        const currentTeam = matchInfoRef.current?.team;
        toast(msg.winner === currentTeam ? 'VICTORY!' : 'DEFEAT', {
          description: `Winner: ${msg.winner.toUpperCase()}`
        });
        setTimeout(() => {
            onExit();
        }, 3000);
        break;
      case 'error':
        toast.error(msg.message);
        break;
      case 'ping':
        wsRef.current?.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }, [onExit]);
  useEffect(() => {
    if (!profile) return;
    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/api/ws`);
    wsRef.current = ws;
    ws.onopen = () => {
      setStatus('searching');
      // Join Queue
      ws.send(JSON.stringify({
        type: 'join_queue',
        mode,
        userId: profile.id,
        username: profile.username
      } satisfies WSMessage));
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        handleMessage(msg);
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };
    ws.onclose = () => {
      // If we were searching and component unmounts/closes, we might want to handle that
      // But here we just check if it was an error close
    };
    ws.onerror = () => {
      setStatus('error');
      toast.error('Connection error');
    };
    return () => {
      // Cleanup: Leave queue if searching
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leave_queue' } satisfies WSMessage));
        ws.close();
      }
    };
  }, [profile, mode, handleMessage]);
  const handleInput = (input: { move: { x: number; y: number }; kick: boolean }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'input',
        move: input.move,
        kick: input.kick
      } satisfies WSMessage));
    }
  };
  if (status === 'connecting' || status === 'searching') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
          <div className="relative bg-white p-4 rounded-full shadow-lg border-4 border-blue-100">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-display font-bold text-slate-800">
            {status === 'connecting' ? 'Connecting to Server...' : 'Searching for Opponent...'}
          </h2>
          <p className="text-slate-500">Mode: {mode}</p>
        </div>
        <Button variant="ghost" onClick={onExit}>Cancel</Button>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <p className="text-red-500 font-bold">Connection Failed</p>
        <Button onClick={onExit}>Return to Lobby</Button>
      </div>
    );
  }
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onExit}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Leave Match
        </Button>
        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-500">YOU ARE</span>
            <span className={`px-3 py-1 rounded-full text-white font-bold text-sm ${matchInfo?.team === 'red' ? 'bg-red-500' : 'bg-blue-500'}`}>
                TEAM {matchInfo?.team.toUpperCase()}
            </span>
        </div>
      </div>
      <GameCanvas 
        externalState={gameState} 
        onInput={handleInput}
        winningScore={3}
      />
    </div>
  );
}