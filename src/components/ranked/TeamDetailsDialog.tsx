import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TeamProfile } from '@shared/types';
import { Copy, Users, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { RankBadge } from './RankBadge';
interface TeamDetailsDialogProps {
  team: TeamProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
export function TeamDetailsDialog({ team, open, onOpenChange }: TeamDetailsDialogProps) {
  if (!team) return null;
  const copyCode = () => {
    navigator.clipboard.writeText(team.code);
    toast.success('Invite code copied to clipboard!');
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900/95 backdrop-blur-xl border border-white/10 text-white shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl font-display font-bold text-white">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg border border-white/10">
              <Shield className="w-6 h-6 text-white" />
            </div>
            {team.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Rank Info */}
          <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-white/5">
            <div className="flex items-center gap-4">
              <RankBadge tier={team.stats['2v2'].tier} size="md" />
              <div>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Team Rating</div>
                <div className="text-2xl font-mono font-bold text-white">{team.stats['2v2'].rating} MMR</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Record</div>
              <div className="text-lg font-bold text-white">
                <span className="text-emerald-400">{team.stats['2v2'].wins}W</span> - <span className="text-red-400">{team.stats['2v2'].losses}L</span>
              </div>
            </div>
          </div>
          {/* Invite Code */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Invite Code</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  readOnly
                  value={team.code}
                  className="bg-slate-950/50 border-white/10 text-white font-mono text-center text-lg tracking-[0.2em] h-12"
                />
              </div>
              <Button onClick={copyCode} className="h-12 px-6 btn-kid-primary">
                <Copy className="w-4 h-4 mr-2" /> Copy
              </Button>
            </div>
            <p className="text-xs text-slate-500">Share this code with friends to let them join your team.</p>
          </div>
          {/* Roster */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" /> Roster ({team.members.length})
            </label>
            <div className="bg-slate-800/30 rounded-xl border border-white/5 overflow-hidden">
              <div className="max-h-[200px] overflow-y-auto scrollbar-hide">
                {team.members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-white">
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-200">{member.username}</span>
                    {member.id === team.creatorId && (
                      <span className="ml-auto text-[10px] font-bold bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30">
                        LEADER
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}