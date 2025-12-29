import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameCanvas } from './GameCanvas';
import { GameState } from '@shared/physics';
import { WSMessage, LobbyState, LobbyInfo, LobbySettings } from '@shared/types';
import { useUserStore } from '@/store/useUserStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Users, Copy, Play, Send, KeyRound, Crown, RefreshCw, LogIn, Settings, Clock, Trophy, Map as MapIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { SoundEngine } from '@/lib/audio';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
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
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);
  const [isLoadingLobbies, setIsLoadingLobbies] = useState(false);
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
  // Poll lobbies
  const fetchLobbies = useCallback(async () => {
    if (view !== 'menu') return;
    setIsLoadingLobbies(true);
    try {
      const data = await api.getLobbies();
      setLobbies(data);
    } catch (error) {
      console.error('Failed to fetch lobbies', error);
    } finally {
      setIsLoadingLobbies(false);
    }
  }, [view]);
  useEffect(() => {
    fetchLobbies();
    const interval = setInterval(fetchLobbies, 5000);
    return () => clearInterval(interval);
  }, [fetchLobbies]);
  // Use a ref for handleMessage to ensure it always has access to the latest state/props if needed,
  // although for this component most state is local.
  // We wrap it in useRef to keep the function identity stable for the websocket event listener.
  const handleMessageRef = useRef<(msg: WSMessage) => void>(() => {});
  useEffect(() => {
    handleMessageRef.current = (msg: WSMessage) => {
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
                toast('Game Over', {
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
            case 'kicked': {
                toast.error('You have been kicked from the lobby.');
                setView('menu');
                setLobbyState(null);
                setIsConnecting(false);
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
    };
  }, []); // Empty dependency array means this ref updater runs once, but the function inside closes over nothing critical that isn't state setter.
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return wsRef.current;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/api/ws`);
    wsRef.current = ws;
    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data) as WSMessage;
            handleMessageRef.current(msg);
        } catch (e) {
            console.error('Failed to parse WS message', e);
        }
    };
    ws.onerror = () => {
        toast.error('Connection error');
        setIsConnecting(false);
    };
    return ws;
  }, []);
  const createLobby = () => {
    if (!profile) return;
    setIsConnecting(true);
    const ws = connectWS();
    if (ws) {
        const sendCreate = () => {
            ws.send(JSON.stringify({
                type: 'create_lobby',
                userId: profile.id,
                username: profile.username
            }));
        };
        if (ws.readyState === WebSocket.OPEN) sendCreate();
        else ws.onopen = sendCreate;
    }
  };
  const joinLobby = (code?: string) => {
    const targetCode = code || joinCode;
    if (!profile || !targetCode) return;
    setIsConnecting(true);
    const ws = connectWS();
    if (ws) {
        const sendJoin = () => {
            ws.send(JSON.stringify({
                type: 'join_lobby',
                code: targetCode,
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
  const updateSettings = (settings: Partial<LobbySettings>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
              type: 'update_lobby_settings',
              settings
          }));
      }
  };
  const kickPlayer = (targetId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
              type: 'kick_player',
              targetId
          }));
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
        <div className="flex flex-col items-center min-h-[60vh] space-y-8 animate-fade-in w-full">
            <div className="flex items-center justify-between w-full max-w-4xl">
                <Button variant="ghost" onClick={onExit} className="text-slate-300 hover:bg-white/10">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <h2 className="text-2xl font-display font-bold text-white">Custom Lobby</h2>
                <div className="w-20" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                {/* Create */}
                <button
                    onClick={createLobby}
                    disabled={isConnecting}
                    className="group relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-8 text-left transition-all hover:border-primary/50 hover:shadow-lg hover:scale-[1.02]"
                >
                    <div className="absolute right-0 top-0 p-6 opacity-10 transition-transform group-hover:scale-110 group-hover:opacity-20">
                        <Users className="h-32 w-32 text-white" />
                    </div>
                    <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                        <div className="p-4 bg-blue-500/10 rounded-full text-blue-400 border border-blue-500/20">
                            <Users className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white">Create Lobby</h3>
                            <p className="text-slate-400 mt-2">Host a private match and invite friends with a code.</p>
                        </div>
                        {isConnecting ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : null}
                    </div>
                </button>
                {/* Join */}
                <div className="group relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-8 text-left transition-all hover:border-emerald-500/50 hover:shadow-lg">
                    <div className="absolute right-0 top-0 p-6 opacity-10 transition-transform group-hover:scale-110 group-hover:opacity-20">
                        <KeyRound className="h-32 w-32 text-white" />
                    </div>
                    <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                        <div className="p-4 bg-emerald-500/10 rounded-full text-emerald-400 border border-emerald-500/20">
                            <KeyRound className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white">Join Lobby</h3>
                            <p className="text-slate-400 mt-2">Enter a code to join an existing lobby.</p>
                        </div>
                        <div className="flex gap-2 w-full max-w-xs mt-4">
                            <Input
                                placeholder="ENTER CODE"
                                className="text-center uppercase font-mono font-bold tracking-widest bg-slate-950/50 border-slate-700 text-white h-12"
                                value={joinCode}
                                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                maxLength={6}
                            />
                            <Button onClick={() => joinLobby()} disabled={isConnecting || joinCode.length !== 6} className="btn-kid-primary h-12 px-6">
                                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            {/* Public Lobbies List */}
            <div className="w-full max-w-4xl space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-400" />
                        Public Lobbies
                    </h3>
                    <Button variant="ghost" size="sm" onClick={fetchLobbies} disabled={isLoadingLobbies} className="text-slate-400 hover:text-white">
                        <RefreshCw className={cn("w-4 h-4 mr-2", isLoadingLobbies && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                    {lobbies.length === 0 ? (
                        <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 text-slate-500">
                            No public lobbies found. Create one to start playing!
                        </div>
                    ) : (
                        lobbies.map((lobby) => (
                            <div key={lobby.code} className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-purple-500/30 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold border border-purple-500/20">
                                        {lobby.hostName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white flex items-center gap-2">
                                            {lobby.hostName}'s Lobby
                                            <span className="text-xs font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                                                {lobby.code}
                                            </span>
                                        </div>
                                        <div className="text-sm text-slate-400">
                                            Waiting for players...
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-slate-300">
                                            {lobby.playerCount} / {lobby.maxPlayers}
                                        </div>
                                        <div className="text-xs text-slate-500 uppercase font-bold">Players</div>
                                    </div>
                                    <Button
                                        onClick={() => joinLobby(lobby.code)}
                                        disabled={isConnecting || lobby.playerCount >= lobby.maxPlayers}
                                        className="bg-purple-600 hover:bg-purple-500 text-white"
                                    >
                                        <LogIn className="w-4 h-4 mr-2" /> Join
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      );
  }
  if (view === 'lobby' && lobbyState) {
      const isHost = lobbyState.hostId === profile?.id;
      return (
          <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={onExit} className="text-slate-300 hover:bg-white/10">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Leave Lobby
                  </Button>
                  <div className="flex items-center gap-3 bg-slate-900 px-6 py-3 rounded-xl border border-slate-800 shadow-lg">
                      <span className="text-slate-400 font-bold text-sm uppercase tracking-wider">Lobby Code</span>
                      <div className="h-4 w-px bg-slate-700" />
                      <span className="font-mono font-bold text-2xl text-white tracking-widest">{lobbyState.code}</span>
                      <Button size="icon" variant="ghost" className="h-8 w-8 ml-2 text-slate-400 hover:text-white hover:bg-slate-800" onClick={copyCode}>
                          <Copy className="w-4 h-4" />
                      </Button>
                  </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Players & Chat */}
                  <div className="lg:col-span-2 space-y-6">
                      {/* Players List */}
                      <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
                          <CardHeader className="bg-slate-950/50 border-b border-slate-800">
                              <CardTitle className="flex justify-between items-center text-white">
                                  <div className="flex items-center gap-2">
                                      <Users className="w-5 h-5 text-primary" />
                                      <span>Players ({lobbyState.players.length}/8)</span>
                                  </div>
                                  {isHost && (
                                      <Button onClick={startMatch} disabled={lobbyState.players.length < 2} className="btn-kid-primary">
                                          <Play className="w-4 h-4 mr-2" /> Start Match
                                      </Button>
                                  )}
                              </CardTitle>
                          </CardHeader>
                          <CardContent className="p-6">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {lobbyState.players.map(p => (
                                      <div key={p.id} className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 transition-all hover:bg-slate-800/50 group">
                                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center font-bold text-white shadow-inner">
                                              {p.username.charAt(0).toUpperCase()}
                                          </div>
                                          <div className="flex-1">
                                              <div className="font-bold text-slate-200">{p.username}</div>
                                              {p.id === lobbyState.hostId && (
                                                  <div className="text-xs font-bold text-yellow-500 flex items-center gap-1 mt-0.5">
                                                      <Crown className="w-3 h-3" /> HOST
                                                  </div>
                                              )}
                                          </div>
                                          {isHost && p.id !== profile?.id && (
                                              <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                  onClick={() => kickPlayer(p.id)}
                                                  title="Kick Player"
                                              >
                                                  <X className="w-4 h-4" />
                                              </Button>
                                          )}
                                      </div>
                                  ))}
                                  {Array.from({ length: Math.max(0, 8 - lobbyState.players.length) }).map((_, i) => (
                                      <div key={`empty-${i}`} className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-800 rounded-xl opacity-40">
                                          <div className="w-10 h-10 rounded-full bg-slate-800" />
                                          <span className="text-slate-500 font-medium italic">Waiting for player...</span>
                                      </div>
                                  ))}
                              </div>
                          </CardContent>
                      </Card>
                      {/* Lobby Chat */}
                      <Card className="bg-slate-900 border-slate-800 shadow-xl flex flex-col h-[300px]">
                          <CardHeader className="bg-slate-950/50 border-b border-slate-800 py-3">
                              <CardTitle className="text-sm font-bold text-slate-400 uppercase tracking-wider">Lobby Chat</CardTitle>
                          </CardHeader>
                          <CardContent className="flex-1 p-4 flex flex-col gap-2 overflow-hidden">
                              <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                                  {chatMessages.length === 0 && (
                                      <div className="text-center text-slate-600 italic text-sm mt-10">No messages yet. Say hello!</div>
                                  )}
                                  {chatMessages.map(msg => (
                                      <div key={msg.id} className="text-sm">
                                          <span className="font-bold text-slate-300 mr-2">{msg.sender}:</span>
                                          <span className="text-slate-400">{msg.message}</span>
                                      </div>
                                  ))}
                                  <div ref={chatEndRef} />
                              </div>
                              <form onSubmit={sendChat} className="flex gap-2 mt-2">
                                  <Input
                                      value={chatInput}
                                      onChange={e => setChatInput(e.target.value)}
                                      placeholder="Type a message..."
                                      className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600"
                                  />
                                  <Button type="submit" size="icon" className="bg-slate-800 hover:bg-slate-700">
                                      <Send className="w-4 h-4" />
                                  </Button>
                              </form>
                          </CardContent>
                      </Card>
                  </div>
                  {/* Right Column: Settings */}
                  <div className="space-y-6">
                      <Card className="bg-slate-900 border-slate-800 shadow-xl">
                          <CardHeader className="bg-slate-950/50 border-b border-slate-800">
                              <CardTitle className="flex items-center gap-2 text-white">
                                  <Settings className="w-5 h-5 text-slate-400" />
                                  Match Settings
                              </CardTitle>
                          </CardHeader>
                          <CardContent className="p-6 space-y-8">
                              {/* Score Limit */}
                              <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-white font-bold">
                                          <Trophy className="w-4 h-4 text-yellow-500" />
                                          Score Limit
                                      </div>
                                      <span className="font-mono text-primary font-bold">
                                          {lobbyState.settings.scoreLimit === 0 ? 'Unlimited' : lobbyState.settings.scoreLimit}
                                      </span>
                                  </div>
                                  {isHost ? (
                                      <Slider
                                          value={[lobbyState.settings.scoreLimit]}
                                          min={0}
                                          max={10}
                                          step={1}
                                          onValueChange={(vals) => updateSettings({ scoreLimit: vals[0] })}
                                          className="py-2"
                                      />
                                  ) : (
                                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                          <div
                                              className="h-full bg-slate-600"
                                              style={{ width: `${(lobbyState.settings.scoreLimit / 10) * 100}%` }}
                                          />
                                      </div>
                                  )}
                                  <p className="text-xs text-slate-500">
                                      Goals required to win. Set to 0 for unlimited.
                                  </p>
                              </div>
                              {/* Time Limit */}
                              <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-white font-bold">
                                          <Clock className="w-4 h-4 text-blue-500" />
                                          Time Limit
                                      </div>
                                      <span className="font-mono text-primary font-bold">
                                          {lobbyState.settings.timeLimit === 0 ? 'Unlimited' : `${Math.floor(lobbyState.settings.timeLimit / 60)}m`}
                                      </span>
                                  </div>
                                  {isHost ? (
                                      <Slider
                                          value={[lobbyState.settings.timeLimit]}
                                          min={0}
                                          max={600}
                                          step={60}
                                          onValueChange={(vals) => updateSettings({ timeLimit: vals[0] })}
                                          className="py-2"
                                      />
                                  ) : (
                                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                          <div
                                              className="h-full bg-slate-600"
                                              style={{ width: `${(lobbyState.settings.timeLimit / 600) * 100}%` }}
                                          />
                                      </div>
                                  )}
                                  <p className="text-xs text-slate-500">
                                      Match duration in minutes. Set to 0 for unlimited.
                                  </p>
                              </div>
                              {/* Field Size */}
                              <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-white font-bold">
                                          <MapIcon className="w-4 h-4 text-emerald-500" />
                                          Field Size
                                      </div>
                                      <span className="font-mono text-primary font-bold uppercase">
                                          {lobbyState.settings.fieldSize || 'Medium'}
                                      </span>
                                  </div>
                                  {isHost ? (
                                      <Tabs
                                          value={lobbyState.settings.fieldSize || 'medium'}
                                          onValueChange={(val) => updateSettings({ fieldSize: val as any })}
                                          className="w-full"
                                      >
                                          <TabsList className="grid w-full grid-cols-3 bg-slate-950 border border-slate-800">
                                              <TabsTrigger value="small" className="text-xs font-bold">Small</TabsTrigger>
                                              <TabsTrigger value="medium" className="text-xs font-bold">Medium</TabsTrigger>
                                              <TabsTrigger value="large" className="text-xs font-bold">Large</TabsTrigger>
                                          </TabsList>
                                      </Tabs>
                                  ) : (
                                      <div className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-center text-sm font-bold text-slate-400 uppercase">
                                          {lobbyState.settings.fieldSize || 'Medium'}
                                      </div>
                                  )}
                                  <p className="text-xs text-slate-500">
                                      Adjust map dimensions for player count.
                                  </p>
                              </div>
                          </CardContent>
                      </Card>
                  </div>
              </div>
              {!isHost && (
                  <div className="flex items-center justify-center gap-3 text-slate-400 animate-pulse py-8">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Waiting for host to start the match...</span>
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
            <span className={cn(
                "px-3 py-1 rounded-full text-white font-bold text-sm shadow-lg",
                matchInfo?.team === 'red' ? 'bg-red-500 shadow-red-500/20' : 'bg-blue-500 shadow-blue-500/20'
            )}>
                TEAM {matchInfo?.team.toUpperCase()}
            </span>
        </div>
      </div>
      <div className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-800">
        <GameCanvas
            externalState={gameState}
            onInput={handleInput}
            winningScore={lobbyState?.settings.scoreLimit ?? 3}
            currentUserId={profile?.id}
        />
        {/* Chat Overlay */}
        <div className="absolute bottom-4 left-4 w-80 max-h-64 flex flex-col gap-2 z-20">
            <div className="flex-1 overflow-y-auto bg-black/60 backdrop-blur-md rounded-lg p-3 space-y-2 scrollbar-hide border border-white/10 shadow-xl">
                {chatMessages.map(msg => (
                    <div key={msg.id} className="text-sm text-white drop-shadow-md">
                        <span className={cn("font-bold mr-2", msg.team === 'red' ? 'text-red-400' : 'text-blue-400')}>
                            {msg.sender}:
                        </span>
                        <span className="text-slate-200">{msg.message}</span>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendChat} className="flex gap-2">
                <Input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="bg-black/60 border-white/20 text-white placeholder:text-white/50 h-9 text-sm backdrop-blur-md focus:bg-black/80 transition-colors"
                />
                <Button type="submit" size="sm" className="h-9 w-9 p-0 bg-white/10 hover:bg-white/20 border border-white/10">
                    <Send className="w-4 h-4" />
                </Button>
            </form>
        </div>
      </div>
    </div>
  );
}