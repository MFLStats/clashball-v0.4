import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
interface QuickChatProps {
  onSelect: (message: string) => void;
}
const QUICK_CHATS = [
  "Nice Shot!",
  "Great Pass!",
  "Defend!",
  "I got it!",
  "GG",
  "Sorry!",
  "Thanks!",
  "Oops!",
  "What a save!",
  "Close one!"
];
export function QuickChat({ onSelect }: QuickChatProps) {
  return (
    <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
      <div className="flex gap-2 min-w-max px-1">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-slate-400 shrink-0">
            <MessageSquare className="w-4 h-4" />
        </div>
        {QUICK_CHATS.map((msg) => (
          <Button
            key={msg}
            variant="secondary"
            size="sm"
            onClick={() => onSelect(msg)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs h-8 whitespace-nowrap"
          >
            {msg}
          </Button>
        ))}
      </div>
    </div>
  );
}