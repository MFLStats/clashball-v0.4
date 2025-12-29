import React, { useEffect, useState, useMemo } from 'react';
import { RankBadge } from './RankBadge';
import { MatchHistory } from './MatchHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trophy, Users, Plus, Goal, HandHelping, Crown, Shield, AlertTriangle, Flag } from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
import { GameMode, TeamProfile } from '@shared/types';
import { Loader2 } from 'lucide-react';
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
      }
      return acc;
    }, { goals: 0, assists: 0, mvps: 0, cleanSheets: 0, ownGoals: 0 });
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
  const renderTeamCard = (team: TeamProfile) => {
      // Default to showing 2v2 stats for teams for now
      const stats = team.stats['2v2'];
      return (
          <div key={team.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
                      <Users className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                      <h3 className="font-bold text-white">{team.name}</h3>
                      <p className="text-xs text-slate-400">Members: {team.members.length}</p>
                  </div>
              </div>
              <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                      <RankBadge tier={stats.tier} size="sm" />
                      <span className="font-bold text-white">{stats.rating}</span>
                  </div>
                  <p className="text-xs text-slate-500">2v2 Rating</p>
              </div>
          </div>
      );
  };
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
        {/* 1. Player Header */}
        <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-slate-900 rounded-2xl border border-slate-800 shadow-sm">
            <div className="relative">
                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center border-4 border-slate-700 shadow-lg">
                    <span className="text-4xl font-bold text-slate-500">
                        {profile.username.charAt(0).toUpperCase()}
                    </span>
                </div>
                {profile.country && (
                    <div className="absolute -bottom-2 -right-2 bg-slate-900 p-1 rounded-full border border-slate-700">
                        <img
                            src={`https://flagcdn.com/w40/${profile.country.toLowerCase()}.png`}
                            alt={profile.country}
                            className="w-8 h-auto rounded-full shadow-sm"
                        />
                    </div>
                )}
            </div>
            <div className="text-center md:text-left space-y-1">
                <h1 className="text-3xl font-display font-bold text-white">{profile.username}</h1>
                <p className="text-slate-400 font-medium flex items-center justify-center md:justify-start gap-2">
                    <Flag className="w-4 h-4" /> {profile.country || 'Unknown Region'}
                </p>
            </div>
        </div>
        {/* 2. Aggregated Career Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="card-kid p-4 flex flex-col items-center text-center gap-2">
                <div className="p-2 bg-emerald-500/10 rounded-full text-emerald-500 mb-1">
                    <Goal className="w-5 h-5" />
                </div>
                <p className="text-2xl font-display font-bold text-white">{careerStats.goals}</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Goals</p>
            </Card>
            <Card className="card-kid p-4 flex flex-col items-center text-center gap-2">
                <div className="p-2 bg-indigo-500/10 rounded-full text-indigo-500 mb-1">
                    <HandHelping className="w-5 h-5" />
                </div>
                <p className="text-2xl font-display font-bold text-white">{careerStats.assists}</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assists</p>
            </Card>
            <Card className="card-kid p-4 flex flex-col items-center text-center gap-2">
                <div className="p-2 bg-amber-500/10 rounded-full text-amber-500 mb-1">
                    <Crown className="w-5 h-5" />
                </div>
                <p className="text-2xl font-display font-bold text-white">{careerStats.mvps}</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">MVPs</p>
            </Card>
            <Card className="card-kid p-4 flex flex-col items-center text-center gap-2">
                <div className="p-2 bg-sky-500/10 rounded-full text-sky-500 mb-1">
                    <Shield className="w-5 h-5" />
                </div>
                <p className="text-2xl font-display font-bold text-white">{careerStats.cleanSheets}</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clean Sheets</p>
            </Card>
            <Card className="card-kid p-4 flex flex-col items-center text-center gap-2">
                <div className="p-2 bg-red-500/10 rounded-full text-red-500 mb-1">
                    <AlertTriangle className="w-5 h-5" />
                </div>
                <p className="text-2xl font-display font-bold text-white">{careerStats.ownGoals}</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Own Goals</p>
            </Card>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 3. Ranked Ratings List */}
            <Card className="card-kid h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        Ranked Performance
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-800">
                        {(['1v1', '2v2', '3v3', '4v4'] as GameMode[]).map((mode) => {
                            const stats = profile.stats[mode];
                            return (
                                <div key={mode} className="flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 flex justify-center">
                                            <span className="font-display font-bold text-lg text-slate-300">{mode}</span>
                                        </div>
                                        <div className="h-8 w-px bg-slate-800" />
                                        <div className="flex flex-col">
                                            <span className="text-2xl font-mono font-bold text-white">{stats.rating}</span>
                                            <span className="text-xs text-slate-500 font-bold uppercase">MMR</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right hidden sm:block">
                                            <div className="font-bold text-slate-200">{stats.tier} {stats.division === 1 ? 'I' : stats.division === 2 ? 'II' : 'III'}</div>
                                            <div className="text-xs text-slate-500">
                                                {stats.wins}W - {stats.losses}L
                                            </div>
                                        </div>
                                        <RankBadge tier={stats.tier} division={stats.division} size="md" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
            {/* 4. Match History */}
            <div className="h-full">
                <MatchHistory matches={profile.recentMatches} />
            </div>
        </div>
        {/* 5. Teams Section */}
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-display font-bold text-white">My Teams</h3>
            </div>
            <Card className="card-kid">
                <CardContent className="p-6 space-y-6">
                    {/* Create Team Form */}
                    <form onSubmit={handleCreateTeam} className="flex gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium text-slate-400">Create New Team</label>
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
                    <div className="border-t border-slate-800 pt-6">
                        <div className="grid gap-3">
                            {teams.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 italic">
                                    No teams joined yet.
                                </div>
                            ) : (
                                teams.map(renderTeamCard)
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}