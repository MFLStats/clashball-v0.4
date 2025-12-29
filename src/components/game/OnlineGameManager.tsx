import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameCanvas } from './GameCanvas';
import { GameState } from '@shared/physics';
import { WSMessage, GameMode, PlayerMatchStats } from '@shared/types';
import { useUserStore } from '@/store/useUserStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';
import { SoundEngine } from '@/lib/audio';
import { NetworkIndicator } from '@/components/ui/network-indicator';
interface OnlineGameManagerProps {
  mode: GameMode;
  onExit: () => void;
  matchId?: string; // Optional: If provided, we are reconnecting or joining specific match
}
interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  team: 'red' | 'blue';
}
export function OnlineGameManager({ mode, onExit, matchId }: OnlineGameManagerProps) {
  const profile = useUserStore(s => s.profile);
  const [status, setStatus] = useState<'connecting' | 'searching' | 'playing' | 'error'>('connecting');
  const [queueCount, setQueueCount] = useState(0);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [ping, setPing] = useState<number | null>(null);
  const [finalStats, setFinalStats] = useState<Record<string, PlayerMatchStats> | undefined>(undefined);
  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastPingTimeRef = useRef<number>(0);
  // Use refs to access latest state in callbacks without triggering re-renders or effect re-runs
  const matchInfoRef = useRef<{ matchId: string; team: 'red' | 'blue' } | null>(null);
  const [matchInfo, setMatchInfo] = useState<{ matchId: string; team: 'red' | 'blue' } | null>(null);
  // Sync ref with state
  useEffect(() => {
    matchInfoRef.current = matchInfo;
  }, [matchInfo]);
  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case 'match_found': {
        const info = { matchId: msg.matchId, team: msg.team };
        setMatchInfo(info);
        matchInfoRef.current = info;
        setStatus('playing');
        toast.success(`Match Found! You are Team ${msg.team.toUpperCase()}`);
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
        const currentTeam = matchInfoRef.current?.team;
        SoundEngine.playWhistle();
        // Store stats for summary
        if (msg.stats) {
            setFinalStats(msg.stats);
        }
        // Don't auto-exit, let user view summary
        break;
      }
      case 'chat': {
        setChatMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: msg.sender || 'Unknown',
            message: msg.message,
            team: msg.team || 'red'
          }
        ]);
        break;
      }
      case 'error': {
        toast.error(msg.message);
        break;
      }
      case 'ping': {
        // Server pinging client
        wsRef.current?.send(JSON.stringify({ type: 'pong' }));
        break;
      }
      case 'pong': {
        // Client received pong from server
        const rtt = Date.now() - lastPingTimeRef.current;
        setPing(rtt);
        break;
      }
    }
  }, []);
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
  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'chat',
      message: chatInput
    } satisfies WSMessage));
    setChatInput('');
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
          {queueCount > 0 && (
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
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <p className="text-red-500 font-bold">Connection Failed</p>
        <Button onClick={onExit}>Return to Lobby</Button>
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
            <span className={`px-3 py-1 rounded-full text-white font-bold text-sm ${matchInfo?.team === 'red' ? 'bg-red-500' : 'bg-blue-500'}`}>
                TEAM {matchInfo?.team.toUpperCase()}
            </span>
        </div>
      </div>
      <div className="relative">
        <GameCanvas
            externalState={gameState}
            onInput={handleInput}
            winningScore={3}
            currentUserId={profile?.id}
            finalStats={finalStats}
            onLeave={onExit}
        />
        {/* Chat Overlay */}
        <div className="absolute bottom-4 left-4 w-80 max-h-64 flex flex-col gap-2 z-20">
            <div className="flex-1 overflow-y-auto bg-black/40 backdrop-blur-sm rounded-lg p-2 space-y-1 scrollbar-hide">
                {chatMessages.map(msg => (
                    <div key={msg.id} className="text-sm text-white drop-shadow-md">
                        <span className={`font-bold ${msg.team === 'red' ? 'text-red-300' : 'text-blue-300'}`}>
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