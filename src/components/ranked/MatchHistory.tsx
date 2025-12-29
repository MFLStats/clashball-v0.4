import React from 'react';
import { MatchHistoryEntry } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
interface MatchHistoryProps {
  matches: MatchHistoryEntry[];
}
export function MatchHistory({ matches }: MatchHistoryProps) {
  if (!matches || matches.length === 0) {
    return (
      <Card className="card-kid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <History className="w-5 h-5 text-slate-400" />
            Recent Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500 italic">
            No matches played yet.
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="card-kid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <History className="w-5 h-5 text-slate-400" />
          Recent Matches
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-800">
          {matches.map((match) => (
            <div key={match.matchId} className="flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-12 rounded-full ${match.result === 'win' ? 'bg-emerald-500' : match.result === 'loss' ? 'bg-red-500' : 'bg-slate-500'}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-lg">
                      {match.result === 'win' ? 'VICTORY' : match.result === 'loss' ? 'DEFEAT' : 'DRAW'}
                    </span>
                    <span className="text-xs font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      {match.mode}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">
                    vs <span className="text-slate-200 font-medium">{match.opponentName}</span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className={`flex items-center justify-end gap-1 font-mono font-bold ${match.ratingChange > 0 ? 'text-emerald-400' : match.ratingChange < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {match.ratingChange > 0 ? <TrendingUp className="w-3 h-3" /> : match.ratingChange < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {match.ratingChange > 0 ? '+' : ''}{match.ratingChange}
                </div>
                <p className="text-xs text-slate-500">
                  {formatDistanceToNow(match.timestamp, { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}