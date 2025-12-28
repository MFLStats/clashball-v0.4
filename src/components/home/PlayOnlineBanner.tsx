import React from 'react';
import { Button } from '@/components/ui/button';
import { Globe, ArrowRight, Zap } from 'lucide-react';
interface PlayOnlineBannerProps {
  onClick: () => void;
}
export function PlayOnlineBanner({ onClick }: PlayOnlineBannerProps) {
  return (
    <div
      className="w-full h-full relative overflow-hidden rounded-3xl shadow-xl cursor-pointer group transform transition-all hover:scale-[1.02] border border-blue-500/20"
      onClick={onClick}
    >
      {/* Backgrounds */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-950 to-indigo-950 z-0" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 z-0" />
      {/* Glows */}
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity" />
      <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-cyan-500 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity" />
      <div className="relative z-10 p-8 flex flex-col justify-between h-full">
        {/* Icon & Header */}
        <div className="flex justify-between items-start">
            <div className="relative">
                <div className="absolute inset-0 bg-blue-400 blur-md opacity-40 rounded-full" />
                <div className="relative p-3 bg-gradient-to-br from-blue-400 to-blue-700 rounded-full border-2 border-blue-300 shadow-lg">
                    <Globe className="w-8 h-8 text-white drop-shadow-md" />
                </div>
            </div>
            <div className="p-2 bg-white/5 rounded-lg backdrop-blur-sm border border-white/10 group-hover:bg-white/10 transition-colors">
                <Zap className="w-5 h-5 text-yellow-400 fill-current" />
            </div>
        </div>
        {/* Text Content */}
        <div className="space-y-2 mt-4">
            <h3 className="text-3xl font-display font-bold text-white tracking-wide uppercase italic drop-shadow-lg">
                Play <span className="text-blue-400">Online</span>
            </h3>
            <p className="text-blue-200 font-medium text-sm">
                Ranked Competitive Matches
            </p>
        </div>
        {/* Action Button (Visual only, whole card is clickable) */}
        <div className="mt-auto pt-6">
            <Button
                size="lg"
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 transition-all shadow-lg group-hover:shadow-blue-500/25"
            >
                FIND MATCH <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
        </div>
      </div>
    </div>
  );
}