import React, { useEffect, useState, useMemo } from 'react';
import { RankBadge } from './RankBadge';
import { MatchHistory } from './MatchHistory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trophy, Users, Plus, Goal, HandHelping, Crown, Shield, AlertTriangle, Flag, Activity, Calendar, Star } from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
import { GameMode, TeamProfile } from '@shared/types';
import { Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
export function Dashboard() {
  // STRICT ZUSTAND RULE: Select primitives individually
  const profile = useUserStore(s => s.profile);
  const teams = useUserStore(s => s.teams);
  const isLoading = useUserStore(s => s.isLoading);
  const initUser = useUserStore(s => s.initUser);
  const createTeam = useUserStore(s => s.createTeam);
  const [newTeamName, setNewTeamName] = useState('');
  useEffect(() => {
    if (!profile) initUser();
  }, [profile, initUser]);
  // Calculate aggregated career stats across all modes
  const careerStats = useMemo(() => {
    if (!profile) return null;
    const modes: GameMode[] = ['1v1', '2v2', '3v3', '4v4'];
    return modes.reduce((acc, mode) => {
      const stats = profile.stats[mode];
      if (stats) {
        acc.goals += stats.goals || 0;
        acc.assists += stats.assists || 0;
        acc.mvps += stats.mvps || 0;
        acc.cleanSheets += stats.cleanSheets || 0;
        acc.ownGoals += stats.ownGoals || 0;
        acc.wins += stats.wins || 0;
        acc.losses += stats.losses || 0;
      }
      return acc;
    }, { goals: 0, assists: 0, mvps: 0, cleanSheets: 0, ownGoals: 0, wins: 0, losses: 0 });
  }, [profile]);
  if (isLoading || !profile || !careerStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  const handleCreateTeam = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTeamName.trim()) return;
      await createTeam(newTeamName);
      setNewTeamName('');
  };
  const totalMatches = careerStats.wins + careerStats.losses;
  const winRate = totalMatches > 0 ? Math.round((careerStats.wins / totalMatches) * 100) : 0;
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
        {/* 1. Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 z-0" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-8">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-br from-primary to-purple-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                    <Avatar className="w-32 h-32 border-4 border-slate-900 shadow-xl relative">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`} />
                        <AvatarFallback className="text-4xl font-bold bg-slate-800 text-slate-400">
                            {profile.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    {profile.country && (
                        <div className="absolute bottom-1 right-1 bg-slate-900 p-1.5 rounded-full border border-slate-700 shadow-lg">
                            <img 
                                src={`https://flagcdn.com/w40/${profile.country.toLowerCase()}.png`}
                                alt={profile.country}
                                className="w-6 h-auto rounded-sm"
                            />
                        </div>
                    )}
                </div>
                <div className="flex-1 text-center md:text-left space-y-4">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight mb-2">
                            {profile.username}
                        </h1>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                            <Badge variant="secondary" className="bg-slate-800/80 text-slate-300 border-slate-700 px-3 py-1">
                                <Flag className="w-3 h-3 mr-2" /> {profile.country || 'Global'}
                            </Badge>
                            <Badge variant="secondary" className="bg-slate-800/80 text-slate-300 border-slate-700 px-3 py-1">
                                <Calendar className="w-3 h-3 mr-2" /> Joined {new Date().getFullYear()}
                            </Badge>
                            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 px-3 py-1">
                                <Activity className="w-3 h-3 mr-2" /> Online
                            </Badge>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-8 pt-2">
                        <div className="text-center md:text-left">
                            <div className="text-2xl font-bold text-white">{totalMatches}</div>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Matches</div>
                        </div>
                        <div className="text-center md:text-left">
                            <div className="text-2xl font-bold text-emerald-400">{winRate}%</div>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Win Rate</div>
                        </div>
                        <div className="text-center md:text-left">
                            <div className="text-2xl font-bold text-amber-400">{careerStats.mvps}</div>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">MVPs</div>
                        </div>
                    </div>
                </div>
                <div className="hidden md:block">
                    <RankBadge tier={profile.stats['1v1'].tier} division={profile.stats['1v1'].division} size="xl" />
                    <div className="text-center mt-2 font-mono font-bold text-slate-400 text-sm">
                        1v1 Rank
                    </div>
                </div>
            </div>
        </div>
        {/* 2. Main Content Tabs */}
        <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-slate-900/50 p-1 rounded-xl border border-slate-800 mb-8">
                <TabsTrigger value="overview" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white font-bold">Overview</TabsTrigger>
                <TabsTrigger value="ranked" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white font-bold">Ranked</TabsTrigger>
                <TabsTrigger value="matches" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white font-bold">Matches</TabsTrigger>
                <TabsTrigger value="teams" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white font-bold">Teams</TabsTrigger>
            </TabsList>
            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                            <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-500">
                                <Goal className="w-6 h-6" />
                            </div>
                            <div className="text-3xl font-bold text-white">{careerStats.goals}</div>
                            <div className="text-sm font-medium text-slate-500">Career Goals</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                            <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-500">
                                <HandHelping className="w-6 h-6" />
                            </div>
                            <div className="text-3xl font-bold text-white">{careerStats.assists}</div>
                            <div className="text-sm font-medium text-slate-500">Career Assists</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                            <div className="p-3 bg-sky-500/10 rounded-full text-sky-500">
                                <Shield className="w-6 h-6" />
                            </div>
                            <div className="text-3xl font-bold text-white">{careerStats.cleanSheets}</div>
                            <div className="text-sm font-medium text-slate-500">Clean Sheets</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                            <div className="p-3 bg-red-500/10 rounded-full text-red-500">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div className="text-3xl font-bold text-white">{careerStats.ownGoals}</div>
                            <div className="text-sm font-medium text-slate-500">Own Goals</div>
                        </CardContent>
                    </Card>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-slate-900 border-slate-800 h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Star className="w-5 h-5 text-yellow-400" />
                                Recent Performance
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {profile.recentMatches.slice(0, 3).map((match) => (
                                    <div key={match.matchId} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-10 rounded-full ${match.result === 'win' ? 'bg-emerald-500' : match.result === 'loss' ? 'bg-red-500' : 'bg-slate-500'}`} />
                                            <div>
                                                <div className="font-bold text-white text-sm">{match.mode} vs {match.opponentName}</div>
                                                <div className="text-xs text-slate-400">{formatDistanceToNow(match.timestamp, { addSuffix: true })}</div>
                                            </div>
                                        </div>
                                        <div className={`font-mono font-bold ${match.ratingChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {match.ratingChange > 0 ? '+' : ''}{match.ratingChange}
                                        </div>
                                    </div>
                                ))}
                                {profile.recentMatches.length === 0 && (
                                    <div className="text-center py-8 text-slate-500 italic">No recent matches found.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900 border-slate-800 h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Trophy className="w-5 h-5 text-primary" />
                                Highest Ranking
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center justify-center py-6">
                            <RankBadge tier={profile.stats['1v1'].tier} division={profile.stats['1v1'].division} size="lg" />
                            <div className="mt-4 text-2xl font-bold text-white">{profile.stats['1v1'].tier} {profile.stats['1v1'].division}</div>
                            <div className="text-slate-400 font-medium">1v1 Competitive</div>
                            <div className="mt-2 px-3 py-1 bg-slate-800 rounded-full text-xs font-mono text-slate-300 border border-slate-700">
                                Peak MMR: {profile.stats['1v1'].rating}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
            {/* RANKED TAB */}
            <TabsContent value="ranked" className="animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['1v1', '2v2', '3v3', '4v4'] as GameMode[]).map((mode) => {
                        const stats = profile.stats[mode];
                        return (
                            <Card key={mode} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors group">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-6">
                                        <div>
                                            <h3 className="text-2xl font-display font-bold text-white mb-1">{mode}</h3>
                                            <p className="text-slate-400 text-sm font-medium">Competitive League</p>
                                        </div>
                                        <RankBadge tier={stats.tier} division={stats.division} size="md" />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Rating</div>
                                            <div className="text-3xl font-mono font-bold text-white">{stats.rating}</div>
                                        </div>
                                        <Separator className="bg-slate-800" />
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div>
                                                <div className="text-lg font-bold text-white">{stats.wins}</div>
                                                <div className="text-xs text-slate-500 font-bold">WINS</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold text-white">{stats.losses}</div>
                                                <div className="text-xs text-slate-500 font-bold">LOSSES</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold text-white">
                                                    {stats.wins + stats.losses > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0}%
                                                </div>
                                                <div className="text-xs text-slate-500 font-bold">WIN RATE</div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </TabsContent>
            {/* MATCHES TAB */}
            <TabsContent value="matches" className="animate-fade-in">
                <MatchHistory matches={profile.recentMatches} />
            </TabsContent>
            {/* TEAMS TAB */}
            <TabsContent value="teams" className="animate-fade-in space-y-6">
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-white">Create New Team</CardTitle>
                        <CardDescription className="text-slate-400">Form a squad to compete in 2v2, 3v3, and 4v4 leagues.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateTeam} className="flex gap-4 items-center">
                            <div className="flex-1">
                                <Input
                                    placeholder="Enter team name..."
                                    value={newTeamName}
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-600"
                                />
                            </div>
                            <Button type="submit" disabled={!newTeamName.trim() || isLoading} className="btn-kid-primary">
                                <Plus className="w-4 h-4 mr-2" /> Create Team
                            </Button>
                        </form>
                    </CardContent>
                </Card>
                <div className="grid gap-4">
                    <h3 className="text-xl font-display font-bold text-white px-1">My Teams</h3>
                    {teams.length === 0 ? (
                        <Card className="bg-slate-900 border-slate-800 border-dashed">
                            <CardContent className="p-12 text-center text-slate-500">
                                <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>You haven't joined any teams yet.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        teams.map((team) => (
                            <Card key={team.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="w-12 h-12 border-2 border-slate-700">
                                            <AvatarFallback className="bg-slate-800 text-slate-300 font-bold">
                                                {team.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h4 className="text-lg font-bold text-white">{team.name}</h4>
                                            <p className="text-sm text-slate-400">{team.members.length} Members</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-2 justify-end">
                                            <RankBadge tier={team.stats['2v2'].tier} size="sm" />
                                            <span className="font-mono font-bold text-white">{team.stats['2v2'].rating}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-bold mt-1">TEAM RATING</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </TabsContent>
        </Tabs>
    </div>
  );
}