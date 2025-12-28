import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowRight, Zap, Users, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/useUserStore';
export function TournamentBanner() {
  const navigate = useNavigate();
  const profile = useUserStore(s => s.profile);
  const [timeLeft, setTimeLeft] = useState('');
  const [participantCount, setParticipantCount] = useState(0);
  const [targetTime, setTargetTime] = useState<number | null>(null);
  const [hasActiveMatch, setHasActiveMatch] = useState(false);
  // Fetch Tournament State
  useEffect(() => {
    const fetchState = async () => {
      try {
        const state = await api.tournament.getState();
        setParticipantCount(state.participants.length);
        setTargetTime(state.nextStartTime);
        // Check for active match
        if (profile && state.bracket) {
            const myMatch = state.bracket.find(m => 
                (m.player1?.userId === profile.id || m.player2?.userId === profile.id) &&
                m.status === 'scheduled'
            );
            // Check if I am NOT ready
            if (myMatch) {
                const isP1 = myMatch.player1?.userId === profile.id;
                const amIReady = isP1 ? myMatch.p1Ready : myMatch.p2Ready;
                setHasActiveMatch(!amIReady);
            } else {
                setHasActiveMatch(false);
            }
        }
      } catch (e) {
        console.error("Failed to fetch tournament state", e);
      }
    };
    fetchState();
    const interval = setInterval(fetchState, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [profile]);
  // Timer Logic
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      let target = targetTime;
      if (!target) {
        const interval = 5 * 60 * 1000;
        target = Math.ceil(now / interval) * interval;
      }
      const diff = Math.max(0, target - now);
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [targetTime]);
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
            <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-2 text-indigo-200 font-medium">
                    <span className="px-2 py-0.5 bg-white/10 rounded text-xs font-bold border border-white/20">1v1</span>
                    <span>Next Tournament Starts In:</span>
                    <span className="font-mono font-bold text-white text-lg bg-black/30 px-2 rounded border border-white/10 shadow-inner">
                        {timeLeft}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    <Users className="w-3.5 h-3.5" />
                    <span className="font-bold text-xs">{participantCount} Registered</span>
                </div>
            </div>
          </div>
        </div>
        {/* Right Action */}
        {hasActiveMatch ? (
            <Button
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black border-b-4 border-teal-800 active:border-b-0 active:translate-y-1 transition-all shadow-lg shadow-emerald-500/50 animate-pulse"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/tournament');
              }}
            >
              <Play className="w-5 h-5 mr-2 fill-current" /> JOIN MATCH NOW
            </Button>
        ) : (
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
        )}
      </div>
    </div>
  );
}