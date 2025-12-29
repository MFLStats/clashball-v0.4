import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
export function TournamentBanner() {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    // Calculate next 5 min slot
    const updateTimer = () => {
      const now = Date.now();
      const interval = 5 * 60 * 1000;
      const next = Math.ceil(now / interval) * interval;
      const diff = next - now;
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div 
      className="w-full relative overflow-hidden rounded-2xl shadow-xl cursor-pointer group transform transition-all hover:scale-[1.01]"
      onClick={() => navigate('/tournament')}
    >
      {/* Background with Glassmorphism */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 z-0" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 z-0" />
      {/* Glowing Accent */}
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-pulse" />
      <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-purple-500 rounded-full blur-3xl opacity-30 animate-pulse" />
      <div className="relative z-10 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left Content */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-400 blur-md opacity-50 rounded-full animate-pulse" />
            <div className="relative p-3 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-full border-2 border-yellow-200 shadow-lg">
              <Trophy className="w-8 h-8 text-white drop-shadow-md" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-display font-bold text-white tracking-wide uppercase italic">
                ClashBall <span className="text-yellow-400">Blitz</span>
              </h3>
              <Zap className="w-5 h-5 text-yellow-400 fill-current animate-bounce" />
            </div>
            <p className="text-indigo-200 font-medium text-sm flex items-center gap-2">
              <span className="px-2 py-0.5 bg-white/10 rounded text-xs font-bold border border-white/20">1v1</span>
              <span>Tournament Starts In:</span>
              <span className="font-mono font-bold text-white text-lg bg-black/30 px-2 rounded border border-white/10 shadow-inner">
                {timeLeft}
              </span>
            </p>
          </div>
        </div>
        {/* Right Action */}
        <Button 
          size="lg" 
          className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-slate-900 font-black border-b-4 border-orange-700 active:border-b-0 active:translate-y-1 transition-all shadow-lg group-hover:shadow-orange-500/50"
          onClick={(e) => {
            e.stopPropagation();
            navigate('/tournament');
          }}
        >
          JOIN NOW <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}