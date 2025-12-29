import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Trophy, Crown } from 'lucide-react';
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
  const quarterFinals = matches.filter(m => m.round === 0);
  const semiFinals = matches.filter(m => m.round === 1);
  const final = matches.filter(m => m.round === 2)[0];
  const champion = final?.winner;
  return (
    <div className="w-full overflow-x-auto p-8 scrollbar-hide">
      <div className="min-w-[1000px] flex justify-between items-center gap-4 h-[600px]">
        {/* COLUMN 1: Quarter Finals */}
        <div className="flex flex-col justify-around h-full w-56">
          {quarterFinals.map((match, idx) => (
            <MatchCard key={match.id} match={match} isActive={currentRound === 0 && !match.winner} />
          ))}
        </div>
        {/* CONNECTOR 1: QF -> SF */}
        <div className="flex flex-col justify-around h-full w-16">
          {/* Top Pair Connector */}
          <BracketConnector height="h-1/4" />
          {/* Bottom Pair Connector */}
          <BracketConnector height="h-1/4" />
        </div>
        {/* COLUMN 2: Semi Finals */}
        <div className="flex flex-col justify-around h-full w-56">
          {semiFinals.map((match, idx) => (
            <MatchCard key={match.id} match={match} isActive={currentRound === 1 && !match.winner} />
          ))}
        </div>
        {/* CONNECTOR 2: SF -> Final */}
        <div className="flex flex-col justify-around h-full w-16">
           <BracketConnector height="h-1/2" />
        </div>
        {/* COLUMN 3: Final */}
        <div className="flex flex-col justify-center h-full w-64">
          {final && (
            <MatchCard key={final.id} match={final} isActive={currentRound === 2 && !final.winner} isFinal />
          )}
        </div>
        {/* CONNECTOR 3: Final -> Champion */}
        <div className="flex flex-col justify-center h-full w-12">
           <div className="h-1 w-full bg-slate-700" />
        </div>
        {/* COLUMN 4: Champion */}
        <div className="flex flex-col justify-center h-full w-48">
           <ChampionSlot name={champion} />
        </div>
      </div>
    </div>
  );
}
function BracketConnector({ height }: { height: string }) {
  return (
    <div className={cn("w-full border-r-2 border-t-2 border-b-2 border-slate-700 rounded-r-xl relative", height)}>
      <div className="absolute top-1/2 -right-4 w-4 h-0.5 bg-slate-700 -translate-y-1/2" />
    </div>
  );
}
function MatchCard({ match, isActive, isFinal }: { match: TournamentMatch; isActive: boolean; isFinal?: boolean }) {
  const renderPlayer = (name: string, isWinner: boolean) => (
    <div className={cn(
      "flex justify-between items-center px-3 py-2 transition-colors",
      isWinner ? "bg-emerald-500/10 text-emerald-400" : "text-slate-300"
    )}>
      <div className="flex items-center gap-2 overflow-hidden">
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
          isWinner ? "bg-emerald-500 text-slate-900" : "bg-slate-800 text-slate-500"
        )}>
          {name ? name.charAt(0).toUpperCase() : '?'}
        </div>
        <span className={cn(
          "truncate text-sm font-medium",
          !name && "italic text-slate-600"
        )}>
          {name || "TBD"}
        </span>
      </div>
      {match.score && name && (
        <span className={cn(
          "font-mono font-bold text-sm ml-2",
          isWinner ? "text-emerald-400" : "text-slate-500"
        )}>
          {name === match.player1 ? match.score.p1 : match.score.p2}
        </span>
      )}
    </div>
  );
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative flex flex-col bg-slate-900/80 backdrop-blur-md border rounded-xl overflow-hidden shadow-lg transition-all duration-300",
        isActive ? "border-primary shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-1 ring-primary/50" : "border-white/10 hover:border-white/20",
        match.isUserMatch && !isActive && "border-l-4 border-l-blue-500",
        isFinal && "scale-110 border-yellow-500/30 shadow-yellow-500/10"
      )}
    >
      {isFinal && (
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500" />
      )}
      {/* Player 1 */}
      <div className="border-b border-white/5">
        {renderPlayer(match.player1, match.winner === match.player1)}
      </div>
      {/* Player 2 */}
      <div>
        {renderPlayer(match.player2, match.winner === match.player2)}
      </div>
      {isActive && (
        <div className="absolute inset-0 bg-primary/5 pointer-events-none animate-pulse" />
      )}
    </motion.div>
  );
}
function ChampionSlot({ name }: { name?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center p-6 rounded-2xl border-2 shadow-2xl transition-all duration-500",
        name 
          ? "bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border-yellow-500/50 shadow-yellow-500/20" 
          : "bg-slate-900/50 border-slate-800 border-dashed"
      )}
    >
      <div className={cn(
        "p-4 rounded-full mb-3 shadow-lg",
        name ? "bg-gradient-to-br from-yellow-400 to-orange-500" : "bg-slate-800"
      )}>
        <Trophy className={cn("w-8 h-8", name ? "text-slate-900" : "text-slate-600")} />
      </div>
      <div className="text-center">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Champion</div>
        <div className={cn(
          "text-lg font-display font-bold truncate max-w-[150px]",
          name ? "text-yellow-400 drop-shadow-sm" : "text-slate-600 italic"
        )}>
          {name || "Unknown"}
        </div>
      </div>
      {name && (
        <Crown className="absolute -top-3 -right-3 w-8 h-8 text-yellow-400 fill-yellow-400 animate-bounce drop-shadow-lg" />
      )}
    </motion.div>
  );
}