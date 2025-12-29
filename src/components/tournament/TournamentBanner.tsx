import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Timer, Trophy, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
export function TournamentBanner() {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState('');
  const [nextTime, setNextTime] = useState(0);
  useEffect(() => {
    // Calculate next 5 min slot
    const updateTimer = () => {
      const now = Date.now();
      const interval = 5 * 60 * 1000;
      const next = Math.ceil(now / interval) * interval;
      setNextTime(next);
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
    <div className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 shadow-lg border-4 border-indigo-400 relative overflow-hidden group cursor-pointer" onClick={() => navigate('/tournament')}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm animate-pulse">
            <Trophy className="w-8 h-8 text-yellow-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-display font-bold text-white">
                Live Tournament
              </h3>
              <span className="px-2 py-0.5 bg-green-400 text-green-900 text-xs font-bold rounded-full uppercase tracking-wider">
                Free Entry
              </span>
            </div>
            <p className="text-indigo-100 font-medium">
              1v1 Knockout • Starts in <span className="font-mono font-bold text-white text-lg">{timeLeft}</span>
            </p>
          </div>
        </div>
        <Button 
          className="bg-white text-indigo-600 hover:bg-indigo-50 font-bold border-none shadow-md group-hover:scale-105 transition-transform"
          onClick={(e) => {
            e.stopPropagation();
            navigate('/tournament');
          }}
        >
          Join Now <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}