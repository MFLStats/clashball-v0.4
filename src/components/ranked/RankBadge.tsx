import React from 'react';
import { cn } from '@/lib/utils';
import { Shield, Crown, Star, Gem, Medal } from 'lucide-react';
export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master';
interface RankBadgeProps {
  tier: Tier;
  division?: 1 | 2 | 3;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}
const TIER_COLORS: Record<Tier, string> = {
  Bronze: 'bg-amber-700 text-amber-100 border-amber-900',
  Silver: 'bg-slate-300 text-slate-800 border-slate-400',
  Gold: 'bg-yellow-400 text-yellow-900 border-yellow-600',
  Platinum: 'bg-cyan-200 text-cyan-900 border-cyan-400',
  Diamond: 'bg-blue-500 text-white border-blue-700',
  Master: 'bg-purple-600 text-purple-100 border-purple-900',
};
const TIER_ICONS: Record<Tier, React.ElementType> = {
  Bronze: Shield,
  Silver: Shield,
  Gold: Star,
  Platinum: Star,
  Diamond: Gem,
  Master: Crown,
};
export function RankBadge({ tier, division, className, size = 'md' }: RankBadgeProps) {
  const Icon = TIER_ICONS[tier];
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs border-2',
    md: 'w-12 h-12 text-sm border-4',
    lg: 'w-20 h-20 text-base border-4',
    xl: 'w-32 h-32 text-xl border-8',
  };
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
    xl: 'w-16 h-16',
  };
  return (
    <div className={cn(
      "relative flex items-center justify-center rounded-full shadow-md transition-transform hover:scale-110",
      TIER_COLORS[tier],
      sizeClasses[size],
      className
    )}>
      <Icon className={cn(iconSizes[size], "drop-shadow-sm")} />
      {division && tier !== 'Master' && (
        <div className="absolute -bottom-2 bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
          {division === 1 ? 'I' : division === 2 ? 'II' : 'III'}
        </div>
      )}
    </div>
  );
}