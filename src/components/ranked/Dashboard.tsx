import React from 'react';
import { RankBadge, Tier } from './RankBadge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, Target } from 'lucide-react';
interface UserStats {
  rating: number;
  tier: Tier;
  division: 1 | 2 | 3;
  wins: number;
  losses: number;
  winRate: number;
}
// Mock Data
const MOCK_STATS: UserStats = {
  rating: 945,
  tier: 'Silver',
  division: 2,
  wins: 14,
  losses: 8,
  winRate: 63.6
};
export function Dashboard() {
  const nextTierThreshold = 1000;
  const currentTierBase = 900;
  const progress = ((MOCK_STATS.rating - currentTierBase) / (nextTierThreshold - currentTierBase)) * 100;
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Rank Card */}
        <Card className="md:col-span-2 card-kid bg-gradient-to-br from-white to-slate-50 border-slate-200">
          <CardContent className="p-6 flex items-center gap-8">
            <RankBadge tier={MOCK_STATS.tier} division={MOCK_STATS.division} size="xl" />
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-3xl font-display font-bold text-slate-800">
                  {MOCK_STATS.tier} {MOCK_STATS.division === 1 ? 'I' : MOCK_STATS.division === 2 ? 'II' : 'III'}
                </h2>
                <p className="text-slate-500 font-medium">Rating: {MOCK_STATS.rating}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-bold text-slate-600">
                  <span>Progress to Silver I</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-4 rounded-full bg-slate-100" />
                <p className="text-xs text-slate-400 text-right">Next Rank: 1000 MMR</p>
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
              <p className="text-2xl font-display font-bold text-slate-800">{MOCK_STATS.wins}</p>
            </div>
          </Card>
          <Card className="card-kid p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-bold">Win Rate</p>
              <p className="text-2xl font-display font-bold text-slate-800">{MOCK_STATS.winRate}%</p>
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
                tier === MOCK_STATS.tier 
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