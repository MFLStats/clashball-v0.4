import React, { useState, useEffect, useCallback } from 'react';
import { Bracket, TournamentMatch } from './Bracket';
import { GameCanvas } from '@/components/game/GameCanvas';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Play, Clock, Crown, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import confetti from 'canvas-confetti';
import { useUserStore } from '@/store/useUserStore';
import { TournamentParticipant } from '@shared/types';
import { cn } from '@/lib/utils';
interface TournamentManagerProps {
  onExit: () => void;
  participants?: TournamentParticipant[];
}
const BOT_NAMES = [
  "RoboKicker", "CircuitBreaker", "BinaryBoot", "PixelStriker",
  "CyberGoalie", "NanoNet", "MechaMessi", "DroidBeckham"
];
export function TournamentManager({ onExit, participants }: TournamentManagerProps) {
  const profile = useUserStore(s => s.profile);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [currentRound, setCurrentRound] = useState(0); // 0, 1, 2
  const [tournamentState, setTournamentState] = useState<'bracket' | 'playing' | 'won' | 'lost'>('bracket');
  const [userTeamName] = useState(profile?.username || "Player");
  // Timer State
  const [roundStartTime, setRoundStartTime] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  // Initialize Tournament with Seeding
  useEffect(() => {
    if (matches.length > 0) return;
    // 1. Prepare Participants List
    let allPlayers: { name: string; rating: number }[] = [];
    if (participants && participants.length > 0) {
        allPlayers = participants.map(p => ({ name: p.username, rating: p.rating }));
    }
    // Ensure current user is in the list
    if (!allPlayers.some(p => p.name === userTeamName)) {
        allPlayers.unshift({ name: userTeamName, rating: profile?.stats['1v1'].rating || 1200 });
    }
    // Fill with bots if needed (ensure at least 8 for a full bracket)
    const needed = Math.max(0, 8 - allPlayers.length);
    if (needed > 0) {
        const availableBots = BOT_NAMES.filter(b => !allPlayers.some(p => p.name === b));
        const shuffledBots = [...availableBots].sort(() => Math.random() - 0.5).slice(0, needed);
        shuffledBots.forEach(botName => {
            allPlayers.push({ name: botName, rating: Math.floor(Math.random() * 600) + 800 });
        });
    }
    // 2. Sort by Rating (Descending)
    allPlayers.sort((a, b) => b.rating - a.rating);
    // 2b. Force User into Top 8 if not present (Seeding Guarantee)
    // We check if the user is within the top 8 seeds. If not, we force them into the 8th seed spot
    // by replacing the player at index 7. This ensures the user always gets to play.
    const top8 = allPlayers.slice(0, 8);
    const userInTop8 = top8.some(p => p.name === userTeamName);
    if (!userInTop8) {
        const userIndex = allPlayers.findIndex(p => p.name === userTeamName);
        if (userIndex !== -1) {
            const userEntry = allPlayers[userIndex];
            // Remove user from their current low-rank position
            allPlayers.splice(userIndex, 1);
            // Insert user at index 7 (8th seed)
            // This bumps the previous 8th seed down to 9th (out of the tournament)
            allPlayers.splice(7, 0, userEntry);
        }
    }
    const seeds = allPlayers.slice(0, 8).map(p => p.name);
    // 3. Create Bracket with Seeding (1v8, 4v5, 2v7, 3v6)
    const initialMatches: TournamentMatch[] = [
        { id: uuidv4(), round: 0, player1: seeds[0], player2: seeds[7], isUserMatch: seeds[0] === userTeamName || seeds[7] === userTeamName }, // 1 vs 8
        { id: uuidv4(), round: 0, player1: seeds[3], player2: seeds[4], isUserMatch: seeds[3] === userTeamName || seeds[4] === userTeamName }, // 4 vs 5
        { id: uuidv4(), round: 0, player1: seeds[1], player2: seeds[6], isUserMatch: seeds[1] === userTeamName || seeds[6] === userTeamName }, // 2 vs 7
        { id: uuidv4(), round: 0, player1: seeds[2], player2: seeds[5], isUserMatch: seeds[2] === userTeamName || seeds[5] === userTeamName }, // 3 vs 6
    ];
    // Round 2 (Semi Finals) placeholders
    for (let i = 0; i < 2; i++) {
        initialMatches.push({ id: uuidv4(), round: 1, player1: '', player2: '' });
    }
    // Round 3 (Final) placeholder
    initialMatches.push({ id: uuidv4(), round: 2, player1: '', player2: '' });
    setMatches(initialMatches);
    setRoundStartTime(Date.now() + 120000); // 2 minutes from now
  }, [userTeamName, matches.length, participants, profile]);
  // Timer Logic
  useEffect(() => {
    if (tournamentState !== 'bracket') return;
    const interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, roundStartTime - now);
        setTimeRemaining(diff);
        if (diff <= 0 && roundStartTime > 0) {
            const userMatch = matches.find(m => m.round === currentRound && m.isUserMatch && !m.winner);
            if (userMatch) {
                startUserMatch();
            }
            setRoundStartTime(0);
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [roundStartTime, tournamentState, matches, currentRound]);
  const simulateRoundMatches = useCallback(() => {
    const roundMatches = matches.filter(m => m.round === currentRound && !m.winner);
    const updatedMatches = [...matches];
    let changed = false;
    roundMatches.forEach(match => {
      if (match.isUserMatch) return; // Skip user match
      const winner = Math.random() > 0.5 ? match.player1 : match.player2;
      const score = {
        p1: winner === match.player1 ? 3 : Math.floor(Math.random() * 3),
        p2: winner === match.player2 ? 3 : Math.floor(Math.random() * 3)
      };
      const matchIndex = updatedMatches.findIndex(m => m.id === match.id);
      updatedMatches[matchIndex] = { ...match, winner, score };
      changed = true;
    });
    if (changed) {
        setMatches(updatedMatches);
    }
  }, [matches, currentRound]);
  const startUserMatch = () => {
    setTournamentState('playing');
  };
  const advanceRound = (currentMatches: TournamentMatch[]) => {
    const nextRound = currentRound + 1;
    const currentRoundMatches = currentMatches.filter(m => m.round === currentRound);
    const nextRoundMatches = currentMatches.filter(m => m.round === nextRound);
    const newMatches = [...currentMatches];
    // Map winners to next round slots
    for (let i = 0; i < nextRoundMatches.length; i++) {
        const m1 = currentRoundMatches[i * 2];
        const m2 = currentRoundMatches[i * 2 + 1];
        if (m1?.winner && m2?.winner) {
            const nextMatchIndex = newMatches.findIndex(m => m.id === nextRoundMatches[i].id);
            newMatches[nextMatchIndex] = {
                ...newMatches[nextMatchIndex],
                player1: m1.winner,
                player2: m2.winner,
                isUserMatch: m1.winner === userTeamName || m2.winner === userTeamName
            };
        }
    }
    setMatches(newMatches);
    setCurrentRound(nextRound);
    setRoundStartTime(Date.now() + 120000);
  };
  const handleUserMatchEnd = (winner: 'red' | 'blue', score: { red: number; blue: number }) => {
    const userMatch = matches.find(m => m.round === currentRound && m.isUserMatch);
    if (!userMatch) return;
    const userWon = winner === 'red';
    const winnerName = userWon ? userTeamName : (userMatch.player1 === userTeamName ? userMatch.player2 : userMatch.player1);
    const updatedMatches = matches.map(m => {
      if (m.id === userMatch.id) {
        return {
          ...m,
          winner: winnerName,
          score: {
            p1: winnerName === m.player1 ? (userWon ? score.red : score.blue) : (userWon ? score.blue : score.red),
            p2: winnerName === m.player2 ? (userWon ? score.red : score.blue) : (userWon ? score.blue : score.red)
          }
        };
      }
      return m;
    });
    setMatches(updatedMatches);
    setTournamentState('bracket');
    if (userWon) {
      if (currentRound === 2) {
        setTournamentState('won');
        confetti({ particleCount: 500, spread: 150, origin: { y: 0.6 } });
      } else {
        advanceRound(updatedMatches);
      }
    } else {
      setTournamentState('lost');
    }
  };
  // Auto-simulate other matches when round starts
  useEffect(() => {
    if (tournamentState === 'bracket' && matches.length > 0) {
        const hasPendingBotMatches = matches.some(m => m.round === currentRound && !m.isUserMatch && !m.winner);
        if (hasPendingBotMatches) {
            simulateRoundMatches();
        }
    }
  }, [currentRound, matches, tournamentState, simulateRoundMatches]);
  const formatTime = (ms: number) => {
      const seconds = Math.ceil(ms / 1000);
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };
  if (tournamentState === 'playing') {
    const difficulty = currentRound === 0 ? 'easy' : currentRound === 1 ? 'medium' : 'hard';
    const currentMatch = matches.find(m => m.round === currentRound && m.isUserMatch);
    const opponentName = currentMatch ? (currentMatch.player1 === userTeamName ? currentMatch.player2 : currentMatch.player1) : 'Bot';
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
                onGameEnd={handleUserMatchEnd}
                winningScore={3}
                botDifficulty={difficulty}
                playerNames={{ red: userTeamName, blue: opponentName }}
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
                <p className="text-2xl text-slate-300">You have conquered the Blitz Cup!</p>
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
            <h2 className="text-3xl font-display font-bold text-white tracking-wide">Blitz Cup</h2>
            {timeRemaining > 0 && (
                <div className="flex items-center gap-2 text-blue-400 font-mono font-bold animate-pulse bg-blue-900/20 px-3 py-1 rounded-full border border-blue-800/50 mt-2">
                    <Clock className="w-4 h-4" />
                    Next Round: {formatTime(timeRemaining)}
                </div>
            )}
        </div>
      </div>
      {/* Bracket Container */}
      <div className="bg-slate-950/50 rounded-3xl border border-white/5 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
        <Bracket matches={matches} currentRound={currentRound} />
      </div>
      <div className="flex justify-center">
        <Button
            size="lg"
            className={cn(
                "h-20 px-16 text-2xl font-bold rounded-2xl shadow-2xl transition-all duration-300",
                timeRemaining > 0
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                    : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white hover:scale-105 hover:shadow-emerald-500/25 border-b-4 border-teal-800 active:border-b-0 active:translate-y-1"
            )}
            onClick={startUserMatch}
            disabled={timeRemaining > 0}
        >
            {timeRemaining > 0 ? (
                <span className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Starting in {formatTime(timeRemaining)}
                </span>
            ) : (
                <span className="flex items-center gap-3">
                    <Play className="w-8 h-8 fill-current" />
                    PLAY MATCH
                </span>
            )}
        </Button>
      </div>
    </div>
  );
}