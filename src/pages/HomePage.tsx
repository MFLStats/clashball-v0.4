import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { GameCanvas } from '@/components/game/GameCanvas';
import { Dashboard } from '@/components/ranked/Dashboard';
import { OnlineGameManager } from '@/components/game/OnlineGameManager';
import { CustomLobbyManager } from '@/components/game/CustomLobbyManager';
import { TournamentManager } from '@/components/tournament/TournamentManager';
import { TournamentBanner } from '@/components/tournament/TournamentBanner';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowLeft, Globe, Monitor, Crown, LogOut, Users, Info, BarChart2 } from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { GameMode } from '@shared/types';
import { OrientationLock } from '@/components/ui/orientation-lock';
import { TournamentPage } from '@/pages/TournamentPage';
import { TechInfoModal } from '@/components/help/TechInfoModal';
import { Leaderboard } from '@/components/ranked/Leaderboard';
type ViewState = 'lobby' | 'local_game' | 'online_select' | 'online_game' | 'custom_lobby' | 'ranked' | 'tournament_mode' | 'tournament_lobby' | 'leaderboard';
export function HomePage() {
  const [view, setView] = useState<ViewState>('lobby');
  const [selectedMode, setSelectedMode] = useState<GameMode>('1v1');
  // STRICT ZUSTAND RULE: Select primitives individually
  const profile = useUserStore(s => s.profile);
  const isAuthenticated = useUserStore(s => s.isAuthenticated);
  const initUser = useUserStore(s => s.initUser);
  const refreshProfile = useUserStore(s => s.refreshProfile);
  const logout = useUserStore(s => s.logout);
  const [isProcessing, setIsProcessing] = useState(false);
  useEffect(() => {
    initUser();
  }, [initUser]);
  const handleLocalGameEnd = async (winner: 'red' | 'blue') => {
    if (!profile || isProcessing) return;
    setIsProcessing(true);
    try {
      // Red is Local Player, Blue is Bot
      const result = winner === 'red' ? 'win' : 'loss';
      const opponentRating = 1200;
      const response = await api.reportMatch({
        userId: profile.id,
        opponentRating,
        opponentName: 'Bot (1200)',
        result,
        timestamp: Date.now(),
        mode: '1v1' // Default to 1v1 for local practice
      });
      toast.success(
        `Match Complete! Rating: ${response.newRating} (${response.ratingChange > 0 ? '+' : ''}${response.ratingChange})`,
        { description: `New Rank: ${response.newTier} ${response.newDivision}` }
      );
      await refreshProfile();
      setTimeout(() => {
        setView('lobby');
        setIsProcessing(false);
      }, 3000);
    } catch (error) {
      toast.error('Failed to report match result');
      setIsProcessing(false);
    }
  };
  const startOnlineGame = (mode: GameMode) => {
    setSelectedMode(mode);
    setView('online_game');
  };
  const renderContent = () => {
    switch (view) {
      case 'local_game':
        return (
          <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setView('lobby')}
                className="hover:bg-slate-800 text-slate-200"
                disabled={isProcessing}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lobby
              </Button>
              <h2 className="text-xl font-display font-bold text-white">
                Practice Arena
              </h2>
              <div className="w-24" />
            </div>
            <GameCanvas
                onGameEnd={handleLocalGameEnd}
                winningScore={3}
                playerNames={{ red: 'You', blue: 'Bot (1200)' }}
            />
          </div>
        );
      case 'online_select':
        return (
          <div className="animate-fade-in space-y-8">
             <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setView('lobby')}
                className="hover:bg-slate-800 text-slate-200"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lobby
              </Button>
              <h2 className="text-xl font-display font-bold text-white">Select Game Mode</h2>
              <div className="w-24" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {(['1v1', '2v2', '3v3', '4v4'] as GameMode[]).map((mode) => (
                    <button
                        key={mode}
                        onClick={() => startOnlineGame(mode)}
                        className="group relative overflow-hidden p-8 rounded-xl bg-slate-900 border border-slate-800 hover:border-primary/50 hover:shadow-md transition-all duration-200 text-left"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Globe className="w-24 h-24 text-white" />
                        </div>
                        <h3 className="text-3xl font-display font-bold text-white mb-2 group-hover:text-primary transition-colors">{mode}</h3>
                        <p className="text-slate-400 font-medium">Ranked Competitive</p>
                    </button>
                ))}
            </div>
          </div>
        );
      case 'online_game':
        return (
            <OnlineGameManager
                mode={selectedMode}
                onExit={async () => {
                    await refreshProfile();
                    setView('lobby');
                }}
            />
        );
      case 'custom_lobby':
        return (
            <CustomLobbyManager
                onExit={() => setView('lobby')}
            />
        );
      case 'tournament_mode':
        return (
            <TournamentManager onExit={() => setView('lobby')} />
        );
      case 'tournament_lobby':
        return (
            <TournamentPage />
        );
      case 'ranked':
        return (
          <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setView('lobby')}
                className="hover:bg-slate-800 text-slate-200"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lobby
              </Button>
              <h2 className="text-xl font-display font-bold text-white">Ranked Progression</h2>
              <div className="w-24" />
            </div>
            <Dashboard />
          </div>
        );
      case 'leaderboard':
        return (
          <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setView('lobby')}
                className="hover:bg-slate-800 text-slate-200"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lobby
              </Button>
              <div className="w-24" />
            </div>
            <Leaderboard />
          </div>
        );
      case 'lobby':
      default: {
        // Get 1v1 stats for display
        const stats = profile?.stats['1v1'];
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-slide-up">
            {/* Logo Area */}
            <div className="text-center space-y-4">
              <div className="inline-block p-6 rounded-full bg-slate-900 border border-slate-800 shadow-lg relative group">
                <Trophy className="w-16 h-16 text-primary relative z-10" />
              </div>
              <h1 className="text-5xl md:text-7xl font-display font-bold text-white tracking-tight">
                Clash<span className="text-primary">Ball</span>
              </h1>
              <p className="text-xl text-slate-400 font-medium max-w-md mx-auto">
                Classic physics-based soccer. Pure skill, no gimmicks.
              </p>
              {/* Profile / Auth Pill */}
              {profile && stats && (
                 <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-full shadow-sm border border-slate-800 animate-fade-in">
                    <div className={`w-3 h-3 rounded-full ${stats.tier === 'Bronze' ? 'bg-amber-600' : 'bg-primary'}`} />
                    {profile.country && (
                      <img
                        src={`https://flagcdn.com/w20/${profile.country.toLowerCase()}.png`}
                        alt={profile.country}
                        className="w-5 h-auto rounded-sm opacity-90"
                      />
                    )}
                    <span className="font-bold text-slate-200">{profile.username}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-400 font-medium">{stats.rating} MMR</span>
                    {isAuthenticated ? (
                      <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 text-slate-400 hover:text-red-400 hover:bg-slate-800" onClick={logout}>
                        <LogOut className="w-3 h-3" />
                      </Button>
                    ) : (
                      <AuthDialog trigger={
                        <Button variant="link" size="sm" className="h-6 px-2 ml-2 text-primary font-bold hover:text-primary/80">
                          Sign In
                        </Button>
                      } />
                    )}
                 </div>
              )}
            </div>
            {/* Tournament Banner */}
            <div className="w-full max-w-md">
              <TournamentBanner />
            </div>
            {/* Action Buttons */}
            <div className="flex flex-col gap-4 w-full max-w-md">
              <button
                onClick={() => setView('online_select')}
                className="btn-kid-primary flex items-center justify-center gap-3 text-lg group w-full"
              >
                <Globe className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
                Play Online
              </button>
              <button
                onClick={() => setView('custom_lobby')}
                className="btn-kid-secondary flex items-center justify-center gap-3 text-lg group w-full"
              >
                <Users className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
                Custom Lobby
              </button>
              <button
                onClick={() => setView('tournament_mode')}
                className="btn-kid-action flex items-center justify-center gap-3 text-lg group w-full"
              >
                <Crown className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
                Tournament Mode
              </button>
              <div className="flex gap-4">
                <button
                    onClick={() => setView('local_game')}
                    className="btn-kid-secondary flex-1 flex items-center justify-center gap-3 text-lg"
                >
                    <Monitor className="w-6 h-6" />
                    Practice
                </button>
                <button
                    onClick={() => setView('ranked')}
                    className="btn-kid-secondary flex-1 flex items-center justify-center gap-3 text-lg"
                >
                    <Users className="w-6 h-6" />
                    Stats
                </button>
              </div>
              <button
                  onClick={() => setView('leaderboard')}
                  className="btn-kid-secondary w-full flex items-center justify-center gap-3 text-lg"
              >
                  <BarChart2 className="w-6 h-6" />
                  Leaderboard
              </button>
            </div>
            {/* Footer Info */}
            <div className="flex gap-8 text-sm font-bold text-slate-600 items-center">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Online
              </span>
              <span>v1.2.1 ClashBall</span>
              <TechInfoModal trigger={
                <button className="hover:text-slate-400 transition-colors flex items-center gap-1">
                    <Info className="w-4 h-4" /> Tech Specs
                </button>
              } />
            </div>
          </div>
        );
      }
    }
  };
  // If we are in tournament lobby view, render just that page component
  if (view === 'tournament_lobby') {
    return <TournamentPage />;
  }
  return (
    <AppLayout container contentClassName="py-8">
      <OrientationLock />
      <div className="min-h-screen -m-8 p-8">
        <div className="max-w-5xl mx-auto">
          {renderContent()}
        </div>
      </div>
    </AppLayout>
  );
}