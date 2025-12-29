import React, { useState, useEffect, useCallback } from 'react';
import { Bracket, TournamentMatch } from './Bracket';
import { GameCanvas } from '@/components/game/GameCanvas';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Play } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import confetti from 'canvas-confetti';
import { useUserStore } from '@/store/useUserStore';
interface TournamentManagerProps {
  onExit: () => void;
}
const BOT_NAMES = [
  "RoboKicker", "CircuitBreaker", "BinaryBoot", "PixelStriker", 
  "CyberGoalie", "NanoNet", "MechaMessi", "DroidBeckham"
];
export function TournamentManager({ onExit }: TournamentManagerProps) {
  const profile = useUserStore(s => s.profile);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [currentRound, setCurrentRound] = useState(0); // 0, 1, 2
  const [tournamentState, setTournamentState] = useState<'bracket' | 'playing' | 'won' | 'lost'>('bracket');
  const [userTeamName] = useState(profile?.username || "Player");
  // Initialize Tournament
  useEffect(() => {
    if (matches.length > 0) return;
    // Shuffle bots
    const bots = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    // Replace one bot with User
    bots[0] = userTeamName;
    const initialMatches: TournamentMatch[] = [];
    // Round 1 (Quarter Finals) - 4 matches
    for (let i = 0; i < 4; i++) {
      initialMatches.push({
        id: uuidv4(),
        round: 0,
        player1: bots[i * 2],
        player2: bots[i * 2 + 1],
        isUserMatch: bots[i * 2] === userTeamName || bots[i * 2 + 1] === userTeamName
      });
    }
    // Round 2 (Semi Finals) - 2 matches (placeholders)
    for (let i = 0; i < 2; i++) {
        initialMatches.push({
            id: uuidv4(),
            round: 1,
            player1: 'TBD',
            player2: 'TBD',
        });
    }
    // Round 3 (Final) - 1 match (placeholder)
    initialMatches.push({
        id: uuidv4(),
        round: 2,
        player1: 'TBD',
        player2: 'TBD',
    });
    setMatches(initialMatches);
  }, [userTeamName, matches.length]);
  const simulateRoundMatches = useCallback(() => {
    const roundMatches = matches.filter(m => m.round === currentRound && !m.winner);
    const updatedMatches = [...matches];
    let changed = false;
    roundMatches.forEach(match => {
      if (match.isUserMatch) return; // Skip user match
      // Simulate random winner
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
    // Logic to propagate winners to next round
    // This is simplified; assumes matches are ordered 0,1 -> next 0; 2,3 -> next 1
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
  };
  const handleUserMatchEnd = (winner: 'red' | 'blue') => {
    const userMatch = matches.find(m => m.round === currentRound && m.isUserMatch);
    if (!userMatch) return;
    const userIsP1 = userMatch.player1 === userTeamName;
    const userWon = (userIsP1 && winner === 'red') || (!userIsP1 && winner === 'blue');
    const winnerName = userWon ? userTeamName : (userIsP1 ? userMatch.player2 : userMatch.player1);
    const updatedMatches = matches.map(m => {
      if (m.id === userMatch.id) {
        return {
          ...m,
          winner: winnerName,
          score: {
            p1: winner === 'red' ? 3 : Math.floor(Math.random() * 3),
            p2: winner === 'blue' ? 3 : Math.floor(Math.random() * 3)
          }
        };
      }
      return m;
    });
    setMatches(updatedMatches);
    setTournamentState('bracket');
    if (userWon) {
      if (currentRound === 2) {
        // Tournament Won!
        setTournamentState('won');
        confetti({ particleCount: 500, spread: 150, origin: { y: 0.6 } });
      } else {
        // Advance to next round
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
  if (tournamentState === 'playing') {
    const difficulty = currentRound === 0 ? 'easy' : currentRound === 1 ? 'medium' : 'hard';
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setTournamentState('bracket')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Bracket
          </Button>
          <div className="text-xl font-display font-bold text-slate-800">
            Round {currentRound + 1} vs Bot ({difficulty.toUpperCase()})
          </div>
        </div>
        <GameCanvas 
            onGameEnd={handleUserMatchEnd} 
            winningScore={3} 
            botDifficulty={difficulty}
        />
      </div>
    );
  }
  if (tournamentState === 'won') {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-8 animate-scale-in">
            <Trophy className="w-32 h-32 text-yellow-500 drop-shadow-lg animate-bounce" />
            <h1 className="text-5xl font-display font-bold text-slate-800">CHAMPION!</h1>
            <p className="text-xl text-slate-500">You have conquered the KickStar Cup!</p>
            <div className="flex gap-4">
                <Button onClick={onExit} size="lg" className="btn-kid-primary">
                    Return to Lobby
                </Button>
            </div>
        </div>
    );
  }
  if (tournamentState === 'lost') {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-8 animate-fade-in">
            <div className="text-6xl">💔</div>
            <h1 className="text-4xl font-display font-bold text-slate-800">Eliminated</h1>
            <p className="text-xl text-slate-500">Better luck next time!</p>
            <Button onClick={onExit} size="lg" className="btn-kid-secondary">
                Return to Lobby
            </Button>
        </div>
    );
  }
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onExit}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Exit Tournament
        </Button>
        <h2 className="text-2xl font-display font-bold text-slate-800">KickStar Cup</h2>
        <div className="w-24" />
      </div>
      <div className="bg-slate-50 rounded-3xl p-8 border-4 border-slate-100 shadow-inner overflow-hidden">
        <Bracket matches={matches} currentRound={currentRound} />
      </div>
      <div className="flex justify-center">
        <Button 
            size="lg" 
            className="btn-kid-primary text-xl px-12 py-6 h-auto"
            onClick={startUserMatch}
        >
            <Play className="mr-2 w-6 h-6 fill-current" />
            Play Next Match
        </Button>
      </div>
    </div>
  );
}