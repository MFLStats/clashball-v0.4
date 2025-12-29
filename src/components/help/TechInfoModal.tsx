import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Server, Globe, Cpu, Zap, Info, Network } from "lucide-react";
export function TechInfoModal({ trigger }: { trigger?: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-2">
            <Info className="w-4 h-4" />
            Tech Specs
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-slate-950 border-slate-800 text-slate-100 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2 text-white">
            <Cpu className="w-6 h-6 text-primary" />
            Under the Hood
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            KickStar League is built on a high-performance, server-authoritative architecture designed for fair competitive play.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {/* Architecture Section */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <Server className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-white">Server-Authoritative Physics</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Unlike P2P games, all physics calculations happen on the server (Cloudflare Durable Objects). 
                This prevents cheating and ensures that what you see is what actually happened, regardless of lag.
              </p>
            </div>
          </div>
          {/* Networking Section */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <Network className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-white">WebSocket Connectivity</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                We use secure WebSockets (WSS) for real-time, bidirectional communication. 
                Inputs are sent to the server, processed, and the authoritative game state is broadcast back at 60Hz.
              </p>
            </div>
          </div>
          {/* Edge Network Section */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
              <Globe className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-white">Global Edge Network</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Game sessions are hosted on Cloudflare's global edge network. 
                While currently centralized for the demo, the architecture supports deploying game logic close to players to minimize latency.
              </p>
            </div>
          </div>
          {/* Performance Section */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
              <Zap className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-white">Client-Side Prediction</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                To make gameplay feel instant, your client predicts movement locally while smoothly interpolating server corrections. 
                This hides network jitter for a buttery-smooth experience.
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={(e) => (e.target as HTMLElement).closest('dialog')?.close()} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}