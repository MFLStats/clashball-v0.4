import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameCanvas } from './GameCanvas';
import { GameState } from '@shared/physics';
import { WSMessage, LobbyState } from '@shared/types';
import { useUserStore } from '@/store/useUserStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Users, Copy, Play, Send } from 'lucide-react';
import { toast } from 'sonner';
import { SoundEngine } from '@/lib/audio';
interface CustomLobbyManagerProps {
  onExit: () => void;
}
interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  team: 'red' | 'blue';
}
export function CustomLobbyManager({ onExit }: CustomLobbyManagerProps) {
  const profile = useUserStore(s => s.profile);
  const [view, setView] = useState<'menu' | 'lobby' | 'game'>('menu');
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  // Game State
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [matchInfo, setMatchInfo] = useState<{ matchId: string; team: 'red' | 'blue' } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
        case 'lobby_update': {
            setLobbyState(msg.state);
            setView('lobby');
            setIsConnecting(false);
            break;
        }
        case 'match_found': {
            setMatchInfo({ matchId: msg.matchId, team: msg.team });
            setView('game');
            toast.success('Match Starting!');
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
            toast(msg.winner === matchInfo?.team ? 'VICTORY!' : 'DEFEAT', {
              description: `Winner: ${msg.winner.toUpperCase()}`
            });
            setTimeout(() => {
                // Return to lobby view instead of exiting completely
                setView('lobby');
                setGameState(null);
                setMatchInfo(null);
            }, 3000);
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
            setIsConnecting(false);
            break;
        }
        case 'ping': {
            wsRef.current?.send(JSON.stringify({ type: 'pong' }));
            break;
        }
    }
  }, [matchInfo]);
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return wsRef.current;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/api/ws`);
    wsRef.current = ws;
    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data) as WSMessage;
            handleMessage(msg);
        } catch (e) {
            console.error('Failed to parse WS message', e);
        }
    };
    ws.onerror = () => {
        toast.error('Connection error');
        setIsConnecting(false);
    };
    return ws;
  }, [handleMessage]);
  const createLobby = () => {
    if (!profile) return;
    setIsConnecting(true);
    const ws = connectWS();
    if (ws) {
        ws.onopen = () => {
            ws.send(JSON.stringify({
                type: 'create_lobby',
                userId: profile.id,
                username: profile.username
            }));
        };
        // If already open
        if (ws.readyState === WebSocket.OPEN) {
             ws.send(JSON.stringify({
                type: 'create_lobby',
                userId: profile.id,
                username: profile.username
            }));
        }
    }
  };
  const joinLobby = () => {
    if (!profile || !joinCode) return;
    setIsConnecting(true);
    const ws = connectWS();
    if (ws) {
        const sendJoin = () => {
            ws.send(JSON.stringify({
                type: 'join_lobby',
                code: joinCode,
                userId: profile.id,
                username: profile.username
            }));
        };
        if (ws.readyState === WebSocket.OPEN) sendJoin();
        else ws.onopen = sendJoin;
    }
  };
  const startMatch = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'start_lobby_match' }));
    }
  };
  const handleInput = (input: { move: { x: number; y: number }; kick: boolean }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'input',
        move: input.move,
        kick: input.kick
      }));
    }
  };
  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'chat',
      message: chatInput
    }));
    setChatInput('');
  };
  const copyCode = () => {
      if (lobbyState?.code) {
          navigator.clipboard.writeText(lobbyState.code);
          toast.success('Lobby code copied!');
      }
  };
  // Cleanup
  useEffect(() => {
      return () => {
          if (wsRef.current) {
              wsRef.current.close();
          }
      };
  }, []);
  if (view === 'menu') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8 animate-fade-in">
            <div className="flex items-center justify-between w-full max-w-md">
                <Button variant="ghost" onClick={onExit} className="text-slate-300 hover:bg-white/10">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <h2 className="text-2xl font-display font-bold text-white text-glow">Custom Lobby</h2>
                <div className="w-20" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                {/* Create */}
                <Card className="card-kid hover:border-neon-blue transition-colors cursor-pointer" onClick={createLobby}>
                    <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                        <div className="p-4 bg-blue-500/20 rounded-full text-neon-blue border border-blue-500/30">
                            <Users className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Create Lobby</h3>
                        <p className="text-slate-400">Host a private match and invite friends with a code.</p>
                        <Button className="w-full btn-kid-primary" disabled={isConnecting}>
                            {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                        </Button>
                    </CardContent>
                </Card>
                {/* Join */}
                <Card className="card-kid">
                    <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                        <div className="p-4 bg-green-500/20 rounded-full text-green-400 border border-green-500/30">
                            <Send className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Join Lobby</h3>
                        <p className="text-slate-400">Enter a code to join an existing lobby.</p>
                        <div className="flex gap-2 w-full">
                            <Input 
                                placeholder="ENTER CODE" 
                                className="text-center uppercase font-mono font-bold tracking-widest bg-slate-950/50 border-white/10 text-white"
                                value={joinCode}
                                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                maxLength={6}
                            />
                            <Button onClick={joinLobby} disabled={isConnecting || joinCode.length !== 6} className="btn-kid-secondary">
                                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      );
  }
  if (view === 'lobby' && lobbyState) {
      const isHost = lobbyState.hostId === profile?.id;
      return (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={onExit} className="text-slate-300 hover:bg-white/10">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Leave Lobby
                  </Button>
                  <div className="flex items-center gap-2 bg-slate-900/80 px-4 py-2 rounded-full shadow-glass border border-white/10">
                      <span className="text-slate-400 font-bold text-sm">LOBBY CODE:</span>
                      <span className="font-mono font-bold text-xl text-neon-blue tracking-widest text-glow-blue">{lobbyState.code}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6 ml-2 text-slate-400 hover:text-white" onClick={copyCode}>
                          <Copy className="w-3 h-3" />
                      </Button>
                  </div>
              </div>
              <Card className="card-kid">
                  <CardHeader>
                      <CardTitle className="flex justify-between items-center text-white">
                          <span>Players ({lobbyState.players.length}/8)</span>
                          {isHost && (
                              <Button onClick={startMatch} disabled={lobbyState.players.length < 2} className="btn-kid-primary">
                                  <Play className="w-4 h-4 mr-2" /> Start Match
                              </Button>
                          )}
                      </CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {lobbyState.players.map(p => (
                              <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-white/5">
                                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300">
                                      {p.username.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-bold text-slate-200">{p.username}</span>
                                  {p.id === lobbyState.hostId && (
                                      <span className="ml-auto text-xs font-bold bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full border border-yellow-500/30">HOST</span>
                                  )}
                              </div>
                          ))}
                          {Array.from({ length: Math.max(0, 8 - lobbyState.players.length) }).map((_, i) => (
                              <div key={`empty-${i}`} className="flex items-center gap-3 p-3 border-2 border-dashed border-white/5 rounded-lg opacity-50">
                                  <div className="w-8 h-8 rounded-full bg-white/5" />
                                  <span className="text-slate-500 font-medium italic">Waiting...</span>
                              </div>
                          ))}
                      </div>
                  </CardContent>
              </Card>
              {!isHost && (
                  <div className="text-center text-slate-400 animate-pulse">
                      Waiting for host to start the match...
                  </div>
              )}
          </div>
      );
  }
  // Game View (Reusing GameCanvas logic)
  return (
    <div className="space-y-4 animate-fade-in relative">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setView('lobby')} className="text-slate-300 hover:bg-white/10">
          <ArrowLeft className="mr-2 h-4 w-4" /> Return to Lobby
        </Button>
        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-400">YOU ARE</span>
            <span className={`px-3 py-1 rounded-full text-white font-bold text-sm ${matchInfo?.team === 'red' ? 'bg-red-500' : 'bg-blue-500'} shadow-glow-sm`}>
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
        />
        {/* Chat Overlay */}
        <div className="absolute bottom-4 left-4 w-80 max-h-64 flex flex-col gap-2 z-20">
            <div className="flex-1 overflow-y-auto bg-black/60 backdrop-blur-md rounded-lg p-2 space-y-1 scrollbar-hide border border-white/10">
                {chatMessages.map(msg => (
                    <div key={msg.id} className="text-sm text-white drop-shadow-md">
                        <span className={`font-bold ${msg.team === 'red' ? 'text-red-400' : 'text-blue-400'}`}>
                            {msg.sender}:
                        </span>
                        <span className="ml-1 text-slate-200">{msg.message}</span>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendChat} className="flex gap-2">
                <Input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="bg-black/60 border-white/20 text-white placeholder:text-white/50 h-8 text-sm backdrop-blur-md"
                />
                <Button type="submit" size="sm" className="h-8 w-8 p-0 bg-white/10 hover:bg-white/20 border border-white/10">
                    <Send className="w-3 h-3" />
                </Button>
            </form>
        </div>
      </div>
    </div>
  );
}