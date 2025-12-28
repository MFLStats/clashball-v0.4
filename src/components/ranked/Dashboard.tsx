import React, { useEffect } from 'react';
import { RankBadge, Tier } from './RankBadge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, TrendingUp, Loader2 } from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
export function Dashboard() {
  // STRICT ZUSTAND RULE: Select primitives individually
  const profile = useUserStore(s => s.profile);
  const isLoading = useUserStore(s => s.isLoading);
  const initUser = useUserStore(s => s.initUser);
  useEffect(() => {
    if (!profile) initUser();
  }, [profile, initUser]);
  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }
  // Calculate progress to next tier
  const currentRating = profile.rating;
  const progress = (currentRating % 100);
  const nextMilestone = Math.ceil((currentRating + 1) / 100) * 100;
  const winRate = profile.wins + profile.losses > 0
    ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
    : 0;
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Rank Card */}
        <Card className="md:col-span-2 card-kid bg-gradient-to-br from-white to-slate-50 border-slate-200">
          <CardContent className="p-6 flex items-center gap-8">
            <RankBadge tier={profile.tier} division={profile.division} size="xl" />
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-3xl font-display font-bold text-slate-800">
                  {profile.tier} {profile.division === 1 ? 'I' : profile.division === 2 ? 'II' : 'III'}
                </h2>
                <p className="text-slate-500 font-medium">Rating: {profile.rating} MMR</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-bold text-slate-600">
                  <span>Progress to Next Rank</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-4 rounded-full bg-slate-100" />
                <p className="text-xs text-slate-400 text-right">Next Milestone: {nextMilestone} MMR</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Quick Stats */}
        <div className="space-y-4">
          <Card className="card-kid p-4 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl text-green-600">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-bold">Total Wins</p>
              <p className="text-2xl font-display font-bold text-slate-800">{profile.wins}</p>
            </div>
          </Card>
          <Card className="card-kid p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-bold">Win Rate</p>
              <p className="text-2xl font-display font-bold text-slate-800">{winRate}%</p>
            </div>
          </Card>
        </div>
      </div>
      {/* Tier Ladder Preview */}
      <div className="space-y-4">
        <h3 className="text-xl font-display font-bold text-slate-800 px-2">Ranked Tiers</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {(['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master'] as Tier[]).map((tier) => (
            <div
              key={tier}
              className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${
                tier === profile.tier
                  ? 'bg-white border-blue-400 shadow-md scale-105'
                  : 'bg-slate-50 border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <RankBadge tier={tier} size="sm" className="mb-2" />
              <span className="font-bold text-slate-700">{tier}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}