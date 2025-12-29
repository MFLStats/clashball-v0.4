import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { GameCanvas } from '@/components/game/GameCanvas';
import { Dashboard } from '@/components/ranked/Dashboard';
import { OnlineGameManager } from '@/components/game/OnlineGameManager';
import { CustomLobbyManager } from '@/components/game/CustomLobbyManager';
import { TournamentManager } from '@/components/tournament/TournamentManager';
import { TournamentBanner } from '@/components/tournament/TournamentBanner';
import { PlayOnlineBanner } from '@/components/home/PlayOnlineBanner';
import { CustomLobbyBanner } from '@/components/home/CustomLobbyBanner';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowLeft, Crown, LogOut, BarChart2, Target } from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { GameMode } from '@shared/types';
import { OrientationLock } from '@/components/ui/orientation-lock';
import { TournamentPage } from '@/pages/TournamentPage';
import { Leaderboard } from '@/components/ranked/Leaderboard';
import { SoundEngine } from '@/lib/audio';
import { GameModeSelector } from '@/components/game/GameModeSelector';
type ViewState = 'lobby' | 'local_game' | 'online_select' | 'online_game' | 'custom_lobby' | 'ranked' | 'tournament_mode' | 'tournament_lobby' | 'leaderboard';
export function HomePage() {
  const [view, setView] = useState<ViewState>('lobby');
  const [selectedMode, setSelectedMode] = useState<GameMode>('1v1');
  const [showAuth, setShowAuth] = useState(false);
  // STRICT ZUSTAND RULE: Select primitives individually
  const profile = useUserStore(s => s.profile);
  const isAuthenticated = useUserStore(s => s.isAuthenticated);
  const initUser = useUserStore(s => s.initUser);
  const refreshProfile = useUserStore(s => s.refreshProfile);
  const logout = useUserStore(s => s.logout);
  // Settings Store
  const volume = useSettingsStore(s => s.volume);
  const [isProcessing, setIsProcessing] = useState(false);
  useEffect(() => {
    initUser();
  }, [initUser]);
  // Sync volume on mount/change
  useEffect(() => {
    SoundEngine.setVolume(volume);
  }, [volume]);
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
    if (!profile) {
      setShowAuth(true);
      toast.info('Please sign in or play as guest to join ranked matches');
      return;
    }
    setSelectedMode(mode);
    setView('online_game');
  };
  const handleOnlineSelectClick = () => {
    if (!profile) {
      setShowAuth(true);
      toast.info('Please sign in or play as guest to play online');
      return;
    }
    setView('online_select');
  };
  const handleCustomLobbyClick = () => {
    if (!profile) {
      setShowAuth(true);
      toast.info('Please sign in or play as guest to join lobbies');
      return;
    }
    setView('custom_lobby');
  };
  const handleRankedClick = () => {
    if (!profile) {
      setShowAuth(true);
      toast.info('Please sign in to view your profile');
      return;
    }
    setView('ranked');
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
          <GameModeSelector
            onSelect={startOnlineGame}
            onBack={() => setView('lobby')}
          />
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
          <div className="flex flex-col min-h-[80vh] animate-slide-up relative max-w-6xl mx-auto">
            {/* Header Section */}
            <header className="flex justify-between items-center mb-12">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary rounded-lg shadow-lg shadow-primary/20">
                        <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-display font-bold text-white tracking-tight">
                        Clash<span className="text-primary">Ball</span>
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    {profile && stats ? (
                        <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-800 shadow-sm">
                            <div className={`w-2 h-2 rounded-full ${stats.tier === 'Bronze' ? 'bg-amber-600' : 'bg-primary'} animate-pulse`} />
                            <span className="font-bold text-slate-200 text-sm">{profile.username}</span>
                            <div className="h-4 w-px bg-slate-700" />
                            <span className="text-slate-400 font-mono text-xs">{stats.rating} MMR</span>
                            {isAuthenticated ? (
                                <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 text-slate-500 hover:text-red-400 hover:bg-slate-800/50 rounded-full" onClick={logout}>
                                    <LogOut className="w-3 h-3" />
                                </Button>
                            ) : (
                                <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 text-slate-500 hover:text-red-400 hover:bg-slate-800/50 rounded-full" onClick={logout}>
                                    <LogOut className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    ) : (
                        <AuthDialog open={showAuth} onOpenChange={setShowAuth} />
                    )}
                    <SettingsDialog />
                </div>
            </header>
            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
                {/* Left Column: Tournament Banner & Quick Stats */}
                <div className="lg:col-span-2 space-y-6">
                    <TournamentBanner />
                    {/* Primary Actions Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-64">
                        <PlayOnlineBanner onClick={handleOnlineSelectClick} />
                        <CustomLobbyBanner onClick={handleCustomLobbyClick} />
                    </div>
                </div>
                {/* Right Column: Secondary Actions */}
                <div className="grid grid-cols-1 gap-6">
                    <button
                        onClick={() => setView('local_game')}
                        className="group relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-left shadow-lg border border-slate-800 transition-all hover:border-slate-700 hover:bg-slate-800/50"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 group-hover:bg-emerald-500/20 transition-colors">
                                <Target className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-display font-bold text-white">Practice</h3>
                                <p className="text-sm text-slate-500">Hone your skills vs Bot</p>
                            </div>
                        </div>
                    </button>
                    <button
                        onClick={() => setView('leaderboard')}
                        className="group relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-left shadow-lg border border-slate-800 transition-all hover:border-slate-700 hover:bg-slate-800/50"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 group-hover:bg-amber-500/20 transition-colors">
                                <BarChart2 className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-display font-bold text-white">Leaderboard</h3>
                                <p className="text-sm text-slate-500">Global Rankings</p>
                            </div>
                        </div>
                    </button>
                    <button
                        onClick={handleRankedClick}
                        className="group relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-left shadow-lg border border-slate-800 transition-all hover:border-slate-700 hover:bg-slate-800/50 flex-1"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500 group-hover:bg-purple-500/20 transition-colors">
                                <Crown className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-display font-bold text-white">My Profile</h3>
                                <p className="text-sm text-slate-500">Stats & Progression</p>
                            </div>
                        </div>
                    </button>
                </div>
            </div>
            {/* Footer */}
            <footer className="mt-auto pt-8 border-t border-slate-800/50 flex justify-between items-center text-sm text-slate-600 font-medium">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Servers Online</span>
                </div>
                {/* Footer text removed as per request */}
            </footer>
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
        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </div>
    </AppLayout>
  );
}