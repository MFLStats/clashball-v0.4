import React from 'react';
import { GameMode } from '@shared/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Swords, Users, Shield, Crown, Zap, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
interface GameModeSelectorProps {
  onSelect: (mode: GameMode) => void;
  onBack: () => void;
}
export function GameModeSelector({ onSelect, onBack }: GameModeSelectorProps) {
  const modes = [
    {
      id: '1v1',
      title: 'Duel',
      subtitle: 'Solo Competitive',
      desc: 'Pure skill. No excuses. Prove your worth in the ultimate test of individual mechanics.',
      icon: Swords,
      color: 'text-yellow-400',
      bgGradient: 'from-yellow-500/20 via-orange-500/10 to-transparent',
      borderColor: 'group-hover:border-yellow-500/50',
      shadowColor: 'group-hover:shadow-yellow-500/20',
      iconBg: 'bg-yellow-500/10',
      delay: 0.1
    },
    {
      id: '2v2',
      title: 'Doubles',
      subtitle: 'Dynamic Duo',
      desc: 'Coordinate with a partner. Teams are formed randomly from the queue.',
      icon: Users,
      color: 'text-blue-400',
      bgGradient: 'from-blue-500/20 via-cyan-500/10 to-transparent',
      borderColor: 'group-hover:border-blue-500/50',
      shadowColor: 'group-hover:shadow-blue-500/20',
      iconBg: 'bg-blue-500/10',
      delay: 0.2
    },
    {
      id: '3v3',
      title: 'Squad',
      subtitle: 'Tactical Teamwork',
      desc: 'Balance offense and defense. Random team assignment adds to the challenge.',
      icon: Shield,
      color: 'text-emerald-400',
      bgGradient: 'from-emerald-500/20 via-green-500/10 to-transparent',
      borderColor: 'group-hover:border-emerald-500/50',
      shadowColor: 'group-hover:shadow-emerald-500/20',
      iconBg: 'bg-emerald-500/10',
      delay: 0.3
    },
    {
      id: '4v4',
      title: 'War',
      subtitle: 'Total Chaos',
      desc: 'Full scale battle. Adapt to your randomly assigned teammates to win.',
      icon: Crown,
      color: 'text-purple-400',
      bgGradient: 'from-purple-500/20 via-pink-500/10 to-transparent',
      borderColor: 'group-hover:border-purple-500/50',
      shadowColor: 'group-hover:shadow-purple-500/20',
      iconBg: 'bg-purple-500/10',
      delay: 0.4
    }
  ];
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 15
      }
    }
  };
  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-12 px-4">
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
        <div className="w-32 hidden md:block" /> {/* Spacer */}
      </div>
      {/* Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto px-4 w-full"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {modes.map((mode) => (
          <motion.button
            key={mode.id}
            variants={cardVariants}
            onClick={() => onSelect(mode.id as GameMode)}
            className={cn(
              "group relative h-[420px] rounded-[2rem] border border-white/5 bg-slate-900/40 backdrop-blur-xl overflow-hidden text-left flex flex-col transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl",
              mode.borderColor,
              mode.shadowColor
            )}
          >
            {/* Background Gradient */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-out",
              mode.bgGradient
            )} />
            {/* Texture Overlay */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 mix-blend-overlay" />
            {/* Content Container */}
            <div className="relative z-10 p-8 flex flex-col h-full">
              {/* Top Section */}
              <div className="mb-auto">
                <div className="flex justify-between items-start mb-6">
                    <div className={cn(
                        "w-16 h-16 rounded-2xl border border-white/10 flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-lg",
                        mode.iconBg,
                        mode.color
                    )}>
                        <mode.icon className="w-8 h-8" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400 animate-pulse" />
                            <span className="text-[10px] font-bold text-slate-300 tracking-wider">RANKED</span>
                        </div>
                    </div>
                </div>
                <div className="space-y-1">
                    <h3 className="text-5xl font-display font-bold text-white tracking-tighter opacity-90 group-hover:opacity-100 transition-opacity">
                        {mode.id}
                    </h3>
                    <h4 className={cn("text-lg font-bold uppercase tracking-wide", mode.color)}>
                        {mode.title}
                    </h4>
                </div>
              </div>
              {/* Bottom Section */}
              <div className="space-y-6">
                <div className="h-px w-12 bg-white/10 group-hover:w-full transition-all duration-700" />
                <p className="text-slate-400 text-sm font-medium leading-relaxed min-h-[60px]">
                  {mode.desc}
                </p>
                {/* Action Button Visual */}
                <div className={cn(
                    "flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 group-hover:bg-white/10 transition-colors",
                    "transform translate-y-2 opacity-80 group-hover:translate-y-0 group-hover:opacity-100 duration-300"
                )}>
                    <span className="text-xs font-bold text-white pl-2">START MATCH</span>
                    <div className={cn("p-2 rounded-lg text-white", mode.color.replace('text-', 'bg-').replace('400', '500'))}>
                        <Play className="w-3 h-3 fill-current" />
                    </div>
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}