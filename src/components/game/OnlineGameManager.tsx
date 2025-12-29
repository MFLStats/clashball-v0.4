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
import { QuickChat } from './QuickChat';
import { GameSocket } from '@/lib/game-socket';
import { cn } from '@/lib/utils';
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
  const [isWaitingForOpponent, setIsWaitingForOpponent] = useState(false);
  const socketRef = useRef<GameSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  // Initialize Socket
  useEffect(() => {
    if (!userId || !username) {
        toast.error("User profile missing. Cannot join queue.");
        onExit();
        return;
    }
    const socket = new GameSocket();
    socketRef.current = socket;
    const onMatchFound = (msg: WSMessage) => {
        if (msg.type !== 'match_found' && msg.type !== 'match_started') return;
        setMatchInfo({ matchId: msg.matchId, team: msg.team });
        setStatus('playing');
        setIsWaitingForOpponent(false);
        if (msg.team === 'spectator') {
            toast.info('Spectating Match');
        } else {
            const opponents = msg.opponents?.length ? msg.opponents.join(', ') : msg.opponent;
            toast.success(`Match Found! You are Team ${msg.team.toUpperCase()}${opponents ? ` vs ${opponents}` : ''}`);
        }
    };
    const onQueueUpdate = (msg: WSMessage) => {
        if (msg.type === 'queue_update') setQueueCount(msg.count);
    };
    const onGameState = (msg: WSMessage) => {
        if (msg.type === 'game_state') setGameState(msg.state);
    };
    const onGameEvents = (msg: WSMessage) => {
        if (msg.type !== 'game_events') return;
        msg.events.forEach(event => {
            switch (event.type) {
                case 'kick': SoundEngine.playKick(); break;
                case 'wall': SoundEngine.playWall(); break;
                case 'player': SoundEngine.playPlayer(); break;
                case 'goal': SoundEngine.playGoal(); break;
                case 'whistle': SoundEngine.playWhistle(); break;
            }
        });
    };
    const onGameOver = (msg: WSMessage) => {
        if (msg.type !== 'game_over') return;
        SoundEngine.playWhistle();
        if (msg.stats) {
            setFinalStats(msg.stats);
        }
        setWinner(msg.winner);
    };
    const onChat = (msg: WSMessage) => {
        if (msg.type !== 'chat') return;
        setChatMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: msg.sender || 'Unknown',
            message: msg.message,
            team: msg.team || 'spectator'
          }
        ]);
    };
    const onError = (msg: WSMessage) => {
        if (msg.type === 'error') {
            toast.error(msg.message);
            if (msg.message.includes('Connection lost')) {
                setStatus('error');
            }
        }
    };
    const onTournamentWaiting = (msg: WSMessage) => {
        if (msg.type === 'tournament_waiting') {
            setIsWaitingForOpponent(true);
            setStatus('playing'); // Set to playing to avoid "Connecting" screen, but render waiting UI
        }
    };
    socket.on('match_found', onMatchFound);
    socket.on('match_started', onMatchFound);
    socket.on('queue_update', onQueueUpdate);
    socket.on('game_state', onGameState);
    socket.on('game_events', onGameEvents);
    socket.on('game_over', onGameOver);
    socket.on('chat', onChat);
    socket.on('error', onError);
    socket.on('tournament_waiting', onTournamentWaiting);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws`;
    socket.connect(wsUrl, userId, username, () => {
        setStatus('searching');
        if (matchId) {
            // Direct join for tournament
            socket.send({
                type: 'join_match',
                matchId,
                userId,
                username
            });
        } else {
            // Standard queue
            socket.send({
                type: 'join_queue',
                mode,
                userId,
                username
            });
        }
    });
    return () => {
        socket.disconnect();
    };
  }, [userId, username, mode, onExit, matchId]);
  const handleInput = useCallback((input: { move: { x: number; y: number }; kick: boolean }) => {
    socketRef.current?.send({
        type: 'input',
        move: input.move,
        kick: input.kick
    });
  }, []);
  const sendChat = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current?.send({
      type: 'chat',
      message: chatInput
    });
    setChatInput('');
  }, [chatInput]);
  const handleQuickChat = useCallback((message: string) => {
    socketRef.current?.send({
      type: 'chat',
      message
    });
  }, []);
  const handleRetry = () => {
      window.location.reload();
  };
  const handlePlayAgain = useCallback(() => {
    if (matchId) {
        // For tournament, play again just exits to bracket
        onExit();
        return;
    }
    setWinner(null);
    setFinalStats(undefined);
    setGameState(null);
    setMatchInfo(null);
    setStatus('searching');
    if (userId && username) {
        socketRef.current?.send({
            type: 'join_queue',
            mode,
            userId,
            username
        });
    }
  }, [mode, userId, username, matchId, onExit]);
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
            {status === 'connecting' ? 'Connecting to Server...' : matchId ? 'Joining Match...' : 'Searching for Opponent...'}
          </h2>
          <p className="text-slate-500">Mode: {mode}</p>
          {status === 'searching' && queueCount > 0 && !matchId && (
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
  if (isWaitingForOpponent) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-yellow-500/20 rounded-full animate-ping" />
          <div className="relative bg-white p-4 rounded-full shadow-lg border-4 border-yellow-100">
            <Loader2 className="w-12 h-12 animate-spin text-yellow-500" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-display font-bold text-slate-800">
            Waiting for Opponent...
          </h2>
          <p className="text-slate-500">Your opponent is connecting to the server.</p>
        </div>
        <Button variant="ghost" onClick={onExit}>Cancel</Button>
      </div>
    );
  }
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
    <div className="flex flex-col gap-4 animate-fade-in max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onExit}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Leave Match
            </Button>
            <NetworkIndicator ping={ping} />
        </div>
        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-500">YOU ARE</span>
            <span className={cn(
                "px-3 py-1 rounded-full text-white font-bold text-sm",
                matchInfo?.team === 'red' ? 'bg-red-500' :
                matchInfo?.team === 'blue' ? 'bg-blue-500' : 'bg-slate-500'
            )}>
                {matchInfo?.team === 'spectator' ? 'SPECTATING' : `TEAM ${matchInfo?.team.toUpperCase()}`}
            </span>
        </div>
      </div>
      {/* Game Canvas Container */}
      <div className="relative w-full">
        <GameCanvas
            externalState={gameState}
            externalWinner={winner}
            onInput={matchInfo?.team === 'spectator' ? undefined : handleInput}
            winningScore={3}
            currentUserId={userId}
            finalStats={finalStats}
            onLeave={onExit}
            onPlayAgain={handlePlayAgain}
        />
      </div>
      {/* Chat Section - Moved Below Canvas */}
      <div className="w-full bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col gap-3 shadow-lg">
          <div className="h-32 overflow-y-auto bg-black/30 rounded-lg p-2 space-y-1 scrollbar-hide border border-white/5">
              {chatMessages.map(msg => (
                  <div key={msg.id} className="text-sm text-slate-200">
                      <span className={cn("font-bold mr-2",
                          msg.team === 'red' ? 'text-red-400' :
                          msg.team === 'blue' ? 'text-blue-400' : 'text-slate-400'
                      )}>
                          {msg.sender}:
                      </span>
                      <span>{msg.message}</span>
                  </div>
              ))}
              <div ref={chatEndRef} />
          </div>
          <div className="flex flex-col gap-2">
              <QuickChat onSelect={handleQuickChat} />
              <form onSubmit={sendChat} className="flex gap-2">
                  <Input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Type a message..."
                      className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 h-10"
                  />
                  <Button type="submit" size="icon" className="h-10 w-10 bg-slate-800 hover:bg-slate-700 border border-slate-700">
                      <Send className="w-4 h-4" />
                  </Button>
              </form>
          </div>
      </div>
    </div>
  );
}