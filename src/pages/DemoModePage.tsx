import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { GameCanvas } from '@/components/game/GameCanvas';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Users, Zap, Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GameMode } from '@shared/types';
export function DemoModePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<GameMode>('1v1');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [resetKey, setResetKey] = useState(0);
  const handlePlayAgain = () => {
    setResetKey(prev => prev + 1);
  };
  return (
    <AppLayout container>
      <div className="space-y-8 animate-fade-in pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-slate-300 hover:bg-white/10 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lobby
          </Button>
          <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 rounded-full border border-slate-800">
            <Zap className="w-4 h-4 text-yellow-400 fill-current" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Team Mode Demo</span>
          </div>
        </div>
        {/* Controls Container */}
        <div className="flex flex-col items-center space-y-6">
            <div className="text-center">
                <h1 className="text-4xl font-display font-bold text-white mb-2">Test Arena</h1>
                <p className="text-slate-400">Experience 2v2, 3v3, and 4v4 gameplay with bots.</p>
            </div>
            <div className="flex flex-col md:flex-row gap-4 w-full max-w-3xl">
                {/* Mode Selector */}
                <Tabs value={mode} onValueChange={(v) => setMode(v as GameMode)} className="flex-1">
                    <TabsList className="grid w-full grid-cols-4 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-1 h-12 rounded-xl shadow-lg">
                        {(['1v1', '2v2', '3v3', '4v4'] as GameMode[]).map((m) => (
                            <TabsTrigger
                                key={m}
                                value={m}
                                className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white text-slate-400 font-bold transition-all h-full"
                            >
                                {m}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
                {/* Difficulty Selector */}
                <div className="w-full md:w-48">
                    <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                        <SelectTrigger className="bg-slate-900/80 border-slate-800 text-white h-12 rounded-xl">
                            <div className="flex items-center gap-2">
                                <Bot className="w-4 h-4 text-slate-400" />
                                <SelectValue placeholder="Difficulty" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                            <SelectItem value="easy" className="focus:bg-slate-800">Easy Bot</SelectItem>
                            <SelectItem value="medium" className="focus:bg-slate-800">Medium Bot</SelectItem>
                            <SelectItem value="hard" className="focus:bg-slate-800">Hard Bot</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
        {/* Game Canvas */}
        <div className="border-4 border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            {/* Key prop forces remount on mode or resetKey change to reset physics state */}
            <GameCanvas
                key={`${mode}-${resetKey}`}
                mode={mode}
                winningScore={3}
                botDifficulty={difficulty}
                playerNames={{ red: 'You', blue: 'Bot Team' }}
                onLeave={() => navigate('/')}
                onPlayAgain={handlePlayAgain}
            />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center text-sm text-slate-500">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <Users className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                <p>Teammates are controlled by AI logic.</p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <Zap className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                <p>Physics engine scales to handle multiple collisions.</p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <ArrowLeft className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
                <p>Press 'R' or use on-screen controls to reset.</p>
            </div>
        </div>
      </div>
    </AppLayout>
  );
}