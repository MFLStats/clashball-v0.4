import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Trophy } from 'lucide-react';
export interface TournamentMatch {
  id: string;
  round: number; // 0 = Quarter, 1 = Semi, 2 = Final
  player1: string;
  player2: string;
  winner?: string;
  score?: { p1: number; p2: number };
  isUserMatch?: boolean;
}
interface BracketProps {
  matches: TournamentMatch[];
  currentRound: number;
}
export function Bracket({ matches, currentRound }: BracketProps) {
  // Group matches by round
  const rounds = [0, 1, 2];
  const roundNames = ['Quarter Finals', 'Semi Finals', 'Grand Final'];
  return (
    <div className="w-full overflow-x-auto p-4">
      <div className="min-w-[800px] flex justify-between gap-8">
        {rounds.map((roundIndex) => {
          const roundMatches = matches.filter(m => m.round === roundIndex);
          return (
            <div key={roundIndex} className="flex-1 flex flex-col justify-around relative">
              <h3 className="text-center font-display font-bold text-slate-500 mb-4 uppercase tracking-wider text-sm">
                {roundNames[roundIndex]}
              </h3>
              <div className="flex flex-col justify-around h-full gap-8">
                {roundMatches.map((match, idx) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    isActive={currentRound === roundIndex && !match.winner}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {/* Winner Column */}
        <div className="flex flex-col justify-center items-center w-32">
            <div className="p-4 bg-yellow-100 rounded-full border-4 border-yellow-300 shadow-lg">
                <Trophy className="w-8 h-8 text-yellow-600" />
            </div>
            <span className="mt-2 font-bold text-slate-400 text-sm">CHAMPION</span>
        </div>
      </div>
    </div>
  );
}
function MatchCard({ match, isActive }: { match: TournamentMatch; isActive: boolean }) {
  const isCompleted = !!match.winner;
  const renderPlayerName = (name: string) => {
    if (!name) {
      return <span className="text-slate-400 italic text-xs">TBD</span>;
    }
    return <span className="truncate text-sm">{name}</span>;
  };
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative flex flex-col bg-white rounded-xl border-2 shadow-sm overflow-hidden w-full max-w-[200px] mx-auto transition-all",
        isActive ? "border-blue-400 ring-4 ring-blue-100 scale-105 z-10" : "border-slate-200",
        match.isUserMatch && "border-l-4 border-l-blue-500"
      )}
    >
      {/* Player 1 */}
      <div className={cn(
        "flex justify-between items-center px-3 py-2 border-b border-slate-100",
        match.winner === match.player1 && "bg-green-50 font-bold text-green-700",
        match.winner && match.winner !== match.player1 && "text-slate-400"
      )}>
        {renderPlayerName(match.player1)}
        {match.score && <span className="font-mono font-bold">{match.score.p1}</span>}
      </div>
      {/* Player 2 */}
      <div className={cn(
        "flex justify-between items-center px-3 py-2",
        match.winner === match.player2 && "bg-green-50 font-bold text-green-700",
        match.winner && match.winner !== match.player2 && "text-slate-400"
      )}>
        {renderPlayerName(match.player2)}
        {match.score && <span className="font-mono font-bold">{match.score.p2}</span>}
      </div>
      {isActive && (
        <div className="absolute inset-0 bg-blue-500/5 pointer-events-none animate-pulse" />
      )}
    </motion.div>
  );
}