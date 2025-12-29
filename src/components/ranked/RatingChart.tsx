import React, { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MatchHistoryEntry } from '@shared/types';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
interface RatingChartProps {
  currentRating: number;
  recentMatches: MatchHistoryEntry[];
  className?: string;
}
export function RatingChart({ currentRating, recentMatches, className }: RatingChartProps) {
  const data = useMemo(() => {
    // Start with current rating as the latest point
    const points = [{
      date: 'Now',
      rating: currentRating,
      timestamp: Date.now()
    }];
    let runningRating = currentRating;
    // Iterate backwards through matches to reconstruct history
    // recentMatches is typically sorted newest first
    for (const match of recentMatches) {
      // The rating BEFORE this match was (current - change)
      const prevRating = runningRating - match.ratingChange;
      points.push({
        date: format(match.timestamp, 'MMM d'),
        rating: prevRating,
        timestamp: match.timestamp
      });
      runningRating = prevRating;
    }
    // Reverse to get chronological order (oldest to newest)
    return points.reverse();
  }, [currentRating, recentMatches]);
  if (data.length < 2) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="w-5 h-5 text-primary" />
            Rating History
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-slate-500 italic">
          Play more matches to see your rating trend.
        </CardContent>
      </Card>
    );
  }
  const minRating = Math.min(...data.map(d => d.rating));
  const maxRating = Math.max(...data.map(d => d.rating));
  const domainMin = Math.floor((minRating - 50) / 50) * 50;
  const domainMax = Math.ceil((maxRating + 50) / 50) * 50;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <TrendingUp className="w-5 h-5 text-primary" />
          Rating History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                minTickGap={30}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                domain={[domainMin, domainMax]}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                itemStyle={{ color: '#3b82f6' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area
                type="monotone"
                dataKey="rating"
                stroke="#3b82f6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorRating)"
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}