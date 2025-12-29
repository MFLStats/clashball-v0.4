import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameCanvas } from './GameCanvas';
import { GameState } from '@shared/physics';
import { WSMessage, GameMode, PlayerMatchStats } from '@shared/types';
import { useUserStore } from '@/store/useUserStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Send, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { SoundEngine } from '@/lib/audio';
import { NetworkIndicator } from '@/components/ui/network-indicator';
interface OnlineGameManagerProps {
  mode: GameMode;
  onExit: () => void;
  matchId?: string;
}
interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  team: 'red' | 'blue' | 'spectator';
}
export function OnlineGameManager({ mode, onExit, matchId }: OnlineGameManagerProps) {
  const profile = useUserStore(s => s.profile);
  const userId = profile?.id;
  const username = profile?.username;
  const [status, setStatus] = useState<'connecting' | 'searching' | 'playing' | 'error'>('connecting');
  const [queueCount, setQueueCount] = useState(0);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [ping, setPing] = useState<number | null>(null);
  const [finalStats, setFinalStats] = useState<Record<string, PlayerMatchStats> | undefined>(undefined);
  const [winner, setWinner] = useState<'red' | 'blue' | null>(null);
  const [matchInfo, setMatchInfo] = useState<{ matchId: string; team: 'red' | 'blue' | 'spectator' } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastPingTimeRef = useRef<number>(0);
  const connectionLock = useRef(false);
  const isMountedRef = useRef(true);
  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);
  // Memoized Message Handler
  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case 'match_started':
      case 'match_found': {
        setMatchInfo({ matchId: msg.matchId, team: msg.team });
        setStatus('playing');
        if (msg.team === 'spectator') {
            toast.info('Spectating Match');
        } else {
            const opponents = msg.opponents?.length ? msg.opponents.join(', ') : msg.opponent;
            toast.success(`Match Found! You are Team ${msg.team.toUpperCase()}${opponents ? ` vs ${opponents}` : ''}`);
        }
        break;
      }
      case 'queue_update': {
        setQueueCount(msg.count);
        break;
      }
      case 'game_state': {
        setGameState(msg.state);
        break;
      }
      case 'game_events': {
        msg.events.forEach(event => {
            switch (event.type) {
                case 'kick': SoundEngine.playKick(); break;
                case 'wall': SoundEngine.playWall(); break;
                case 'player': SoundEngine.playPlayer(); break;
                case 'goal': SoundEngine.playGoal(); break;
                case 'whistle': SoundEngine.playWhistle(); break;
            }
        });
        break;
      }
      case 'game_over': {
        SoundEngine.playWhistle();
        if (msg.stats) {
            setFinalStats(msg.stats);
        }
        setWinner(msg.winner);
        break;
      }
      case 'chat': {
        setChatMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: msg.sender || 'Unknown',
            message: msg.message,
            team: msg.team || 'spectator'
          }
        ]);
        break;
      }
      case 'error': {
        toast.error(msg.message);
        break;
      }
      case 'ping': {
        wsRef.current?.send(JSON.stringify({ type: 'pong' }));
        break;
      }
      case 'pong': {
        const rtt = Date.now() - lastPingTimeRef.current;
        setPing(rtt);
        break;
      }
    }
  }, []);
  // Memoized Connect Function
  const connect = useCallback(() => {
    if (!userId || !username) {
        toast.error("User profile missing. Cannot join queue.");
        onExit();
        return;
    }
    // Prevent duplicate connections if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
        return;
    }
    setStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws`;
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => {
      if (!isMountedRef.current) {
          ws.close();
          return;
      }
      setStatus('searching');
      // Join Queue
      ws.send(JSON.stringify({
        type: 'join_queue',
        mode,
        userId,
        username
      } satisfies WSMessage));
    };
    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        handleMessage(msg);
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };
    ws.onclose = (event) => {
      if (!isMountedRef.current) return;
      console.log('WebSocket closed', event.code, event.reason);
      // Only show error if it wasn't a clean close initiated by us (usually)
      if (status !== 'error') {
          setStatus('error');
      }
      wsRef.current = null;
    };
    ws.onerror = (error) => {
      console.error('WebSocket connection error', error);
      if (isMountedRef.current) {
          setStatus('error');
      }
    };
  }, [userId, username, mode, onExit, handleMessage, status]);
  // Initial Connection
  useEffect(() => {
    if (connectionLock.current) return;
    connectionLock.current = true;
    connect();
    return () => {
      connectionLock.current = false;
      if (wsRef.current) {
        // Try to leave queue gracefully
        if (wsRef.current.readyState === WebSocket.OPEN) {
            try {
                wsRef.current.send(JSON.stringify({ type: 'leave_queue' } satisfies WSMessage));
            } catch (e) { /* ignore */ }
        }
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);
  // Ping Loop
  useEffect(() => {
    const interval = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            lastPingTimeRef.current = Date.now();
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
        }
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  // Memoized Input Handler
  const handleInput = useCallback((input: { move: { x: number; y: number }; kick: boolean }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'input',
        move: input.move,
        kick: input.kick
      } satisfies WSMessage));
    }
  }, []);
  // Memoized Chat Sender
  const sendChat = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'chat',
      message: chatInput
    } satisfies WSMessage));
    setChatInput('');
  }, [chatInput]);
  // Memoized Retry Handler
  const handleRetry = useCallback(() => {
      if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
      }
      connect();
  }, [connect]);
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
          {status === 'searching' && queueCount > 0 && (
              <p className="text-sm font-bold text-haxball-blue animate-pulse">
                  {queueCount} Player{queueCount !== 1 ? 's' : ''} in Queue
              </p>
          )}
        </div>
        <Button variant="ghost" onClick={onExit}>Cancel</Button>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 animate-fade-in">
        <div className="p-4 bg-red-100 rounded-full">
            <RefreshCw className="w-12 h-12 text-red-500" />
        </div>
        <div className="text-center space-y-2">
            <h2 className="text-2xl font-display font-bold text-slate-800">Connection Lost</h2>
            <p className="text-slate-500 max-w-md text-center">
                Could not establish a stable connection to the game server. This might be due to network issues or server maintenance.
            </p>
        </div>
        <div className="flex gap-4">
            <Button variant="outline" onClick={onExit}>Return to Lobby</Button>
            <Button onClick={handleRetry} className="btn-kid-primary">
                <RefreshCw className="w-4 h-4 mr-2" /> Retry Connection
            </Button>
        </div>
      </div>
    );
  }
  // Loading state for match initialization (prevents race condition)
  if (status === 'playing' && !gameState) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
          <div className="relative bg-white p-4 rounded-full shadow-lg border-4 border-emerald-100">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-display font-bold text-slate-800">
            Preparing Match...
          </h2>
          <p className="text-slate-500">Synchronizing with server</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4 animate-fade-in relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onExit}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Leave Match
            </Button>
            <NetworkIndicator ping={ping} />
        </div>
        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-500">YOU ARE</span>
            <span className={`px-3 py-1 rounded-full text-white font-bold text-sm ${
                matchInfo?.team === 'red' ? 'bg-red-500' :
                matchInfo?.team === 'blue' ? 'bg-blue-500' : 'bg-slate-500'
            }`}>
                {matchInfo?.team === 'spectator' ? 'SPECTATING' : `TEAM ${matchInfo?.team.toUpperCase()}`}
            </span>
        </div>
      </div>
      <div className="relative">
        <GameCanvas
            externalState={gameState}
            externalWinner={winner}
            onInput={matchInfo?.team === 'spectator' ? undefined : handleInput}
            winningScore={3}
            currentUserId={userId}
            finalStats={finalStats}
            onLeave={onExit}
        />
        {/* Chat Overlay */}
        <div className="absolute bottom-4 left-4 w-80 max-h-64 flex flex-col gap-2 z-20">
            <div className="flex-1 overflow-y-auto bg-black/40 backdrop-blur-sm rounded-lg p-2 space-y-1 scrollbar-hide">
                {chatMessages.map(msg => (
                    <div key={msg.id} className="text-sm text-white drop-shadow-md">
                        <span className={`font-bold ${
                            msg.team === 'red' ? 'text-red-300' :
                            msg.team === 'blue' ? 'text-blue-300' : 'text-slate-300'
                        }`}>
                            {msg.sender}:
                        </span>
                        <span className="ml-1">{msg.message}</span>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendChat} className="flex gap-2">
                <Input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="bg-black/40 border-white/20 text-white placeholder:text-white/50 h-8 text-sm"
                />
                <Button type="submit" size="sm" className="h-8 w-8 p-0 bg-white/20 hover:bg-white/30">
                    <Send className="w-3 h-3" />
                </Button>
            </form>
        </div>
      </div>
    </div>
  );
}