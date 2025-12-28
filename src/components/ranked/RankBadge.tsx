import React from 'react';
import { Tier } from '@shared/types';
import { cn } from '@/lib/utils';
import { Trophy, Medal, Crown, Shield, Star, Gem } from 'lucide-react';
export { type Tier };
interface RankBadgeProps {
  tier: Tier;
  division?: 1 | 2 | 3;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}
export function RankBadge({ tier, division, size = 'md', className }: RankBadgeProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };
  const tierColors = {
    Bronze: 'text-amber-700 bg-amber-100/10 border-amber-700/50',
    Silver: 'text-slate-300 bg-slate-100/10 border-slate-400/50',
    Gold: 'text-yellow-400 bg-yellow-100/10 border-yellow-500/50',
    Platinum: 'text-cyan-400 bg-cyan-100/10 border-cyan-500/50',
    Diamond: 'text-purple-400 bg-purple-100/10 border-purple-500/50',
    Master: 'text-rose-500 bg-rose-100/10 border-rose-500/50'
  };
  const TierIcon = {
    Bronze: Shield,
    Silver: Shield,
    Gold: Medal,
    Platinum: Trophy,
    Diamond: Gem,
    Master: Crown
  }[tier];
  return (
    <div className={cn(
      "relative flex items-center justify-center rounded-full border-2 shadow-glow-sm backdrop-blur-sm",
      sizeClasses[size],
      tierColors[tier],
      className
    )}>
      <TierIcon className="w-[60%] h-[60%] fill-current" />
      {division && tier !== 'Master' && (
        <div className="absolute -bottom-1 -right-1 bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white/10">
          {division === 1 ? 'I' : division === 2 ? 'II' : 'III'}
        </div>
      )}
    </div>
  );
}