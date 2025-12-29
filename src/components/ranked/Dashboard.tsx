import React, { useEffect, useState, useMemo } from 'react';
import { RankBadge } from './RankBadge';
import { MatchHistory } from './MatchHistory';
import { TeamDetailsDialog } from './TeamDetailsDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trophy, Users, Plus, Goal, HandHelping, Crown, Shield, AlertTriangle, Flag, Activity, Calendar, Star, Medal, LogIn, Loader2 } from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
import { GameMode, TeamProfile } from '@shared/types';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
export function Dashboard() {
  // STRICT ZUSTAND RULE: Select primitives individually
  const profile = useUserStore(s => s.profile);
  const teams = useUserStore(s => s.teams);
  const isLoading = useUserStore(s => s.isLoading);
  const initUser = useUserStore(s => s.initUser);
  const createTeam = useUserStore(s => s.createTeam);
  const joinTeam = useUserStore(s => s.joinTeam);
  const [newTeamName, setNewTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<TeamProfile | null>(null);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
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
      toast.success('Team created successfully!');
  };
  const handleJoinTeam = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!joinCode.trim()) return;
      try {
        await joinTeam(joinCode);
        setJoinCode('');
        toast.success('Joined team successfully!');
      } catch (err) {
        toast.error((err as Error).message);
      }
  };
  const totalMatches = careerStats.wins + careerStats.losses;
  const winRate = totalMatches > 0 ? Math.round((careerStats.wins / totalMatches) * 100) : 0;
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
        {/* 1. Hero Section - Redesigned without Avatar */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700 shadow-2xl">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 z-0" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex flex-col items-center md:items-start space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 rounded-lg border border-slate-700 shadow-sm">
                            <Trophy className="w-6 h-6 text-yellow-400" />
                        </div>
                        <h1 className="text-4xl md:text-6xl font-display font-bold text-white tracking-tight text-glow">
                            {profile.username}
                        </h1>
                    </div>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                        {profile.country && (
                            <Badge variant="secondary" className="bg-slate-800/80 text-slate-300 border-slate-700 px-3 py-1.5 text-sm">
                                <img
                                    src={`https://flagcdn.com/w20/${profile.country.toLowerCase()}.png`}
                                    alt={profile.country}
                                    className="w-4 h-auto mr-2 rounded-sm"
                                />
                                {profile.country}
                            </Badge>
                        )}
                        <Badge variant="secondary" className="bg-slate-800/80 text-slate-300 border-slate-700 px-3 py-1.5 text-sm">
                            <Calendar className="w-3.5 h-3.5 mr-2 text-slate-400" />
                            Joined {new Date().getFullYear()}
                        </Badge>
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5 px-3 py-1.5 text-sm">
                            <Activity className="w-3.5 h-3.5 mr-2" /> Online
                        </Badge>
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-8 pt-6 w-full">
                        <div className="text-center md:text-left">
                            <div className="text-3xl font-display font-bold text-white">{totalMatches}</div>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Matches</div>
                        </div>
                        <div className="w-px h-12 bg-slate-700 hidden md:block" />
                        <div className="text-center md:text-left">
                            <div className="text-3xl font-display font-bold text-emerald-400">{winRate}%</div>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Win Rate</div>
                        </div>
                        <div className="w-px h-12 bg-slate-700 hidden md:block" />
                        <div className="text-center md:text-left">
                            <div className="text-3xl font-display font-bold text-amber-400">{careerStats.mvps}</div>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">MVPs</div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center bg-slate-950/30 p-6 rounded-2xl border border-white/5 backdrop-blur-sm min-w-[200px]">
                    <RankBadge tier={profile.stats['1v1'].tier} division={profile.stats['1v1'].division} size="xl" />
                    <div className="text-center mt-4">
                        <div className="font-display font-bold text-xl text-white">
                            {profile.stats['1v1'].tier} {profile.stats['1v1'].division}
                        </div>
                        <div className="text-sm font-mono text-slate-400 mt-1">
                            {profile.stats['1v1'].rating} MMR
                        </div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
                            1v1 Competitive
                        </div>
                    </div>
                </div>
            </div>
        </div>
        {/* 2. Main Content Tabs */}
        <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-slate-900/50 p-1 rounded-xl border border-slate-800 mb-8">
                <TabsTrigger value="overview" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white font-bold py-3">Overview</TabsTrigger>
                <TabsTrigger value="ranked" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white font-bold py-3">Ranked</TabsTrigger>
                <TabsTrigger value="matches" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white font-bold py-3">Matches</TabsTrigger>
                <TabsTrigger value="teams" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white font-bold py-3">Teams</TabsTrigger>
            </TabsList>
            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                        <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
                            <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-500 ring-1 ring-emerald-500/20">
                                <Goal className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-white">{careerStats.goals}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Goals</div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                        <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
                            <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-500 ring-1 ring-indigo-500/20">
                                <HandHelping className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-white">{careerStats.assists}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Assists</div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                        <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
                            <div className="p-3 bg-sky-500/10 rounded-full text-sky-500 ring-1 ring-sky-500/20">
                                <Shield className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-white">{careerStats.cleanSheets}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Clean Sheets</div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                        <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
                            <div className="p-3 bg-red-500/10 rounded-full text-red-500 ring-1 ring-red-500/20">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-white">{careerStats.ownGoals}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Own Goals</div>
                            </div>
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
                                    <div key={match.matchId} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-1.5 h-10 rounded-full ${match.result === 'win' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : match.result === 'loss' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-slate-500'}`} />
                                            <div>
                                                <div className="font-bold text-white text-sm flex items-center gap-2">
                                                    <span className="uppercase">{match.result}</span>
                                                    <span className="text-slate-600">•</span>
                                                    <span className="text-slate-300">{match.mode}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5">vs {match.opponentName}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-mono font-bold text-lg ${match.ratingChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {match.ratingChange > 0 ? '+' : ''}{match.ratingChange}
                                            </div>
                                            <div className="text-xs text-slate-600">{formatDistanceToNow(match.timestamp, { addSuffix: true })}</div>
                                        </div>
                                    </div>
                                ))}
                                {profile.recentMatches.length === 0 && (
                                    <div className="text-center py-12 text-slate-500 italic bg-slate-800/20 rounded-xl border border-dashed border-slate-800">
                                        No recent matches found.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900 border-slate-800 h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Medal className="w-5 h-5 text-primary" />
                                Highest Ranking
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center justify-center py-8">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                                <RankBadge tier={profile.stats['1v1'].tier} division={profile.stats['1v1'].division} size="lg" className="relative z-10" />
                            </div>
                            <div className="mt-6 text-3xl font-display font-bold text-white">{profile.stats['1v1'].tier} {profile.stats['1v1'].division}</div>
                            <div className="text-slate-400 font-medium mb-4">1v1 Competitive</div>
                            <div className="px-4 py-1.5 bg-slate-800 rounded-full text-sm font-mono text-slate-300 border border-slate-700 shadow-inner">
                                Peak MMR: <span className="text-white font-bold">{profile.stats['1v1'].rating}</span>
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
                            <Card key={mode} className="bg-slate-900 border-slate-800 hover:border-primary/30 transition-all duration-300 group overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:bg-primary/10 transition-colors" />
                                <CardContent className="p-8 relative z-10">
                                    <div className="flex items-start justify-between mb-8">
                                        <div>
                                            <h3 className="text-3xl font-display font-bold text-white mb-1">{mode}</h3>
                                            <p className="text-slate-400 text-sm font-medium">Competitive League</p>
                                        </div>
                                        <RankBadge tier={stats.tier} division={stats.division} size="md" />
                                    </div>
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-end bg-slate-800/30 p-4 rounded-xl border border-slate-800">
                                            <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Current Rating</div>
                                            <div className="text-4xl font-mono font-bold text-white text-glow">{stats.rating}</div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div className="p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                                                <div className="text-xl font-bold text-white">{stats.wins}</div>
                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">WINS</div>
                                            </div>
                                            <div className="p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                                                <div className="text-xl font-bold text-white">{stats.losses}</div>
                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">LOSSES</div>
                                            </div>
                                            <div className="p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                                                <div className="text-xl font-bold text-emerald-400">
                                                    {stats.wins + stats.losses > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0}%
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">WIN RATE</div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Create Team */}
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
                                    <Plus className="w-4 h-4 mr-2" /> Create
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                    {/* Join Team */}
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-white">Join Existing Team</CardTitle>
                            <CardDescription className="text-slate-400">Enter an invite code to join a friend's squad.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleJoinTeam} className="flex gap-4 items-center">
                                <div className="flex-1">
                                    <Input
                                        placeholder="ENTER CODE"
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                        maxLength={6}
                                        className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-600 font-mono uppercase"
                                    />
                                </div>
                                <Button type="submit" disabled={!joinCode.trim() || isLoading} className="btn-kid-action">
                                    <LogIn className="w-4 h-4 mr-2" /> Join
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
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
                            <Card
                                key={team.id}
                                className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group"
                                onClick={() => {
                                    setSelectedTeam(team);
                                    setIsJoinDialogOpen(true);
                                }}
                            >
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center group-hover:border-primary/50 transition-colors">
                                            <span className="text-xl font-bold text-slate-300">
                                                {team.name.substring(0, 2).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{team.name}</h4>
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
        <TeamDetailsDialog
            team={selectedTeam}
            open={isJoinDialogOpen}
            onOpenChange={setIsJoinDialogOpen}
        />
    </div>
  );
}