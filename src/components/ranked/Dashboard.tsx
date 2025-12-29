import React, { useEffect, useState } from 'react';
import { RankBadge, Tier } from './RankBadge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trophy, TrendingUp, Loader2, Users, User, Shield, Plus, Goal, HandHelping, Crown, AlertTriangle } from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
import { GameMode, ModeStats, TeamProfile } from '@shared/types';
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
  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-neon-blue" />
      </div>
    );
  }
  const handleCreateTeam = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTeamName.trim()) return;
      await createTeam(newTeamName);
      setNewTeamName('');
  };
  const renderStats = (mode: GameMode, stats: ModeStats) => {
    const currentRating = stats.rating;
    const progress = (currentRating % 100);
    const nextMilestone = Math.ceil((currentRating + 1) / 100) * 100;
    const winRate = stats.wins + stats.losses > 0 
      ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) 
      : 0;
    return (
      <div className="space-y-8 animate-fade-in mt-6">
        {/* Ranked Performance Section */}
        <div className="space-y-4">
            <h3 className="text-xl font-display font-bold text-white px-2 flex items-center gap-2 text-glow">
                <Trophy className="w-5 h-5 text-neon-yellow" />
                Ranked Performance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Main Rank Card */}
            <Card className="md:col-span-2 card-kid">
                <CardContent className="p-6 flex items-center gap-8">
                <RankBadge tier={stats.tier} division={stats.division} size="xl" />
                <div className="flex-1 space-y-4">
                    <div>
                    <h2 className="text-3xl font-display font-bold text-white drop-shadow-md">
                        {stats.tier} {stats.division === 1 ? 'I' : stats.division === 2 ? 'II' : 'III'}
                    </h2>
                    <p className="text-slate-300 font-medium">Rating: {stats.rating} MMR</p>
                    </div>
                    <div className="space-y-2">
                    <div className="flex justify-between text-sm font-bold text-slate-400">
                        <span>Progress to Next Rank</span>
                        <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-4 rounded-full bg-slate-800" />
                    <p className="text-xs text-slate-500 text-right">Next Milestone: {nextMilestone} MMR</p>
                    </div>
                </div>
                </CardContent>
            </Card>
            {/* Quick Win/Loss Stats */}
            <div className="space-y-4">
                <Card className="card-kid p-4 flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-xl text-green-400 border border-green-500/30">
                    <Trophy className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-slate-400 font-bold">Total Wins</p>
                    <p className="text-2xl font-display font-bold text-white">{stats.wins}</p>
                </div>
                </Card>
                <Card className="card-kid p-4 flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400 border border-blue-500/30">
                    <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-slate-400 font-bold">Win Rate</p>
                    <p className="text-2xl font-display font-bold text-white">{winRate}%</p>
                </div>
                </Card>
            </div>
            </div>
        </div>
        {/* Career Statistics Section */}
        <div className="space-y-4">
            <h3 className="text-xl font-display font-bold text-white px-2 flex items-center gap-2 text-glow">
                <Users className="w-5 h-5 text-neon-blue" />
                Career Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="card-kid p-4 flex flex-col items-center text-center gap-2 hover:border-neon-blue/50 transition-colors">
                    <div className="p-3 bg-emerald-500/20 rounded-full text-emerald-400 mb-1 border border-emerald-500/30">
                        <Goal className="w-6 h-6" />
                    </div>
                    <p className="text-2xl font-display font-bold text-white">{stats.goals || 0}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Goals</p>
                </Card>
                <Card className="card-kid p-4 flex flex-col items-center text-center gap-2 hover:border-neon-blue/50 transition-colors">
                    <div className="p-3 bg-indigo-500/20 rounded-full text-indigo-400 mb-1 border border-indigo-500/30">
                        <HandHelping className="w-6 h-6" />
                    </div>
                    <p className="text-2xl font-display font-bold text-white">{stats.assists || 0}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assists</p>
                </Card>
                <Card className="card-kid p-4 flex flex-col items-center text-center gap-2 hover:border-neon-blue/50 transition-colors">
                    <div className="p-3 bg-amber-500/20 rounded-full text-amber-400 mb-1 border border-amber-500/30">
                        <Crown className="w-6 h-6" />
                    </div>
                    <p className="text-2xl font-display font-bold text-white">{stats.mvps || 0}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">MVPs</p>
                </Card>
                <Card className="card-kid p-4 flex flex-col items-center text-center gap-2 hover:border-neon-blue/50 transition-colors">
                    <div className="p-3 bg-sky-500/20 rounded-full text-sky-400 mb-1 border border-sky-500/30">
                        <Shield className="w-6 h-6" />
                    </div>
                    <p className="text-2xl font-display font-bold text-white">{stats.cleanSheets || 0}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clean Sheets</p>
                </Card>
                <Card className="card-kid p-4 flex flex-col items-center text-center gap-2 hover:border-neon-blue/50 transition-colors">
                    <div className="p-3 bg-red-500/20 rounded-full text-red-400 mb-1 border border-red-500/30">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <p className="text-2xl font-display font-bold text-white">{stats.ownGoals || 0}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Own Goals</p>
                </Card>
            </div>
        </div>
        {/* Tier Ladder Preview */}
        <div className="space-y-4">
          <h3 className="text-xl font-display font-bold text-white px-2 text-glow">Ranked Tiers ({mode})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {(['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master'] as Tier[]).map((tier) => (
              <div
                key={tier}
                className={`flex flex-col items-center p-4 rounded-xl border transition-all ${
                  tier === stats.tier
                    ? 'bg-slate-800/80 border-neon-blue shadow-glow-sm scale-105'
                    : 'bg-slate-900/40 border-white/5 opacity-60 hover:opacity-100'
                }`}
              >
                <RankBadge tier={tier} size="sm" className="mb-2" />
                <span className="font-bold text-slate-300">{tier}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };
  const renderTeamCard = (team: TeamProfile) => {
      // Default to showing 2v2 stats for teams for now
      const stats = team.stats['2v2'];
      return (
          <Card key={team.id} className="card-kid hover:border-neon-blue transition-colors">
              <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                          <Users className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-white">{team.name}</h3>
                          <p className="text-sm text-slate-400">Members: {team.members.length}</p>
                      </div>
                  </div>
                  <div className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                          <RankBadge tier={stats.tier} size="sm" />
                          <span className="font-bold text-white">{stats.rating} MMR</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">2v2 Rating</p>
                  </div>
              </CardContent>
          </Card>
      );
  };
  return (
    <Tabs defaultValue="1v1" className="w-full">
      <TabsList className="grid w-full grid-cols-5 h-14 p-1 bg-slate-900/80 rounded-xl border border-white/10">
        <TabsTrigger value="1v1" className="rounded-lg text-base font-bold data-[state=active]:bg-white/10 data-[state=active]:text-neon-blue data-[state=active]:shadow-sm text-slate-400">
            <User className="w-4 h-4 mr-2" /> 1v1
        </TabsTrigger>
        <TabsTrigger value="2v2" className="rounded-lg text-base font-bold data-[state=active]:bg-white/10 data-[state=active]:text-neon-blue data-[state=active]:shadow-sm text-slate-400">
            <Users className="w-4 h-4 mr-2" /> 2v2
        </TabsTrigger>
        <TabsTrigger value="3v3" className="rounded-lg text-base font-bold data-[state=active]:bg-white/10 data-[state=active]:text-neon-blue data-[state=active]:shadow-sm text-slate-400">
            <Shield className="w-4 h-4 mr-2" /> 3v3
        </TabsTrigger>
        <TabsTrigger value="4v4" className="rounded-lg text-base font-bold data-[state=active]:bg-white/10 data-[state=active]:text-neon-blue data-[state=active]:shadow-sm text-slate-400">
            <Trophy className="w-4 h-4 mr-2" /> 4v4
        </TabsTrigger>
        <TabsTrigger value="teams" className="rounded-lg text-base font-bold data-[state=active]:bg-white/10 data-[state=active]:text-neon-blue data-[state=active]:shadow-sm text-slate-400">
            <Users className="w-4 h-4 mr-2" /> Teams
        </TabsTrigger>
      </TabsList>
      <TabsContent value="1v1">{renderStats('1v1', profile.stats['1v1'])}</TabsContent>
      <TabsContent value="2v2">{renderStats('2v2', profile.stats['2v2'])}</TabsContent>
      <TabsContent value="3v3">{renderStats('3v3', profile.stats['3v3'])}</TabsContent>
      <TabsContent value="4v4">{renderStats('4v4', profile.stats['4v4'])}</TabsContent>
      <TabsContent value="teams" className="space-y-6 mt-6 animate-fade-in">
          <div className="flex justify-between items-center">
              <h2 className="text-2xl font-display font-bold text-white text-glow">My Teams</h2>
          </div>
          {/* Create Team Form */}
          <Card className="card-kid">
              <CardContent className="p-6">
                  <form onSubmit={handleCreateTeam} className="flex gap-4 items-end">
                      <div className="flex-1 space-y-2">
                          <label className="text-sm font-medium text-slate-300">Create New Team</label>
                          <Input 
                            placeholder="Enter team name..." 
                            value={newTeamName}
                            onChange={(e) => setNewTeamName(e.target.value)}
                            className="bg-slate-950/50 border-white/10 text-white placeholder:text-slate-500"
                          />
                      </div>
                      <Button type="submit" disabled={!newTeamName.trim() || isLoading} className="btn-kid-primary">
                          <Plus className="w-4 h-4 mr-2" /> Create
                      </Button>
                  </form>
              </CardContent>
          </Card>
          {/* Team List */}
          <div className="grid gap-4">
              {teams.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                      You haven't joined any teams yet. Create one above!
                  </div>
              ) : (
                  teams.map(renderTeamCard)
              )}
          </div>
      </TabsContent>
    </Tabs>
  );
}