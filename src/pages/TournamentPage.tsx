import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/useUserStore';
import { TournamentState, TournamentParticipant } from '@shared/types';
import { ArrowLeft, Clock, Users, Trophy, Loader2, Play, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { TournamentManager } from '@/components/tournament/TournamentManager';
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
    const interval = setInterval(fetchState, 5000); // Poll every 5s
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
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-slate-300 hover:bg-white/10">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lobby
          </Button>
          <h1 className="text-3xl font-display font-bold text-white text-glow">Tournament Lobby</h1>
          <div className="w-24" />
        </div>
        {/* Status Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 bg-gradient-to-br from-indigo-900/80 to-purple-900/80 backdrop-blur-xl text-white border border-white/10 shadow-glow-lg">
            <CardContent className="p-8 flex flex-col justify-center h-full space-y-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-10 h-10 text-yellow-300 drop-shadow-[0_0_10px_rgba(253,224,71,0.5)]" />
                <h2 className="text-4xl font-display font-bold">Next Event</h2>
              </div>
              <div className="flex items-end gap-4">
                <div className="text-6xl font-mono font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
                  {timeLeft}
                </div>
                <div className="text-indigo-200 font-medium mb-2">until kickoff</div>
              </div>
              <div className="pt-4">
                {!isAuthenticated ? (
                  <AuthDialog
                    trigger={
                      <Button size="lg" className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold w-full md:w-auto shadow-lg">
                        Sign In to Join
                      </Button>
                    }
                  />
                ) : isJoined ? (
                  <div className="flex gap-4 flex-wrap">
                    <Button size="lg" disabled className="bg-green-500/80 text-white opacity-100 font-bold w-full md:w-auto border border-green-400/50 shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                      You are Registered
                    </Button>
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={handleLeave}
                      disabled={isJoining}
                      className="bg-red-600/80 hover:bg-red-600 text-white font-bold w-full md:w-auto border border-red-500/50"
                    >
                      {isJoining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
                      Leave
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => setView('bracket')}
                      className="bg-yellow-400 text-yellow-900 hover:bg-yellow-300 font-bold w-full md:w-auto shadow-lg"
                    >
                      <Play className="w-4 h-4 mr-2" /> View Bracket
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    onClick={handleJoin}
                    disabled={isJoining}
                    className="bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 hover:from-yellow-300 hover:to-orange-400 font-bold w-full md:w-auto shadow-lg"
                  >
                    {isJoining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Join Tournament
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="card-kid">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="w-5 h-5 text-neon-blue" />
                Participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-5xl font-bold text-white mb-2 drop-shadow-md">
                  {state?.participants.length || 0}
                </div>
                <p className="text-slate-400">Players Registered</p>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Participants List */}
        <Card className="card-kid">
          <CardHeader>
            <CardTitle className="text-white">Registered Players</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-neon-blue" />
              </div>
            ) : state?.participants.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No players registered yet. Be the first!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-sm font-bold text-slate-400">
                      <th className="pb-3 pl-4">Country</th>
                      <th className="pb-3">Player</th>
                      <th className="pb-3">Rank</th>
                      <th className="pb-3 text-right pr-4">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {state?.participants.map((p) => (
                      <tr key={p.userId} className="group hover:bg-white/5 transition-colors">
                        <td className="py-3 pl-4">
                          <img
                            src={`https://flagcdn.com/w40/${p.country.toLowerCase()}.png`}
                            alt={p.country}
                            className="w-8 h-auto rounded shadow-sm opacity-80 group-hover:opacity-100"
                          />
                        </td>
                        <td className="py-3 font-bold text-slate-200 group-hover:text-white">{p.username}</td>
                        <td className="py-3 text-slate-400 text-sm">{p.rank}</td>
                        <td className="py-3 text-right pr-4 font-mono text-neon-blue">{p.rating}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}