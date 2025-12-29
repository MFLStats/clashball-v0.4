import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Settings, Volume2, Monitor, Keyboard, X } from 'lucide-react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SoundEngine } from '@/lib/audio';
interface SettingsDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
export function SettingsDialog({ trigger, open, onOpenChange }: SettingsDialogProps) {
  // STRICT ZUSTAND RULE: Select primitives individually
  const volume = useSettingsStore(s => s.volume);
  const showNames = useSettingsStore(s => s.showNames);
  const particles = useSettingsStore(s => s.particles);
  const setVolume = useSettingsStore(s => s.setVolume);
  const setShowNames = useSettingsStore(s => s.setShowNames);
  const setParticles = useSettingsStore(s => s.setParticles);
  const handleVolumeChange = (vals: number[]) => {
    const newVol = vals[0];
    setVolume(newVol);
    SoundEngine.setVolume(newVol);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-white/10">
            <Settings className="w-6 h-6" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-slate-900/95 backdrop-blur-xl border border-white/10 text-white shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-display font-bold text-white">
            <Settings className="w-6 h-6 text-slate-400" />
            Settings
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="general" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-3 bg-slate-950/50 p-1 rounded-xl border border-white/5">
            <TabsTrigger value="general" className="rounded-lg font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
              <Monitor className="w-4 h-4 mr-2" /> General
            </TabsTrigger>
            <TabsTrigger value="audio" className="rounded-lg font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
              <Volume2 className="w-4 h-4 mr-2" /> Audio
            </TabsTrigger>
            <TabsTrigger value="controls" className="rounded-lg font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
              <Keyboard className="w-4 h-4 mr-2" /> Controls
            </TabsTrigger>
          </TabsList>
          {/* GENERAL SETTINGS */}
          <TabsContent value="general" className="space-y-6 py-4 animate-fade-in">
            <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-white/5">
              <div className="space-y-1">
                <Label htmlFor="show-names" className="text-base font-bold text-white">Show Player Names</Label>
                <p className="text-sm text-slate-400">Display usernames above players during matches.</p>
              </div>
              <Switch
                id="show-names"
                checked={showNames}
                onCheckedChange={setShowNames}
                className="data-[state=checked]:bg-primary"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-white/5">
              <div className="space-y-1">
                <Label htmlFor="particles" className="text-base font-bold text-white">Particle Effects</Label>
                <p className="text-sm text-slate-400">Enable confetti and visual effects (Performance heavy).</p>
              </div>
              <Switch
                id="particles"
                checked={particles}
                onCheckedChange={setParticles}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </TabsContent>
          {/* AUDIO SETTINGS */}
          <TabsContent value="audio" className="space-y-6 py-4 animate-fade-in">
            <div className="p-6 bg-slate-800/30 rounded-xl border border-white/5 space-y-6">
              <div className="flex items-center justify-between">
                <Label className="text-base font-bold text-white">Master Volume</Label>
                <span className="font-mono font-bold text-primary">{Math.round(volume * 100)}%</span>
              </div>
              <Slider
                value={[volume]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="py-4"
              />
              <p className="text-sm text-slate-400 text-center">
                Controls game sound effects (kicks, goals, whistles).
              </p>
            </div>
          </TabsContent>
          {/* CONTROLS DISPLAY */}
          <TabsContent value="controls" className="space-y-4 py-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-800/30 rounded-xl border border-white/5 flex flex-col items-center gap-3">
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
              <div className="p-4 bg-slate-800/30 rounded-xl border border-white/5 flex flex-col items-center gap-3">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Action</span>
                <div className="h-[88px] flex items-center justify-center">
                  <div className="w-32 h-10 rounded bg-slate-700 border-b-4 border-slate-900 flex items-center justify-center font-bold text-white shadow-lg">
                    SPACE
                  </div>
                </div>
                <span className="text-xs text-slate-500">Kick / Shoot</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}