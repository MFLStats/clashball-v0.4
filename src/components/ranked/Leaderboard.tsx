import React, { useEffect, useState } from 'react';
import { LeaderboardEntry, GameMode } from '@shared/types';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RankBadge } from './RankBadge';
import { Trophy, Medal, Loader2, Globe, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
export function Leaderboard() {
  const [mode, setMode] = useState<GameMode>('1v1');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      try {
        const data = await api.getLeaderboard(mode);
        if (mounted) setEntries(data);
      } catch (error) {
        console.error('Failed to fetch leaderboard', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetchLeaderboard();
    return () => { mounted = false; };
  }, [mode]);
  const getRankStyle = (index: number) => {
    if (index === 0) return "bg-gradient-to-r from-yellow-500/20 to-transparent border-l-4 border-yellow-500";
    if (index === 1) return "bg-gradient-to-r from-slate-300/20 to-transparent border-l-4 border-slate-300";
    if (index === 2) return "bg-gradient-to-r from-amber-700/20 to-transparent border-l-4 border-amber-700";
    return "hover:bg-slate-800/30 border-l-4 border-transparent";
  };
  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-6 h-6 text-yellow-400 fill-yellow-400/20" />;
    if (index === 1) return <Medal className="w-6 h-6 text-slate-300 fill-slate-300/20" />;
    if (index === 2) return <Medal className="w-6 h-6 text-amber-700 fill-amber-700/20" />;
    return <span className="font-mono font-bold text-slate-500 w-6 text-center text-lg">#{index + 1}</span>;
  };
  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col items-center gap-4 text-center animate-fade-in">
        <div className="p-4 bg-slate-900 rounded-full border border-slate-800 shadow-xl">
            <Globe className="w-12 h-12 text-primary" />
        </div>
        <div>
            <h1 className="text-4xl font-display font-bold text-white mb-2">Global Rankings</h1>
            <p className="text-slate-400 text-lg">Top 50 Players • Season 1</p>
        </div>
      </div>
      <Tabs value={mode} onValueChange={(v) => setMode(v as GameMode)} className="w-full animate-slide-up">
        <div className="flex justify-center mb-8">
            <TabsList className="bg-slate-900 border border-slate-800 p-1 h-auto rounded-xl">
            {(['1v1', '2v2', '3v3', '4v4'] as GameMode[]).map((m) => (
                <TabsTrigger
                key={m}
                value={m}
                className="px-8 py-3 rounded-lg data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 font-bold transition-all"
                >
                {m}
                </TabsTrigger>
            ))}
            </TabsList>
        </div>
        <Card className="bg-slate-900 border-slate-800 shadow-2xl overflow-hidden">
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        <p className="text-slate-500 font-medium">Fetching rankings...</p>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-24 text-slate-500">
                        <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg">No ranked players yet.</p>
                        <p className="text-sm opacity-70">Be the first to claim the throne!</p>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {/* Header */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-950/50 border-b border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <div className="col-span-2 text-center">Rank</div>
                            <div className="col-span-5">Player</div>
                            <div className="col-span-3 text-center">Tier</div>
                            <div className="col-span-2 text-right">Rating</div>
                        </div>
                        {/* Rows */}
                        <div className="divide-y divide-slate-800/50">
                            {entries.map((entry, index) => (
                                <div 
                                    key={entry.userId} 
                                    className={cn(
                                        "grid grid-cols-12 gap-4 px-6 py-4 items-center transition-all duration-200",
                                        getRankStyle(index)
                                    )}
                                >
                                    <div className="col-span-2 flex justify-center">
                                        {getRankIcon(index)}
                                    </div>
                                    <div className="col-span-5">
                                        <div className="flex items-center gap-3">
                                            {entry.country && (
                                                <img
                                                    src={`https://flagcdn.com/w40/${entry.country.toLowerCase()}.png`}
                                                    alt={entry.country}
                                                    className="w-6 h-auto rounded shadow-sm opacity-90"
                                                />
                                            )}
                                            <span className={cn(
                                                "font-bold text-lg truncate",
                                                index === 0 ? "text-yellow-400" : 
                                                index === 1 ? "text-slate-200" : 
                                                index === 2 ? "text-amber-600" : "text-slate-300"
                                            )}>
                                                {entry.username}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="col-span-3 flex justify-center">
                                        <RankBadge tier={entry.tier} division={entry.division} size="sm" />
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <span className="font-mono font-bold text-white text-lg">{entry.rating}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}