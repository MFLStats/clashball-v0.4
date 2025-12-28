import React from 'react';
import { PlayerMatchStats } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Crown, RotateCcw, LogOut, Shield, Goal } from 'lucide-react';
import { cn } from '@/lib/utils';
interface PlayerInfo {
  id: string;
  username: string;
  team: 'red' | 'blue';
}
interface PostMatchSummaryProps {
  winner: 'red' | 'blue';
  userTeam?: 'red' | 'blue';
  score: { red: number; blue: number };
  stats: Record<string, PlayerMatchStats>;
  players: PlayerInfo[];
  onPlayAgain?: () => void;
  onLeave: () => void;
  isLocal?: boolean;
}
export function PostMatchSummary({
  winner,
  userTeam,
  score,
  stats,
  players,
  onPlayAgain,
  onLeave,
  isLocal
}: PostMatchSummaryProps) {
  const isVictory = userTeam ? winner === userTeam : false;
  const title = isLocal ? "MATCH ENDED" : isVictory ? "VICTORY" : "DEFEAT";
  const titleColor = isLocal ? "text-white" : isVictory ? "text-yellow-400" : "text-red-500";
  const sortedPlayers = [...players].sort((a, b) => {
    // Sort by MVP first, then goals
    const statsA = stats[a.id];
    const statsB = stats[b.id];
    if (statsA?.isMvp) return -1;
    if (statsB?.isMvp) return 1;
    return (statsB?.goals || 0) - (statsA?.goals || 0);
  });
  return (
    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-2xl bg-slate-900 border-slate-800 shadow-2xl overflow-hidden">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            {isVictory || isLocal ? (
              <div className="p-4 bg-yellow-500/10 rounded-full border border-yellow-500/20 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                <Trophy className="w-12 h-12 text-yellow-400 animate-bounce" />
              </div>
            ) : (
              <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
                <Shield className="w-12 h-12 text-red-500" />
              </div>
            )}
          </div>
          <CardTitle className={cn("text-5xl font-display font-bold tracking-wider drop-shadow-lg", titleColor)}>
            {title}
          </CardTitle>
          <div className="flex items-center justify-center gap-8 mt-6">
            <div className="text-center">
              <div className="text-4xl font-display font-bold text-red-500">{score.red}</div>
              <div className="text-xs font-bold text-red-400/50 uppercase tracking-widest">Team Red</div>
            </div>
            <div className="text-2xl font-bold text-slate-600">-</div>
            <div className="text-center">
              <div className="text-4xl font-display font-bold text-blue-500">{score.blue}</div>
              <div className="text-xs font-bold text-blue-400/50 uppercase tracking-widest">Team Blue</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-900">
                <TableRow className="hover:bg-slate-900 border-slate-800">
                  <TableHead className="text-slate-400 font-bold">Player</TableHead>
                  <TableHead className="text-center text-slate-400 font-bold">Goals</TableHead>
                  <TableHead className="text-center text-slate-400 font-bold">Assists</TableHead>
                  <TableHead className="text-center text-slate-400 font-bold">Own Goals</TableHead>
                  <TableHead className="text-right text-slate-400 font-bold">Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPlayers.map((player) => {
                  const pStats = stats[player.id] || { goals: 0, assists: 0, ownGoals: 0, isMvp: false, cleanSheet: false };
                  return (
                    <TableRow key={player.id} className="hover:bg-slate-800/50 border-slate-800 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border shadow-sm",
                            player.team === 'red' ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          )}>
                            {player.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className={cn("font-bold", player.team === 'red' ? "text-red-100" : "text-blue-100")}>
                              {player.username}
                            </span>
                            {pStats.isMvp && (
                              <Badge variant="secondary" className="w-fit h-4 px-1.5 text-[9px] bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
                                <Crown className="w-2 h-2" /> MVP
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold text-white">
                        {pStats.goals > 0 ? (
                          <span className="text-emerald-400">{pStats.goals}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold text-white">
                        {pStats.assists > 0 ? (
                          <span className="text-blue-400">{pStats.assists}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold text-white">
                        {pStats.ownGoals > 0 ? (
                          <span className="text-red-400">{pStats.ownGoals}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Rating change could be passed here if available, for now placeholder */}
                        <div className="flex items-center justify-end gap-1">
                           {/* Placeholder for rating change visualization */}
                           <span className="text-xs text-slate-500 font-mono">--</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-4 pt-2">
            <Button
              onClick={onLeave}
              variant="outline"
              className="flex-1 border-slate-700 hover:bg-slate-800 text-slate-300 h-12 font-bold"
            >
              <LogOut className="w-4 h-4 mr-2" /> Leave
            </Button>
            {onPlayAgain && (
              <Button
                onClick={onPlayAgain}
                className="flex-1 btn-kid-primary h-12"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Play Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}