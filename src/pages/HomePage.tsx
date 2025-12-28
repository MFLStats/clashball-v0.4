import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { GameCanvas } from '@/components/game/GameCanvas';
import { Dashboard } from '@/components/ranked/Dashboard';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Play, Trophy, Users, ArrowLeft, Loader2 } from 'lucide-react';
import { useUserStore } from '@/src/store/useUserStore';
import { api } from '@/lib/api';
import { toast } from 'sonner';
type ViewState = 'lobby' | 'game' | 'ranked';
export function HomePage() {
  const [view, setView] = useState<ViewState>('lobby');
  // STRICT ZUSTAND RULE: Select primitives individually
  const profile = useUserStore(s => s.profile);
  const initUser = useUserStore(s => s.initUser);
  const refreshProfile = useUserStore(s => s.refreshProfile);
  const [isProcessing, setIsProcessing] = useState(false);
  useEffect(() => {
    initUser();
  }, [initUser]);
  const handleGameEnd = async (winner: 'red' | 'blue') => {
    if (!profile || isProcessing) return;
    setIsProcessing(true);
    try {
      // Red is Local Player, Blue is Bot
      const result = winner === 'red' ? 'win' : 'loss';
      // Simulate opponent rating (Bot is ~1200 MMR)
      const opponentRating = 1200;
      const response = await api.reportMatch({
        userId: profile.id,
        opponentRating,
        result,
        timestamp: Date.now()
      });
      toast.success(
        `Match Complete! Rating: ${response.newRating} (${response.ratingChange > 0 ? '+' : ''}${response.ratingChange})`,
        { description: `New Rank: ${response.newTier} ${response.newDivision}` }
      );
      await refreshProfile();
      // Delay return to lobby slightly to let user see victory screen
      setTimeout(() => {
        setView('lobby');
        setIsProcessing(false);
      }, 3000);
    } catch (error) {
      toast.error('Failed to report match result');
      setIsProcessing(false);
    }
  };
  const renderContent = () => {
    switch (view) {
      case 'game':
        return (
          <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setView('lobby')}
                className="hover:bg-slate-100 rounded-xl"
                disabled={isProcessing}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lobby
              </Button>
              <h2 className="text-xl font-display font-bold text-slate-800">
                Ranked Match vs Bot (1200 MMR)
              </h2>
              <div className="w-24" />
            </div>
            <GameCanvas onGameEnd={handleGameEnd} winningScore={3} />
          </div>
        );
      case 'ranked':
        return (
          <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setView('lobby')}
                className="hover:bg-slate-100 rounded-xl"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lobby
              </Button>
              <h2 className="text-xl font-display font-bold text-slate-800">Ranked Progression</h2>
              <div className="w-24" />
            </div>
            <Dashboard />
          </div>
        );
      case 'lobby':
      default:
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-slide-up">
            {/* Logo Area */}
            <div className="text-center space-y-4">
              <div className="inline-block p-6 rounded-[2rem] bg-gradient-to-br from-energy to-energy-dark shadow-kid rotate-3 hover:rotate-6 transition-transform duration-300">
                <Trophy className="w-16 h-16 text-white drop-shadow-md" />
              </div>
              <h1 className="text-5xl md:text-7xl font-display font-bold text-slate-800 tracking-tight">
                KickStar <span className="text-kick-blue">League</span>
              </h1>
              <p className="text-xl text-slate-500 font-medium max-w-md mx-auto">
                Physics-based competitive soccer. Climb the ranks and become a Master!
              </p>
              {profile && (
                 <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200 animate-fade-in">
                    <div className={`w-3 h-3 rounded-full ${profile.tier === 'Bronze' ? 'bg-amber-600' : 'bg-blue-500'}`} />
                    <span className="font-bold text-slate-700">{profile.username}</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-500 font-medium">{profile.rating} MMR</span>
                 </div>
              )}
            </div>
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md">
              <button
                onClick={() => setView('game')}
                className="btn-kid-primary flex-1 flex items-center justify-center gap-3 text-lg group"
              >
                <Play className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
                Play Ranked
              </button>
              <button
                onClick={() => setView('ranked')}
                className="btn-kid-secondary flex-1 flex items-center justify-center gap-3 text-lg"
              >
                <Users className="w-6 h-6" />
                My Stats
              </button>
            </div>
            {/* Footer Info */}
            <div className="flex gap-8 text-sm font-bold text-slate-400">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                Online
              </span>
              <span>v0.2.0 Beta</span>
            </div>
          </div>
        );
    }
  };
  return (
    <AppLayout container contentClassName="py-8">
      <div className="min-h-screen bg-slate-50/50 -m-8 p-8">
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="max-w-5xl mx-auto">
          {renderContent()}
        </div>
      </div>
    </AppLayout>
  );
}