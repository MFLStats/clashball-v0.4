import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { GameCanvas } from '@/components/game/GameCanvas';
import { Dashboard } from '@/components/ranked/Dashboard';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Play, Trophy, Users, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
type ViewState = 'lobby' | 'game' | 'ranked';
export function HomePage() {
  const [view, setView] = useState<ViewState>('lobby');
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
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lobby
              </Button>
              <h2 className="text-xl font-display font-bold text-slate-800">Practice Match</h2>
              <div className="w-24" /> {/* Spacer */}
            </div>
            <GameCanvas />
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
              <div className="w-24" /> {/* Spacer */}
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
            </div>
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md">
              <button 
                onClick={() => setView('game')}
                className="btn-kid-primary flex-1 flex items-center justify-center gap-3 text-lg group"
              >
                <Play className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
                Play Now
              </button>
              <button 
                onClick={() => setView('ranked')}
                className="btn-kid-secondary flex-1 flex items-center justify-center gap-3 text-lg"
              >
                <Users className="w-6 h-6" />
                Ranked
              </button>
            </div>
            {/* Footer Info */}
            <div className="flex gap-8 text-sm font-bold text-slate-400">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                1,240 Online
              </span>
              <span>v0.1.0 Alpha</span>
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