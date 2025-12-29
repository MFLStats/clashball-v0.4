import React, { useEffect, useState } from 'react';
import { LeaderboardEntry, GameMode } from '@shared/types';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RankBadge } from './RankBadge';
import { Podium } from './Podium';
import { Trophy, Loader2, Globe, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
export function Leaderboard() {
  const [mode, setMode] = useState<GameMode>('1v1');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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
  const topThree = entries.slice(0, 3);
  const restOfPlayers = entries.slice(3);
  const filteredPlayers = restOfPlayers.filter(p =>
    p.username.toLowerCase().includes(searchQuery.toLowerCase())
  );
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col items-center gap-4 text-center animate-fade-in">
        <div className="p-4 bg-slate-900 rounded-full border border-slate-800 shadow-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/20 blur-xl group-hover:bg-primary/30 transition-colors" />
            <Globe className="w-12 h-12 text-primary relative z-10" />
        </div>
        <div>
            <h1 className="text-4xl font-display font-bold text-white mb-2 text-glow">Global Rankings</h1>
            <p className="text-slate-400 text-lg">Season 1 • Top 50 Players</p>
        </div>
      </div>
      <Tabs value={mode} onValueChange={(v) => setMode(v as GameMode)} className="w-full animate-slide-up">
        <div className="flex justify-center mb-12">
            <TabsList className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-1 h-auto rounded-2xl shadow-lg">
            {(['1v1', '2v2', '3v3', '4v4'] as GameMode[]).map((m) => (
                <TabsTrigger
                key={m}
                value={m}
                className="px-8 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white text-slate-400 font-bold transition-all data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25"
                >
                {m}
                </TabsTrigger>
            ))}
            </TabsList>
        </div>
        {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="text-slate-500 font-medium animate-pulse">Fetching rankings...</p>
            </div>
        ) : entries.length === 0 ? (
            <div className="text-center py-24 text-slate-500 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800">
                <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-bold">No ranked players yet.</p>
                <p className="text-sm opacity-70">Be the first to claim the throne!</p>
            </div>
        ) : (
            <div className="space-y-8">
                {/* Podium Section */}
                <Podium topThree={topThree} />
                {/* List Section */}
                <Card className="bg-slate-900/80 backdrop-blur-xl border-slate-800 shadow-2xl overflow-hidden rounded-3xl">
                    <CardContent className="p-0">
                        {/* Search & Header */}
                        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-950/30">
                            <h3 className="font-display font-bold text-xl text-white flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-slate-500" />
                                Leaderboard
                            </h3>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input
                                    placeholder="Search player..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-primary/50 rounded-xl"
                                />
                            </div>
                        </div>
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-950/80 border-b border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <div className="col-span-2 md:col-span-1 text-center">#</div>
                            <div className="col-span-6 md:col-span-5">Player</div>
                            <div className="col-span-2 md:col-span-3 text-center hidden md:block">Tier</div>
                            <div className="col-span-4 md:col-span-3 text-right">Rating</div>
                        </div>
                        {/* Rows */}
                        <div className="divide-y divide-slate-800/50 max-h-[600px] overflow-y-auto scrollbar-hide">
                            {filteredPlayers.length > 0 ? (
                                filteredPlayers.map((entry, index) => (
                                    <div
                                        key={entry.userId}
                                        className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-white/5 transition-colors group"
                                    >
                                        <div className="col-span-2 md:col-span-1 text-center font-mono font-bold text-slate-500 group-hover:text-white transition-colors">
                                            {index + 4}
                                        </div>
                                        <div className="col-span-6 md:col-span-5">
                                            <div className="flex items-center gap-3">
                                                {entry.country && (
                                                    <img
                                                        src={`https://flagcdn.com/w40/${entry.country.toLowerCase()}.png`}
                                                        alt={entry.country}
                                                        className="w-6 h-auto rounded shadow-sm opacity-70 group-hover:opacity-100 transition-opacity"
                                                    />
                                                )}
                                                <span className="font-bold text-slate-300 group-hover:text-white truncate transition-colors">
                                                    {entry.username}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="col-span-2 md:col-span-3 hidden md:flex justify-center">
                                            <RankBadge tier={entry.tier} division={entry.division} size="sm" />
                                        </div>
                                        <div className="col-span-4 md:col-span-3 text-right">
                                            <span className="font-mono font-bold text-primary text-lg group-hover:text-white transition-colors">
                                                {entry.rating}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-12 text-center text-slate-500 italic">
                                    No players found matching "{searchQuery}"
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}
      </Tabs>
    </div>
  );
}