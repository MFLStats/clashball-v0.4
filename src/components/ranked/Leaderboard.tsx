import React, { useEffect, useState } from 'react';
import { LeaderboardEntry, GameMode } from '@shared/types';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RankBadge } from './RankBadge';
import { Trophy, Medal, Loader2, Globe } from 'lucide-react';
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
  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-6 h-6 text-yellow-400 drop-shadow-md" />;
    if (index === 1) return <Medal className="w-6 h-6 text-slate-300 drop-shadow-md" />;
    if (index === 2) return <Medal className="w-6 h-6 text-amber-600 drop-shadow-md" />;
    return <span className="font-mono font-bold text-slate-500 w-6 text-center">{index + 1}</span>;
  };
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="p-4 bg-yellow-500/10 rounded-full border border-yellow-500/20">
            <Globe className="w-12 h-12 text-yellow-500" />
        </div>
        <h1 className="text-4xl font-display font-bold text-white">Global Rankings</h1>
        <p className="text-slate-400">Top 50 Players • Season 1</p>
      </div>
      <Tabs value={mode} onValueChange={(v) => setMode(v as GameMode)} className="w-full">
        <div className="flex justify-center mb-6">
            <TabsList className="bg-slate-900 border border-slate-800 p-1">
            {(['1v1', '2v2', '3v3', '4v4'] as GameMode[]).map((m) => (
                <TabsTrigger
                key={m}
                value={m}
                className="px-6 py-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 font-bold"
                >
                {m}
                </TabsTrigger>
            ))}
            </TabsList>
        </div>
        <Card className="card-kid border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        No ranked players yet. Be the first!
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-800 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-4 pl-6 w-16 text-center">Rank</th>
                                    <th className="py-4">Player</th>
                                    <th className="py-4 text-center">Tier</th>
                                    <th className="py-4 pr-6 text-right">Rating</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {entries.map((entry, index) => (
                                    <tr key={entry.userId} className={`group hover:bg-slate-800/30 transition-colors ${index < 3 ? 'bg-slate-800/10' : ''}`}>
                                        <td className="py-4 pl-6 text-center">
                                            <div className="flex justify-center">{getRankIcon(index)}</div>
                                        </td>
                                        <td className="py-4">
                                            <div className="flex items-center gap-3">
                                                {entry.country && (
                                                    <img
                                                        src={`https://flagcdn.com/w20/${entry.country.toLowerCase()}.png`}
                                                        alt={entry.country}
                                                        className="w-5 h-auto rounded shadow-sm opacity-80"
                                                    />
                                                )}
                                                <span className={`font-bold ${index === 0 ? 'text-yellow-400' : 'text-slate-200'}`}>
                                                    {entry.username}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <div className="flex justify-center">
                                                <RankBadge tier={entry.tier} division={entry.division} size="sm" />
                                            </div>
                                        </td>
                                        <td className="py-4 pr-6 text-right">
                                            <span className="font-mono font-bold text-white">{entry.rating}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}