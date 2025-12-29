import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HelpCircle, Keyboard, Gamepad2, Trophy, BookOpen, Move, Zap, Shield, Crown, Users, Scale } from 'lucide-react';
interface HowToPlayDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
export function HowToPlayDialog({ trigger, open, onOpenChange }: HowToPlayDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-white/10">
            <HelpCircle className="w-6 h-6" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-slate-900/95 backdrop-blur-xl border border-white/10 text-white shadow-2xl rounded-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-display font-bold text-white">
            <BookOpen className="w-6 h-6 text-primary" />
            How to Play
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="controls" className="w-full mt-4 flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 bg-slate-950/50 p-1 rounded-xl border border-white/5 shrink-0">
            <TabsTrigger value="controls" className="rounded-lg font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
              <Keyboard className="w-4 h-4 mr-2" /> Controls
            </TabsTrigger>
            <TabsTrigger value="modes" className="rounded-lg font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
              <Gamepad2 className="w-4 h-4 mr-2" /> Modes
            </TabsTrigger>
            <TabsTrigger value="rules" className="rounded-lg font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
              <Trophy className="w-4 h-4 mr-2" /> Rules
            </TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1 mt-4 pr-4">
            {/* CONTROLS TAB */}
            <TabsContent value="controls" className="space-y-6 animate-fade-in">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-blue-400" /> Desktop Controls
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 flex flex-col items-center gap-3">
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Movement</span>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 rounded bg-slate-700 border-b-4 border-slate-900 flex items-center justify-center font-bold text-white shadow-lg">W</div>
                      <div className="flex gap-1">
                        <div className="w-10 h-10 rounded bg-slate-700 border-b-4 border-slate-900 flex items-center justify-center font-bold text-white shadow-lg">A</div>
                        <div className="w-10 h-10 rounded bg-slate-700 border-b-4 border-slate-900 flex items-center justify-center font-bold text-white shadow-lg">S</div>
                        <div className="w-10 h-10 rounded bg-slate-700 border-b-4 border-slate-900 flex items-center justify-center font-bold text-white shadow-lg">D</div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">or Arrow Keys</span>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 flex flex-col items-center gap-3">
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Kick / Shoot</span>
                    <div className="h-[88px] flex items-center justify-center">
                      <div className="w-32 h-10 rounded bg-slate-700 border-b-4 border-slate-900 flex items-center justify-center font-bold text-white shadow-lg">
                        SPACE
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">or X Key</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-emerald-400" /> Mobile Controls
                </h3>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 flex justify-around items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full border-2 border-white/20 bg-slate-900/50 flex items-center justify-center">
                      <Move className="w-6 h-6 text-white/50" />
                    </div>
                    <span className="text-xs font-bold text-slate-400">Virtual Joystick</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full border-4 border-red-900 bg-red-600 flex items-center justify-center shadow-lg">
                      <span className="font-bold text-white text-xs">KICK</span>
                    </div>
                    <span className="text-xs font-bold text-slate-400">Action Button</span>
                  </div>
                </div>
              </div>
            </TabsContent>
            {/* MODES TAB */}
            <TabsContent value="modes" className="space-y-4 animate-fade-in">
              <div className="grid gap-4">
                <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5 flex gap-4 items-start">
                  <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-400">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Ranked Play</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Compete in 1v1, 2v2, 3v3, or 4v4 leagues. Win matches to gain MMR and climb from Bronze to Master tier.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 font-medium bg-emerald-950/30 px-2 py-1 rounded border border-emerald-500/20 w-fit">
                        <Scale className="w-3 h-3" />
                        <span>Fair Team Balancing: Players are sorted by skill to ensure even matches.</span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5 flex gap-4 items-start">
                  <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Custom Lobby</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Create private matches with custom settings (Time Limit, Score Limit, Field Size). Invite friends with a code.
                    </p>
                  </div>
                </div>
                <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5 flex gap-4 items-start">
                  <div className="p-3 bg-orange-500/10 rounded-lg text-orange-400">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Tournament</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Join the Blitz Cup. A single-elimination bracket where only the best player takes home the trophy.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
            {/* RULES TAB */}
            <TabsContent value="rules" className="space-y-6 animate-fade-in">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" /> Core Rules
                </h3>
                <ul className="space-y-3">
                  <li className="flex gap-3 items-start bg-slate-800/30 p-3 rounded-lg border border-white/5">
                    <span className="font-mono font-bold text-primary text-lg">01</span>
                    <p className="text-sm text-slate-300">
                      <strong className="text-white">Scoring:</strong> Hit the ball into the opponent's goal to score. First to reach the score limit wins.
                    </p>
                  </li>
                  <li className="flex gap-3 items-start bg-slate-800/30 p-3 rounded-lg border border-white/5">
                    <span className="font-mono font-bold text-primary text-lg">02</span>
                    <p className="text-sm text-slate-300">
                      <strong className="text-white">Time Limit:</strong> Matches have a set duration (usually 3 mins). If time runs out, the highest score wins.
                    </p>
                  </li>
                  <li className="flex gap-3 items-start bg-slate-800/30 p-3 rounded-lg border border-white/5">
                    <span className="font-mono font-bold text-primary text-lg">03</span>
                    <p className="text-sm text-slate-300">
                      <strong className="text-white">Overtime:</strong> If scores are tied when time expires, the match enters <span className="text-yellow-400 font-bold">Golden Goal</span> mode. Next goal wins instantly.
                    </p>
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-400" /> Ranking System
                </h3>
                <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5 text-sm text-slate-300 space-y-2">
                  <p>
                    KickStar League uses the <strong className="text-white">Glicko-2</strong> rating system.
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-2 text-slate-400">
                    <li>Win matches to gain Rating (MMR).</li>
                    <li>Defeating higher-rated opponents grants more points.</li>
                    <li>New players start in <span className="text-amber-600 font-bold">Bronze</span>.</li>
                    <li>Top 1% of players reach <span className="text-rose-500 font-bold">Master</span> tier.</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}