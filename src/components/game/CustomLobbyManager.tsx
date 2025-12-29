import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameCanvas } from './GameCanvas';
import { GameState } from '@shared/physics';
import { WSMessage, LobbyState, LobbyInfo, LobbySettings, LobbyTeam } from '@shared/types';
import { useUserStore } from '@/store/useUserStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Users, Copy, Play, Send, KeyRound, Crown, RefreshCw, LogIn, Settings, Clock, Trophy, Map as MapIcon, X, Eye, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { SoundEngine } from '@/lib/audio';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { QuickChat } from './QuickChat';
import { GameSocket } from '@/lib/game-socket';
interface CustomLobbyManagerProps {
  onExit: () => void;
  initialCode?: string;
}
interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  team: 'red' | 'blue' | 'spectator';
}
export function CustomLobbyManager({ onExit, initialCode }: CustomLobbyManagerProps) {
  const profile = useUserStore(s => s.profile);
  const [view, setView] = useState<'menu' | 'lobby' | 'game'>('menu');
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [joinCode, setJoinCode] = useState(initialCode || '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);
  const [isLoadingLobbies, setIsLoadingLobbies] = useState(false);
  // Game State
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [matchInfo, setMatchInfo] = useState<{ matchId: string; team: 'red' | 'blue' | 'spectator' } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [winner, setWinner] = useState<'red' | 'blue' | null>(null);
  const socketRef = useRef<GameSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);
  // Poll lobbies
  const fetchLobbies = useCallback(async () => {
    if (view !== 'menu' || !isMountedRef.current) return;
    setIsLoadingLobbies(true);
    try {
      const data = await api.getLobbies();
      if (isMountedRef.current) setLobbies(data);
    } catch (error) {
      console.error('Failed to fetch lobbies', error);
    } finally {
      if (isMountedRef.current) setIsLoadingLobbies(false);
    }
  }, [view]);
  useEffect(() => {
    fetchLobbies();
    const interval = setInterval(fetchLobbies, 5000);
    return () => clearInterval(interval);
  }, [fetchLobbies]);
  // Initialize Socket
  useEffect(() => {
    if (!profile) return;
    const socket = new GameSocket();
    socketRef.current = socket;
    const onLobbyUpdate = (msg: WSMessage) => {
        if (msg.type === 'lobby_update') {
            setLobbyState(msg.state);
            setView('lobby');
            setIsConnecting(false);
        }
    };
    const onMatchStarted = (msg: WSMessage) => {
        if (msg.type === 'match_found' || msg.type === 'match_started') {
            setMatchInfo({ matchId: msg.matchId, team: msg.team });
            setView('game');
            if (msg.team === 'spectator') {
                toast.info('Spectating Match');
            } else {
                toast.success('Match Starting!');
            }
        }
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
        if (msg.type === 'game_over') {
            SoundEngine.playWhistle();
            setWinner(msg.winner);
        }
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
    const onKicked = (msg: WSMessage) => {
        if (msg.type === 'kicked') {
            toast.error('You have been kicked from the lobby.');
            setView('menu');
            setLobbyState(null);
            setIsConnecting(false);
        }
    };
    const onError = (msg: WSMessage) => {
        if (msg.type === 'error') {
            toast.error(msg.message);
            setIsConnecting(false);
        }
    };
    socket.on('lobby_update', onLobbyUpdate);
    socket.on('match_started', onMatchStarted);
    socket.on('match_found', onMatchStarted);
    socket.on('game_state', onGameState);
    socket.on('game_events', onGameEvents);
    socket.on('game_over', onGameOver);
    socket.on('chat', onChat);
    socket.on('kicked', onKicked);
    socket.on('error', onError);
    return () => {
        socket.disconnect();
    };
  }, [profile]);
  const ensureConnection = useCallback(async () => {
      if (!socketRef.current || !profile) return false;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/ws`;
      socketRef.current.connect(wsUrl, profile.id, profile.username);
      return true;
  }, [profile]);
  const createLobby = useCallback(async () => {
    if (!profile) {
        toast.error("You must be logged in to create a lobby");
        return;
    }
    setIsConnecting(true);
    await ensureConnection();
    setTimeout(() => {
        socketRef.current?.send({
            type: 'create_lobby',
            userId: profile.id,
            username: profile.username
        });
    }, 500);
  }, [profile, ensureConnection]);
  const joinLobby = useCallback(async (code?: string) => {
    const targetCode = code || joinCode;
    if (!profile) {
        toast.error("You must be logged in to join a lobby");
        return;
    }
    if (!targetCode) {
        toast.error("Please enter a lobby code");
        return;
    }
    setIsConnecting(true);
    await ensureConnection();
    setTimeout(() => {
        socketRef.current?.send({
            type: 'join_lobby',
            code: targetCode,
            userId: profile.id,
            username: profile.username
        });
    }, 500);
  }, [profile, joinCode, ensureConnection]);
  const startMatch = useCallback(() => {
    socketRef.current?.send({ type: 'start_lobby_match' });
  }, []);
  const updateSettings = useCallback((settings: Partial<LobbySettings>) => {
      socketRef.current?.send({
          type: 'update_lobby_settings',
          settings
      });
  }, []);
  const switchTeam = useCallback((team: LobbyTeam) => {
      socketRef.current?.send({
          type: 'switch_team',
          team
      });
  }, []);
  const kickPlayer = useCallback((targetId: string) => {
      socketRef.current?.send({
          type: 'kick_player',
          targetId
      });
  }, []);
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
  const copyCode = useCallback(() => {
      if (lobbyState?.code) {
          navigator.clipboard.writeText(lobbyState.code);
          toast.success('Lobby code copied!');
      }
  }, [lobbyState?.code]);
  const copyLink = useCallback(() => {
      if (lobbyState?.code) {
          const url = `${window.location.origin}/?lobby=${lobbyState.code}`;
          navigator.clipboard.writeText(url);
          toast.success('Invite link copied!');
      }
  }, [lobbyState?.code]);
  const handleLeaveGame = useCallback(() => {
      setView('lobby');
      setGameState(null);
      setMatchInfo(null);
      setWinner(null);
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
      const redPlayers = lobbyState.players.filter(p => p.team === 'red');
      const bluePlayers = lobbyState.players.filter(p => p.team === 'blue');
      const spectators = lobbyState.players.filter(p => p.team === 'spectator');
      const myTeam = lobbyState.players.find(p => p.id === profile?.id)?.team;
      const maxPerTeam = lobbyState.settings.fieldSize === 'small' ? 2 : lobbyState.settings.fieldSize === 'medium' ? 3 : 4;
      const canStart = redPlayers.length > 0 && bluePlayers.length > 0;
      return (
          <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
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
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800" onClick={copyLink}>
                          <Share2 className="w-4 h-4" />
                      </Button>
                  </div>
                  {isHost && (
                      <Button onClick={startMatch} disabled={!canStart} className="btn-kid-primary px-8">
                          <Play className="w-4 h-4 mr-2" /> Start Match
                      </Button>
                  )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Left Column: Red Team */}
                  <Card className="bg-slate-900 border-red-900/50 shadow-xl overflow-hidden flex flex-col h-[500px]">
                      <CardHeader className="bg-red-950/30 border-b border-red-900/30 py-4">
                          <div className="flex justify-between items-center">
                              <CardTitle className="text-red-400 font-bold uppercase tracking-wider text-sm">Team Red</CardTitle>
                              <span className="text-xs font-mono text-red-500 bg-red-950/50 px-2 py-1 rounded border border-red-900/50">
                                  {redPlayers.length} / {maxPerTeam}
                              </span>
                          </div>
                          <Button
                              size="sm"
                              className="w-full mt-2 bg-red-600 hover:bg-red-500 text-white border border-red-400/20"
                              disabled={myTeam === 'red' || redPlayers.length >= maxPerTeam}
                              onClick={() => switchTeam('red')}
                          >
                              Join Red
                          </Button>
                      </CardHeader>
                      <CardContent className="p-4 flex-1 overflow-y-auto space-y-2">
                          {redPlayers.map(p => (
                              <div key={p.id} className="flex items-center gap-3 p-3 bg-red-950/20 rounded-lg border border-red-900/20">
                                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center font-bold text-red-400 text-xs border border-red-500/30">
                                      {p.username.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="font-bold text-red-100 truncate">{p.username}</div>
                                      {p.id === lobbyState.hostId && (
                                          <div className="text-[10px] font-bold text-yellow-500 flex items-center gap-1">
                                              <Crown className="w-3 h-3" /> HOST
                                          </div>
                                      )}
                                  </div>
                                  {isHost && p.id !== profile?.id && (
                                      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:bg-red-900/50" onClick={() => kickPlayer(p.id)}>
                                          <X className="w-3 h-3" />
                                      </Button>
                                  )}
                              </div>
                          ))}
                      </CardContent>
                  </Card>
                  {/* Middle Column: Spectators & Chat */}
                  <div className="lg:col-span-2 flex flex-col gap-6 h-[500px]">
                      {/* Spectators */}
                      <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden flex-1">
                          <CardHeader className="bg-slate-950/50 border-b border-slate-800 py-4">
                              <div className="flex justify-between items-center">
                                  <CardTitle className="text-slate-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                                      <Eye className="w-4 h-4" /> Spectators
                                  </CardTitle>
                                  <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                                      {spectators.length}
                                  </span>
                              </div>
                              <Button
                                  size="sm"
                                  variant="secondary"
                                  className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                                  disabled={myTeam === 'spectator'}
                                  onClick={() => switchTeam('spectator')}
                              >
                                  Spectate
                              </Button>
                          </CardHeader>
                          <CardContent className="p-4 overflow-y-auto h-[150px]">
                              <div className="flex flex-wrap gap-2">
                                  {spectators.map(p => (
                                      <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-full border border-slate-700/50">
                                          <span className="text-xs font-bold text-slate-300">{p.username}</span>
                                          {isHost && p.id !== profile?.id && (
                                              <button onClick={() => kickPlayer(p.id)} className="text-slate-500 hover:text-red-400">
                                                  <X className="w-3 h-3" />
                                              </button>
                                          )}
                                      </div>
                                  ))}
                                  {spectators.length === 0 && (
                                      <div className="w-full text-center text-slate-600 italic text-xs py-4">No spectators</div>
                                  )}
                              </div>
                          </CardContent>
                      </Card>
                      {/* Chat */}
                      <Card className="bg-slate-900 border-slate-800 shadow-xl flex flex-col flex-1 min-h-0">
                          <CardHeader className="bg-slate-950/50 border-b border-slate-800 py-2">
                              <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lobby Chat</CardTitle>
                          </CardHeader>
                          <CardContent className="flex-1 p-3 flex flex-col gap-2 overflow-hidden">
                              <div className="flex-1 overflow-y-auto space-y-1 pr-2 scrollbar-hide">
                                  {chatMessages.map(msg => (
                                      <div key={msg.id} className="text-xs">
                                          <span className={cn(
                                              "font-bold mr-2",
                                              msg.team === 'red' ? 'text-red-400' :
                                              msg.team === 'blue' ? 'text-blue-400' : 'text-slate-400'
                                          )}>
                                              {msg.sender}:
                                          </span>
                                          <span className="text-slate-300">{msg.message}</span>
                                      </div>
                                  ))}
                                  <div ref={chatEndRef} />
                              </div>
                              <form onSubmit={sendChat} className="flex gap-2">
                                  <Input
                                      value={chatInput}
                                      onChange={e => setChatInput(e.target.value)}
                                      placeholder="Message..."
                                      className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 h-8 text-xs"
                                  />
                                  <Button type="submit" size="icon" className="h-8 w-8 bg-slate-800 hover:bg-slate-700">
                                      <Send className="w-3 h-3" />
                                  </Button>
                              </form>
                          </CardContent>
                      </Card>
                  </div>
                  {/* Right Column: Blue Team */}
                  <Card className="bg-slate-900 border-blue-900/50 shadow-xl overflow-hidden flex flex-col h-[500px]">
                      <CardHeader className="bg-blue-950/30 border-b border-blue-900/30 py-4">
                          <div className="flex justify-between items-center">
                              <CardTitle className="text-blue-400 font-bold uppercase tracking-wider text-sm">Team Blue</CardTitle>
                              <span className="text-xs font-mono text-blue-500 bg-blue-950/50 px-2 py-1 rounded border border-blue-900/50">
                                  {bluePlayers.length} / {maxPerTeam}
                              </span>
                          </div>
                          <Button
                              size="sm"
                              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/20"
                              disabled={myTeam === 'blue' || bluePlayers.length >= maxPerTeam}
                              onClick={() => switchTeam('blue')}
                          >
                              Join Blue
                          </Button>
                      </CardHeader>
                      <CardContent className="p-4 flex-1 overflow-y-auto space-y-2">
                          {bluePlayers.map(p => (
                              <div key={p.id} className="flex items-center gap-3 p-3 bg-blue-950/20 rounded-lg border border-blue-900/20">
                                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center font-bold text-blue-400 text-xs border border-blue-500/30">
                                      {p.username.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="font-bold text-blue-100 truncate">{p.username}</div>
                                      {p.id === lobbyState.hostId && (
                                          <div className="text-[10px] font-bold text-yellow-500 flex items-center gap-1">
                                              <Crown className="w-3 h-3" /> HOST
                                          </div>
                                      )}
                                  </div>
                                  {isHost && p.id !== profile?.id && (
                                      <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-400 hover:bg-blue-900/50" onClick={() => kickPlayer(p.id)}>
                                          <X className="w-3 h-3" />
                                      </Button>
                                  )}
                              </div>
                          ))}
                      </CardContent>
                  </Card>
              </div>
              {/* Settings Panel (Bottom) */}
              <Card className="bg-slate-900 border-slate-800 shadow-xl mt-6">
                  <CardHeader className="bg-slate-950/50 border-b border-slate-800 py-3">
                      <CardTitle className="flex items-center gap-2 text-white text-sm">
                          <Settings className="w-4 h-4 text-slate-400" />
                          Match Settings
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {/* Score Limit */}
                          <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                                      <Trophy className="w-4 h-4 text-yellow-500" />
                                      Score Limit
                                  </div>
                                  <span className="font-mono text-primary font-bold text-sm">
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
                                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                      <div
                                          className="h-full bg-slate-600"
                                          style={{ width: `${(lobbyState.settings.scoreLimit / 10) * 100}%` }}
                                      />
                                  </div>
                              )}
                          </div>
                          {/* Time Limit */}
                          <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                                      <Clock className="w-4 h-4 text-blue-500" />
                                      Time Limit
                                  </div>
                                  <span className="font-mono text-primary font-bold text-sm">
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
                                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                      <div
                                          className="h-full bg-slate-600"
                                          style={{ width: `${(lobbyState.settings.timeLimit / 600) * 100}%` }}
                                      />
                                  </div>
                              )}
                          </div>
                          {/* Field Size */}
                          <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                                      <MapIcon className="w-4 h-4 text-emerald-500" />
                                      Field Size
                                  </div>
                                  <span className="font-mono text-primary font-bold uppercase text-sm">
                                      {lobbyState.settings.fieldSize || 'Medium'}
                                  </span>
                              </div>
                              {isHost ? (
                                  <Tabs
                                      value={lobbyState.settings.fieldSize || 'medium'}
                                      onValueChange={(val) => updateSettings({ fieldSize: val as any })}
                                      className="w-full"
                                  >
                                      <TabsList className="grid w-full grid-cols-3 bg-slate-950 border border-slate-800 h-8">
                                          <TabsTrigger value="small" className="text-[10px] font-bold h-6">Small</TabsTrigger>
                                          <TabsTrigger value="medium" className="text-[10px] font-bold h-6">Medium</TabsTrigger>
                                          <TabsTrigger value="large" className="text-[10px] font-bold h-6">Large</TabsTrigger>
                                      </TabsList>
                                  </Tabs>
                              ) : (
                                  <div className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center text-xs font-bold text-slate-400 uppercase">
                                      {lobbyState.settings.fieldSize || 'Medium'}
                                  </div>
                              )}
                          </div>
                      </div>
                  </CardContent>
              </Card>
          </div>
      );
  }
  // Game View
  return (
    <div className="flex flex-col gap-4 animate-fade-in max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setView('lobby')} className="text-slate-300 hover:bg-white/10">
          <ArrowLeft className="mr-2 h-4 w-4" /> Return to Lobby
        </Button>
        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-400">YOU ARE</span>
            <span className={cn(
                "px-3 py-1 rounded-full text-white font-bold text-sm shadow-lg",
                matchInfo?.team === 'red' ? 'bg-red-500 shadow-red-500/20' :
                matchInfo?.team === 'blue' ? 'bg-blue-500 shadow-blue-500/20' :
                'bg-slate-700 shadow-slate-500/20'
            )}>
                {matchInfo?.team === 'spectator' ? 'SPECTATING' : `TEAM ${matchInfo?.team.toUpperCase()}`}
            </span>
        </div>
      </div>
      <div className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-800">
        <GameCanvas
            externalState={gameState}
            externalWinner={winner}
            onInput={matchInfo?.team === 'spectator' ? undefined : handleInput}
            winningScore={lobbyState?.settings.scoreLimit ?? 3}
            currentUserId={profile?.id}
            onLeave={handleLeaveGame}
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