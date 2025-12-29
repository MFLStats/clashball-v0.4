import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Trophy, Crown, Clock, Play } from 'lucide-react';
import { TournamentMatch } from '@shared/types';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/store/useUserStore';
interface BracketProps {
  matches: TournamentMatch[];
  currentRound: number;
  onJoinMatch?: (matchId: string) => void;
}
export function Bracket({ matches, currentRound, onJoinMatch }: BracketProps) {
  // Group matches by round
  const quarterFinals = matches.filter(m => m.round === 0);
  const semiFinals = matches.filter(m => m.round === 1);
  const final = matches.filter(m => m.round === 2)[0];
  const champion = final?.winnerId ? (final.winnerId === final.player1?.userId ? final.player1?.username : final.player2?.username) : undefined;
  return (
    <div className="w-full overflow-x-auto p-8 scrollbar-hide">
      <div className="min-w-[1000px] flex justify-between items-center gap-4 h-[600px]">
        {/* COLUMN 1: Quarter Finals */}
        <div className="flex flex-col justify-around h-full w-64">
          {quarterFinals.map((match) => (
            <MatchCard key={match.id} match={match} onJoin={onJoinMatch} />
          ))}
        </div>
        {/* CONNECTOR 1: QF -> SF */}
        <div className="flex flex-col justify-around h-full w-16">
          <BracketConnector height="h-1/4" />
          <BracketConnector height="h-1/4" />
        </div>
        {/* COLUMN 2: Semi Finals */}
        <div className="flex flex-col justify-around h-full w-64">
          {semiFinals.map((match) => (
            <MatchCard key={match.id} match={match} onJoin={onJoinMatch} />
          ))}
        </div>
        {/* CONNECTOR 2: SF -> Final */}
        <div className="flex flex-col justify-around h-full w-16">
           <BracketConnector height="h-1/2" />
        </div>
        {/* COLUMN 3: Final */}
        <div className="flex flex-col justify-center h-full w-72">
          {final && (
            <MatchCard key={final.id} match={final} isFinal onJoin={onJoinMatch} />
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
function MatchCard({ match, isFinal, onJoin }: { match: TournamentMatch; isFinal?: boolean; onJoin?: (id: string) => void }) {
  const profile = useUserStore(s => s.profile);
  const userId = profile?.id;
  const isUserInMatch = userId && (match.player1?.userId === userId || match.player2?.userId === userId);
  const isScheduled = match.status === 'scheduled';
  const isReady = isUserInMatch && (match.player1?.userId === userId ? match.p1Ready : match.p2Ready);
  const canJoin = isUserInMatch && isScheduled && !isReady;
  const [timeLeft, setTimeLeft] = useState<string>('');
  useEffect(() => {
    if (match.status === 'scheduled' && match.startTime) {
      const interval = setInterval(() => {
        const diff = Math.max(0, (match.startTime! + 2 * 60 * 1000) - Date.now());
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
        if (diff <= 0) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft('');
    }
  }, [match.status, match.startTime]);
  const renderPlayer = (player: any, isWinner: boolean, isReady: boolean) => (
    <div className={cn(
      "flex justify-between items-center px-3 py-2 transition-colors relative overflow-hidden",
      isWinner ? "bg-emerald-500/10 text-emerald-400" : "text-slate-300",
      isReady && !isWinner && "bg-blue-500/10"
    )}>
      {isReady && !isWinner && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}
      <div className="flex items-center gap-2 overflow-hidden">
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
          isWinner ? "bg-emerald-500 text-slate-900" : "bg-slate-800 text-slate-500"
        )}>
          {player ? player.username.charAt(0).toUpperCase() : '?'}
        </div>
        <span className={cn(
          "truncate text-sm font-medium",
          !player && "italic text-slate-600"
        )}>
          {player?.username || "TBD"}
        </span>
      </div>
      {match.score && player && (
        <span className={cn(
          "font-mono font-bold text-sm ml-2",
          isWinner ? "text-emerald-400" : "text-slate-500"
        )}>
          {player.userId === match.player1?.userId ? match.score.p1 : match.score.p2}
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
        isUserInMatch ? "border-blue-500/50 shadow-blue-500/10" : "border-white/10 hover:border-white/20",
        isFinal && "scale-110 border-yellow-500/30 shadow-yellow-500/10"
      )}
    >
      {isFinal && (
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500" />
      )}
      {/* Header for Active Match */}
      {isScheduled && (
        <div className="bg-slate-950/50 px-3 py-1 flex justify-between items-center border-b border-white/5">
            <div className="flex items-center gap-1 text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                <Clock className="w-3 h-3" /> {timeLeft}
            </div>
            {match.status === 'in_progress' && (
                <span className="text-[10px] font-bold text-emerald-400 animate-pulse">LIVE</span>
            )}
        </div>
      )}
      {/* Player 1 */}
      <div className="border-b border-white/5">
        {renderPlayer(match.player1, match.winnerId === match.player1?.userId, match.p1Ready)}
      </div>
      {/* Player 2 */}
      <div>
        {renderPlayer(match.player2, match.winnerId === match.player2?.userId, match.p2Ready)}
      </div>
      {/* Join Overlay */}
      {canJoin && onJoin && (
        <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center backdrop-blur-sm z-10">
            <Button 
                size="sm" 
                onClick={() => onJoin(match.id)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 animate-pulse"
            >
                <Play className="w-3 h-3 mr-1 fill-current" /> JOIN MATCH
            </Button>
        </div>
      )}
      {isUserInMatch && isReady && match.status === 'scheduled' && (
          <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center backdrop-blur-sm z-10">
              <span className="text-xs font-bold text-blue-300 animate-pulse">Waiting for opponent...</span>
          </div>
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