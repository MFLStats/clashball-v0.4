import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
interface NetworkIndicatorProps {
  ping: number | null;
  className?: string;
}
export function NetworkIndicator({ ping, className }: NetworkIndicatorProps) {
  if (ping === null) {
    return (
      <Badge variant="outline" className={cn("bg-slate-900/80 border-slate-700 text-slate-400 gap-2", className)}>
        <WifiOff className="w-3 h-3" />
        <span className="font-mono text-xs">-- ms</span>
      </Badge>
    );
  }
  let colorClass = "bg-emerald-500";
  let textColorClass = "text-emerald-400";
  if (ping > 150) {
    colorClass = "bg-red-500";
    textColorClass = "text-red-400";
  } else if (ping > 80) {
    colorClass = "bg-amber-500";
    textColorClass = "text-amber-400";
  }
  return (
    <Badge variant="outline" className={cn("bg-slate-900/80 border-slate-700 gap-2 backdrop-blur-sm shadow-sm", className)}>
      <div className="relative flex h-2 w-2">
        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", colorClass)}></span>
        <span className={cn("relative inline-flex rounded-full h-2 w-2", colorClass)}></span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn("font-mono font-bold text-xs", textColorClass)}>
          {Math.round(ping)}ms
        </span>
        <span className="text-[10px] font-bold text-slate-500 border-l border-slate-700 pl-1.5">
          WSS
        </span>
      </div>
    </Badge>
  );
}