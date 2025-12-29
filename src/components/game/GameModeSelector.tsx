import React from 'react';
import { GameMode } from '@shared/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Swords, Users, Shield, Crown, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
interface GameModeSelectorProps {
  onSelect: (mode: GameMode) => void;
  onBack: () => void;
}
export function GameModeSelector({ onSelect, onBack }: GameModeSelectorProps) {
  const modes = [
    {
      id: '1v1',
      title: 'Duel',
      desc: 'Pure Skill. No Excuses.',
      icon: Swords,
      color: 'text-yellow-400',
      bg: 'from-yellow-500/20 to-orange-500/20',
      border: 'group-hover:border-yellow-500/50',
      glow: 'group-hover:shadow-yellow-500/20'
    },
    {
      id: '2v2',
      title: 'Doubles',
      desc: 'Teamwork & Strategy.',
      icon: Users,
      color: 'text-blue-400',
      bg: 'from-blue-500/20 to-cyan-500/20',
      border: 'group-hover:border-blue-500/50',
      glow: 'group-hover:shadow-blue-500/20'
    },
    {
      id: '3v3',
      title: 'Squad',
      desc: 'Tactical Chaos.',
      icon: Shield,
      color: 'text-emerald-400',
      bg: 'from-emerald-500/20 to-green-500/20',
      border: 'group-hover:border-emerald-500/50',
      glow: 'group-hover:shadow-emerald-500/20'
    },
    {
      id: '4v4',
      title: 'War',
      desc: 'Full Scale Battle.',
      icon: Crown,
      color: 'text-purple-400',
      bg: 'from-purple-500/20 to-pink-500/20',
      border: 'group-hover:border-purple-500/50',
      glow: 'group-hover:shadow-purple-500/20'
    }
  ];
  return (
    <div className="animate-fade-in space-y-8 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <Button
          variant="ghost"
          onClick={onBack}
          className="hover:bg-white/10 text-slate-300 transition-colors"
        >
          <ArrowLeft className="mr-2 h-5 w-5" /> Back to Lobby
        </Button>
        <div className="text-center">
          <h2 className="text-4xl font-display font-bold text-white tracking-tight text-glow">
            Select Game Mode
          </h2>
          <p className="text-slate-400 mt-2 font-medium">Choose your battlefield</p>
        </div>
        <div className="w-32" /> {/* Spacer for centering */}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onSelect(mode.id as GameMode)}
            className={cn(
              "group relative h-96 rounded-3xl border border-white/10 bg-slate-900/50 backdrop-blur-xl overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl text-left flex flex-col",
              mode.border,
              mode.glow
            )}
          >
            {/* Background Gradient */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
              mode.bg
            )} />
            {/* Content Container */}
            <div className="relative z-10 p-8 flex flex-col h-full">
              {/* Icon */}
              <div className="mb-auto">
                <div className={cn(
                  "w-16 h-16 rounded-2xl bg-slate-950/50 border border-white/10 flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3",
                  mode.color
                )}>
                  <mode.icon className="w-8 h-8" />
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-300 mb-4">
                  <Zap className="w-3 h-3 text-yellow-400 fill-current" />
                  RANKED
                </div>
              </div>
              {/* Text */}
              <div className="space-y-2">
                <h3 className="text-5xl font-display font-bold text-white tracking-tighter">
                  {mode.id}
                </h3>
                <div className="h-1 w-12 bg-white/20 rounded-full group-hover:w-24 transition-all duration-500" />
                <h4 className={cn("text-xl font-bold pt-2", mode.color)}>
                  {mode.title}
                </h4>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                  {mode.desc}
                </p>
              </div>
              {/* Action Hint */}
              <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0">
                <span className="text-sm font-bold text-white">PLAY NOW</span>
                <div className={cn("p-2 rounded-full bg-white/10", mode.color)}>
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}