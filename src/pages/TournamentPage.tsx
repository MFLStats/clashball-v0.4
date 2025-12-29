import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/useUserStore';
import { TournamentState, TournamentParticipant } from '@shared/types';
import { ArrowLeft, Clock, Users, Trophy, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthDialog } from '@/components/auth/AuthDialog';
export function TournamentPage() {
  const navigate = useNavigate();
  const profile = useUserStore(s => s.profile);
  const isAuthenticated = useUserStore(s => s.isAuthenticated);
  const [state, setState] = useState<TournamentState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
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
  const isJoined = state?.participants.some(p => p.userId === profile?.id);
  return (
    <AppLayout container>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lobby
          </Button>
          <h1 className="text-3xl font-display font-bold text-slate-800">Tournament Lobby</h1>
          <div className="w-24" />
        </div>
        {/* Status Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-none shadow-xl">
            <CardContent className="p-8 flex flex-col justify-center h-full space-y-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-10 h-10 text-yellow-300" />
                <h2 className="text-4xl font-display font-bold">Next Event</h2>
              </div>
              <div className="flex items-end gap-4">
                <div className="text-6xl font-mono font-bold tracking-tighter">
                  {timeLeft}
                </div>
                <div className="text-indigo-200 font-medium mb-2">until kickoff</div>
              </div>
              <div className="pt-4">
                {!isAuthenticated ? (
                  <AuthDialog 
                    trigger={
                      <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 font-bold w-full md:w-auto">
                        Sign In to Join
                      </Button>
                    } 
                  />
                ) : isJoined ? (
                  <Button size="lg" disabled className="bg-green-500 text-white opacity-100 font-bold w-full md:w-auto">
                    You are Registered
                  </Button>
                ) : (
                  <Button 
                    size="lg" 
                    onClick={handleJoin} 
                    disabled={isJoining}
                    className="bg-yellow-400 text-yellow-900 hover:bg-yellow-300 font-bold w-full md:w-auto"
                  >
                    {isJoining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Join Tournament
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-500" />
                Participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-5xl font-bold text-slate-800 mb-2">
                  {state?.participants.length || 0}
                </div>
                <p className="text-slate-500">Players Registered</p>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Participants List */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Registered Players</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : state?.participants.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                No players registered yet. Be the first!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-sm font-bold text-slate-500">
                      <th className="pb-3 pl-4">Country</th>
                      <th className="pb-3">Player</th>
                      <th className="pb-3">Rank</th>
                      <th className="pb-3 text-right pr-4">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {state?.participants.map((p) => (
                      <tr key={p.userId} className="group hover:bg-slate-50 transition-colors">
                        <td className="py-3 pl-4">
                          <img 
                            src={`https://flagcdn.com/w40/${p.country.toLowerCase()}.png`}
                            alt={p.country}
                            className="w-8 h-auto rounded shadow-sm"
                          />
                        </td>
                        <td className="py-3 font-bold text-slate-700">{p.username}</td>
                        <td className="py-3 text-slate-600 text-sm">{p.rank}</td>
                        <td className="py-3 text-right pr-4 font-mono text-slate-500">{p.rating}</td>
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