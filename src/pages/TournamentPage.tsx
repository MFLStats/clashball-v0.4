import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/useUserStore';
import { TournamentState } from '@shared/types';
import { ArrowLeft, Trophy, Loader2, Play, LogOut, Users, Clock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { TournamentManager } from '@/components/tournament/TournamentManager';
import { RankBadge } from '@/components/ranked/RankBadge';
import { cn } from '@/lib/utils';
export function TournamentPage() {
  const navigate = useNavigate();
  const profile = useUserStore(s => s.profile);
  const isAuthenticated = useUserStore(s => s.isAuthenticated);
  const [state, setState] = useState<TournamentState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [view, setView] = useState<'lobby' | 'bracket'>('lobby');
  const fetchState = async () => {
    try {
      const data = await api.tournament.getState();
      setState(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!state) return;
    const updateTimer = () => {
      const now = Date.now();
      const diff = state.nextStartTime - now;
      if (diff <= 0) {
        setTimeLeft('Starting...');
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [state]);
  const handleJoin = async () => {
    if (!profile) return;
    setIsJoining(true);
    try {
      const newState = await api.tournament.join(profile.id);
      setState(newState);
      toast.success('You have joined the tournament!');
    } catch (err) {
      toast.error('Failed to join tournament');
    } finally {
      setIsJoining(false);
    }
  };
  const handleLeave = async () => {
    if (!profile) return;
    setIsJoining(true);
    try {
      const newState = await api.tournament.leave(profile.id);
      setState(newState);
      toast.success('You have left the tournament.');
    } catch (err) {
      toast.error('Failed to leave tournament');
    } finally {
      setIsJoining(false);
    }
  };
  const isJoined = state?.participants.some(p => p.userId === profile?.id);
  if (view === 'bracket') {
    return (
      <AppLayout container>
        <TournamentManager
          onExit={() => setView('lobby')}
          participants={state?.participants}
        />
      </AppLayout>
    );
  }
  return (
    <AppLayout container>
      <div className="space-y-8 animate-fade-in pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-slate-300 hover:bg-white/10 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lobby
          </Button>
          <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 rounded-full border border-slate-800">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tournament Servers Online</span>
          </div>
        </div>
        {/* Hero Status Card */}
        <div className="relative w-full overflow-hidden rounded-3xl shadow-2xl border border-white/10 group">
          {/* Dynamic Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-900 z-0" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 z-0" />
          <div className="absolute -right-20 -top-20 w-96 h-96 bg-indigo-500 rounded-full blur-[100px] opacity-20 animate-pulse" />
          <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-6 text-center md:text-left">
              <div>
                <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                  <Trophy className="w-6 h-6 text-yellow-400" />
                  <span className="text-indigo-300 font-bold tracking-widest uppercase text-sm">Official Event</span>
                </div>
                <h1 className="text-5xl md:text-6xl font-display font-bold text-white tracking-tight drop-shadow-lg">
                  ClashBall <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">Blitz</span>
                </h1>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="bg-black/30 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-4">
                  <Clock className="w-8 h-8 text-blue-400" />
                  <div className="text-left">
                    <div className="text-xs text-slate-400 font-bold uppercase">Next Round In</div>
                    <div className="text-3xl font-mono font-bold text-white tabular-nums tracking-tight">{timeLeft}</div>
                  </div>
                </div>
                <div className="h-12 w-px bg-white/10 hidden md:block" />
                <div className="text-left">
                  <div className="text-xs text-slate-400 font-bold uppercase mb-1">Prize Pool</div>
                  <div className="flex items-center gap-2 text-yellow-400 font-bold text-xl">
                    <Trophy className="w-5 h-5 fill-current" />
                    <span>Season Points</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Actions */}
            <div className="flex flex-col gap-4 min-w-[200px]">
              {!isAuthenticated ? (
                <AuthDialog
                  trigger={
                    <Button size="lg" className="w-full h-14 text-lg font-bold bg-white text-indigo-950 hover:bg-indigo-50 shadow-xl shadow-indigo-900/20">
                      Sign In to Join
                    </Button>
                  }
                />
              ) : isJoined ? (
                <>
                  <div className="flex items-center justify-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg border border-emerald-500/30 font-bold text-sm mb-2">
                    <Zap className="w-4 h-4 fill-current" /> You are Registered
                  </div>
                  <Button 
                    size="lg" 
                    onClick={() => setView('bracket')}
                    className="w-full h-14 text-lg font-bold bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-slate-900 shadow-lg shadow-orange-500/20"
                  >
                    <Play className="w-5 h-5 mr-2 fill-current" /> View Bracket
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={handleLeave}
                    disabled={isJoining}
                    className="w-full text-red-400 hover:text-red-300 hover:bg-red-950/30"
                  >
                    {isJoining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
                    Leave Tournament
                  </Button>
                </>
              ) : (
                <Button 
                  size="lg" 
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="w-full h-14 text-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/20 border-t border-white/10"
                >
                  {isJoining ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Join Tournament"}
                </Button>
              )}
            </div>
          </div>
        </div>
        {/* Participants Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
              <Users className="w-6 h-6 text-slate-400" />
              Participants <span className="text-slate-500 text-lg font-sans font-normal">({state?.participants.length || 0})</span>
            </h2>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
            </div>
          ) : state?.participants.length === 0 ? (
            <Card className="bg-slate-900/50 border-dashed border-slate-800 py-16">
              <CardContent className="text-center space-y-4">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                  <Users className="w-10 h-10 text-slate-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-300">No Players Yet</h3>
                <p className="text-slate-500">Be the first to join the arena!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {state?.participants.map((p) => (
                <div 
                  key={p.userId} 
                  className={cn(
                    "group relative bg-slate-900 border border-slate-800 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-indigo-500/30",
                    p.userId === profile?.id && "border-indigo-500 bg-indigo-950/10"
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden group-hover:border-indigo-500 transition-colors">
                        {p.country ? (
                           <img
                             src={`https://flagcdn.com/w80/${p.country.toLowerCase()}.png`}
                             alt={p.country}
                             className="w-full h-full object-cover opacity-80 group-hover:opacity-100"
                           />
                        ) : (
                           <span className="font-bold text-slate-400">{p.username.charAt(0)}</span>
                        )}
                      </div>
                      {p.userId === profile?.id && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full border-2 border-slate-900" />
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-indigo-400 text-lg">{p.rating}</div>
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">MMR</div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg truncate group-hover:text-indigo-300 transition-colors">
                      {p.username}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <RankBadge tier={p.rank.split(' ')[0] as any} size="sm" className="w-4 h-4" />
                      <span className="text-sm text-slate-400 font-medium">{p.rank}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}