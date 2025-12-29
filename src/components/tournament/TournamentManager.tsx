import React, { useState, useEffect, useCallback } from 'react';
import { Bracket } from './Bracket';
import { GameCanvas } from '@/components/game/GameCanvas';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Play, Clock, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import confetti from 'canvas-confetti';
import { useUserStore } from '@/store/useUserStore';
import { TournamentParticipant, TournamentMatch } from '@shared/types';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { OnlineGameManager } from '@/components/game/OnlineGameManager';
import { toast } from 'sonner';
interface TournamentManagerProps {
  onExit: () => void;
  participants?: TournamentParticipant[];
  startTime: number;
  tournamentName?: string;
  bracket?: TournamentMatch[]; // Server-provided bracket
}
const BOT_NAMES = [
  "RoboKicker", "CircuitBreaker", "BinaryBoot", "PixelStriker",
  "CyberGoalie", "NanoNet", "MechaMessi", "DroidBeckham"
];
export function TournamentManager({ onExit, participants, startTime, tournamentName = "Blitz Cup", bracket: serverBracket }: TournamentManagerProps) {
  const profile = useUserStore(s => s.profile);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [tournamentState, setTournamentState] = useState<'bracket' | 'playing' | 'won' | 'lost'>('bracket');
  const [userTeamName] = useState(profile?.username || "Player");
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isWaiting, setIsWaiting] = useState(false);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  // --- Online Mode Logic ---
  const isOnline = !!serverBracket;
  useEffect(() => {
    if (isOnline && serverBracket) {
      setMatches(serverBracket);
      // Determine current round from bracket state
      const maxRound = Math.max(...serverBracket.map(m => m.round));
      // Find the highest round with a completed match, or 0
      // Actually, we want the lowest round that has pending/scheduled matches
      let activeRound = 0;
      for (let r = 0; r <= maxRound; r++) {
          const roundMatches = serverBracket.filter(m => m.round === r);
          if (roundMatches.some(m => m.status !== 'completed')) {
              activeRound = r;
              break;
          }
      }
      setCurrentRound(activeRound);
      // Check if user is in an active match
      const userMatch = serverBracket.find(m => 
          (m.player1?.userId === profile?.id || m.player2?.userId === profile?.id) &&
          m.status === 'in_progress'
      );
      if (userMatch) {
          setActiveMatchId(userMatch.id);
          setTournamentState('playing');
      } else {
          // Check if user lost
          const userLost = serverBracket.some(m => 
              (m.player1?.userId === profile?.id || m.player2?.userId === profile?.id) &&
              m.status === 'completed' &&
              m.winnerId !== profile?.id
          );
          if (userLost) setTournamentState('lost');
          // Check if user won tournament
          const final = serverBracket.find(m => m.round === maxRound);
          if (final?.status === 'completed' && final.winnerId === profile?.id) {
              setTournamentState('won');
              confetti({ particleCount: 500, spread: 150, origin: { y: 0.6 } });
          }
      }
    }
  }, [serverBracket, isOnline, profile?.id]);
  const handleJoinMatch = async (matchId: string) => {
      if (!profile) return;
      try {
          await api.tournament.joinMatch(matchId, profile.id);
          toast.success("Joined match! Waiting for opponent...");
          // State update will happen via polling in parent or we can force refresh here if we had access
      } catch (e) {
          toast.error("Failed to join match");
      }
  };
  // --- Local Mode Logic (Legacy/Practice) ---
  const generatePlaceholders = useCallback(() => {
     const placeholders: TournamentMatch[] = [];
     for (let i = 0; i < 4; i++) placeholders.push({ id: uuidv4(), round: 0, matchIndex: i, player1: null, player2: null, p1Ready: false, p2Ready: false, status: 'pending' });
     for (let i = 0; i < 2; i++) placeholders.push({ id: uuidv4(), round: 1, matchIndex: i, player1: null, player2: null, p1Ready: false, p2Ready: false, status: 'pending' });
     placeholders.push({ id: uuidv4(), round: 2, matchIndex: 0, player1: null, player2: null, p1Ready: false, p2Ready: false, status: 'pending' });
     return placeholders;
  }, []);
  const generateSeededBracket = useCallback(() => {
    let allPlayers: { name: string; rating: number; id: string }[] = [];
    if (participants && participants.length > 0) {
        allPlayers = participants.map(p => ({ name: p.username, rating: p.rating, id: p.userId }));
    }
    if (!allPlayers.some(p => p.name === userTeamName)) {
        allPlayers.unshift({ name: userTeamName, rating: profile?.stats['1v1'].rating || 1200, id: profile?.id || 'local' });
    }
    const needed = Math.max(0, 8 - allPlayers.length);
    if (needed > 0) {
        const availableBots = BOT_NAMES.filter(b => !allPlayers.some(p => p.name === b));
        const shuffledBots = [...availableBots].sort(() => Math.random() - 0.5).slice(0, needed);
        shuffledBots.forEach((botName, i) => {
            allPlayers.push({ name: botName, rating: Math.floor(Math.random() * 600) + 800, id: `bot-${i}` });
        });
    }
    allPlayers.sort((a, b) => b.rating - a.rating);
    const top8 = allPlayers.slice(0, 8);
    if (!top8.some(p => p.name === userTeamName)) {
        const userIndex = allPlayers.findIndex(p => p.name === userTeamName);
        if (userIndex !== -1) {
            const userEntry = allPlayers[userIndex];
            allPlayers.splice(userIndex, 1);
            allPlayers.splice(7, 0, userEntry);
        }
    }
    const seeds = allPlayers.slice(0, 8).map(p => ({ username: p.name, userId: p.id, country: 'US', rank: 'Bronze', rating: p.rating }));
    const initialMatches: TournamentMatch[] = [
        { id: uuidv4(), round: 0, matchIndex: 0, player1: seeds[0], player2: seeds[7], p1Ready: true, p2Ready: true, status: 'scheduled' },
        { id: uuidv4(), round: 0, matchIndex: 1, player1: seeds[3], player2: seeds[4], p1Ready: true, p2Ready: true, status: 'scheduled' },
        { id: uuidv4(), round: 0, matchIndex: 2, player1: seeds[1], player2: seeds[6], p1Ready: true, p2Ready: true, status: 'scheduled' },
        { id: uuidv4(), round: 0, matchIndex: 3, player1: seeds[2], player2: seeds[5], p1Ready: true, p2Ready: true, status: 'scheduled' },
    ];
    for (let i = 0; i < 2; i++) initialMatches.push({ id: uuidv4(), round: 1, matchIndex: i, player1: null, player2: null, p1Ready: false, p2Ready: false, status: 'pending' });
    initialMatches.push({ id: uuidv4(), round: 2, matchIndex: 0, player1: null, player2: null, p1Ready: false, p2Ready: false, status: 'pending' });
    setMatches(initialMatches);
  }, [participants, profile, userTeamName]);
  useEffect(() => {
    if (isOnline) return; // Skip local generation if online
    if (matches.length > 0) return;
    const now = Date.now();
    if (now < startTime) {
        setIsWaiting(true);
        setMatches(generatePlaceholders());
    } else {
        setIsWaiting(false);
        generateSeededBracket();
    }
  }, [startTime, matches.length, generateSeededBracket, generatePlaceholders, isOnline]);
  // Timer Logic (Visual Only)
  useEffect(() => {
    if (tournamentState !== 'bracket') return;
    const interval = setInterval(() => {
        const now = Date.now();
        if (isWaiting) {
            const diff = Math.max(0, startTime - now);
            setTimeRemaining(diff);
            if (diff <= 0 && !isOnline) {
                setIsWaiting(false);
                generateSeededBracket();
            }
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [tournamentState, isWaiting, startTime, generateSeededBracket, isOnline]);
  const formatTime = (ms: number) => {
      const seconds = Math.ceil(ms / 1000);
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };
  // --- Render ---
  if (tournamentState === 'playing') {
    if (isOnline && activeMatchId) {
        return (
            <OnlineGameManager 
                mode="1v1" 
                onExit={() => {
                    setTournamentState('bracket');
                    setActiveMatchId(null);
                }} 
                matchId={activeMatchId}
            />
        );
    }
    // Local Fallback
    const difficulty = currentRound === 0 ? 'easy' : currentRound === 1 ? 'medium' : 'hard';
    const currentMatch = matches.find(m => m.round === currentRound && (m.player1?.username === userTeamName || m.player2?.username === userTeamName));
    const opponentName = currentMatch ? (currentMatch.player1?.username === userTeamName ? currentMatch.player2?.username : currentMatch.player1?.username) : 'Bot';
    return (
      <div className="space-y-4 animate-fade-in max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setTournamentState('bracket')} className="text-slate-300 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Bracket
          </Button>
          <div className="text-xl font-display font-bold text-white">
            Round {currentRound + 1} vs <span className="text-yellow-400">{opponentName}</span>
          </div>
        </div>
        <div className="border-4 border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <GameCanvas
                onGameEnd={(winner, score) => {
                    // Local logic to advance bracket would go here, but omitted for brevity as Online is focus
                    setTournamentState('bracket');
                }}
                winningScore={3}
                botDifficulty={difficulty}
                playerNames={{ red: userTeamName, blue: opponentName || 'Bot' }}
            />
        </div>
      </div>
    );
  }
  if (tournamentState === 'won') {
    return (
        <div className="flex flex-col items-center justify-center h-[70vh] space-y-8 animate-scale-in text-center">
            <div className="relative">
                <div className="absolute inset-0 bg-yellow-500 blur-[100px] opacity-20 rounded-full animate-pulse" />
                <Trophy className="w-48 h-48 text-yellow-400 drop-shadow-2xl animate-bounce relative z-10" />
            </div>
            <div>
                <h1 className="text-7xl font-display font-bold text-white mb-4 text-glow">CHAMPION!</h1>
                <p className="text-2xl text-slate-300">You have conquered the {tournamentName}!</p>
            </div>
            <div className="flex gap-4">
                <Button onClick={onExit} size="lg" className="h-16 px-12 text-xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 hover:scale-105 transition-transform shadow-xl shadow-orange-500/20">
                    Return to Lobby
                </Button>
            </div>
        </div>
    );
  }
  if (tournamentState === 'lost') {
    return (
        <div className="flex flex-col items-center justify-center h-[70vh] space-y-8 animate-fade-in text-center">
            <div className="text-8xl grayscale opacity-50">💔</div>
            <div>
                <h1 className="text-6xl font-display font-bold text-slate-500 mb-4">Eliminated</h1>
                <p className="text-2xl text-slate-400">Better luck next time!</p>
            </div>
            <Button onClick={onExit} size="lg" variant="outline" className="h-14 px-10 text-lg border-slate-700 text-slate-300 hover:bg-slate-800">
                Return to Lobby
            </Button>
        </div>
    );
  }
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <Button variant="destructive" onClick={onExit} className="bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800">
          <ArrowLeft className="mr-2 h-4 w-4" /> Leave Tournament
        </Button>
        <div className="flex flex-col items-end">
            <h2 className="text-3xl font-display font-bold text-white tracking-wide">{tournamentName}</h2>
            {timeRemaining > 0 && (
                <div className="flex items-center gap-2 text-blue-400 font-mono font-bold animate-pulse bg-blue-900/20 px-3 py-1 rounded-full border border-blue-800/50 mt-2">
                    <Clock className="w-4 h-4" />
                    {isWaiting ? 'Tournament Starts In: ' : 'Next Round: '}{formatTime(timeRemaining)}
                </div>
            )}
        </div>
      </div>
      <div className="bg-slate-950/50 rounded-3xl border border-white/5 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
        <Bracket matches={matches} currentRound={currentRound} onJoinMatch={isOnline ? handleJoinMatch : undefined} />
      </div>
      {!isOnline && (
          <div className="flex justify-center">
            <Button
                size="lg"
                className={cn(
                    "h-20 px-16 text-2xl font-bold rounded-2xl shadow-2xl transition-all duration-300",
                    timeRemaining > 0
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                        : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white hover:scale-105 hover:shadow-emerald-500/25 border-b-4 border-teal-800 active:border-b-0 active:translate-y-1"
                )}
                onClick={() => setTournamentState('playing')}
                disabled={timeRemaining > 0}
            >
                {timeRemaining > 0 ? (
                    <span className="flex items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        {isWaiting ? `Tournament starts in ${formatTime(timeRemaining)}` : `Round ${currentRound + 1} starts in ${formatTime(timeRemaining)}`}
                    </span>
                ) : (
                    <span className="flex items-center gap-3">
                        <Play className="w-8 h-8 fill-current" />
                        PLAY MATCH
                    </span>
                )}
            </Button>
          </div>
      )}
    </div>
  );
}