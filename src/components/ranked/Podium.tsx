import React from 'react';
import { motion } from 'framer-motion';
import { LeaderboardEntry } from '@shared/types';
import { RankBadge } from './RankBadge';
import { Crown, Medal, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
interface PodiumProps {
  topThree: LeaderboardEntry[];
}
export function Podium({ topThree }: PodiumProps) {
  // Ensure we have 3 slots, filling with null if fewer players
  const players = [
    topThree[1] || null, // 2nd Place (Left)
    topThree[0] || null, // 1st Place (Center)
    topThree[2] || null, // 3rd Place (Right)
  ];
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1
      }
    }
  };
  const itemVariants = {
    hidden: { y: 50, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 100, damping: 12 }
    }
  };
  return (
    <motion.div 
      className="flex justify-center items-end gap-4 md:gap-8 h-[350px] mb-12 px-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {players.map((player, index) => {
        // Map visual index (0=2nd, 1=1st, 2=3rd) to actual rank
        const rank = index === 1 ? 1 : index === 0 ? 2 : 3;
        const isFirst = rank === 1;
        const isSecond = rank === 2;
        // Height classes
        const heightClass = isFirst ? "h-[220px]" : isSecond ? "h-[180px]" : "h-[150px]";
        // Color themes
        const colorClass = isFirst 
          ? "from-yellow-500/20 to-amber-500/5 border-yellow-500/30 shadow-yellow-500/10" 
          : isSecond 
            ? "from-slate-300/20 to-slate-400/5 border-slate-400/30 shadow-slate-400/10"
            : "from-amber-700/20 to-orange-800/5 border-amber-700/30 shadow-amber-700/10";
        const glowColor = isFirst ? "bg-yellow-500" : isSecond ? "bg-slate-300" : "bg-amber-700";
        const textColor = isFirst ? "text-yellow-400" : isSecond ? "text-slate-300" : "text-amber-600";
        if (!player) {
          // Placeholder for empty slot
          return (
            <div key={`empty-${rank}`} className={cn("w-full max-w-[140px] flex flex-col justify-end", heightClass)}>
               <div className="w-full h-full rounded-t-xl bg-slate-900/30 border-t border-x border-slate-800/50" />
            </div>
          );
        }
        return (
          <motion.div 
            key={player.userId}
            variants={itemVariants}
            className="relative flex flex-col items-center w-full max-w-[140px] md:max-w-[180px]"
          >
            {/* Avatar & Badge Floating above */}
            <div className={cn(
              "absolute -top-24 flex flex-col items-center gap-2 transition-transform duration-300 hover:scale-105 z-10",
              isFirst && "-top-28"
            )}>
              <div className="relative">
                {isFirst && (
                  <Crown className="absolute -top-8 left-1/2 -translate-x-1/2 w-8 h-8 text-yellow-400 fill-yellow-400 animate-bounce" />
                )}
                <div className={cn(
                  "w-16 h-16 md:w-20 md:h-20 rounded-full border-4 flex items-center justify-center bg-slate-900 shadow-xl overflow-hidden",
                  isFirst ? "border-yellow-400" : isSecond ? "border-slate-300" : "border-amber-700"
                )}>
                   {player.country ? (
                      <img 
                        src={`https://flagcdn.com/w80/${player.country.toLowerCase()}.png`} 
                        alt={player.country}
                        className="w-full h-full object-cover opacity-90"
                      />
                   ) : (
                      <span className={cn("text-2xl font-bold", textColor)}>
                        {player.username.charAt(0).toUpperCase()}
                      </span>
                   )}
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                  <RankBadge tier={player.tier} division={player.division} size="sm" />
                </div>
              </div>
              <div className="text-center mt-2">
                <div className={cn("font-bold text-sm md:text-base truncate max-w-[120px]", textColor)}>
                  {player.username}
                </div>
                <div className="text-xs font-mono text-slate-400 font-bold">
                  {player.rating} MMR
                </div>
              </div>
            </div>
            {/* Podium Block */}
            <div className={cn(
              "w-full rounded-t-2xl bg-gradient-to-b border-t border-x backdrop-blur-sm relative overflow-hidden group",
              heightClass,
              colorClass
            )}>
              {/* Rank Number */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-6xl font-display font-bold opacity-10 select-none group-hover:opacity-20 transition-opacity text-white">
                {rank}
              </div>
              {/* Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              {/* Bottom Glow */}
              <div className={cn("absolute bottom-0 left-0 right-0 h-1", glowColor, "shadow-[0_0_20px_currentColor]")} />
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}