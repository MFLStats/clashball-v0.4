import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { SearchX, Home } from 'lucide-react';
export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <AppLayout container contentClassName="flex items-center justify-center min-h-[80vh]">
      <div className="flex flex-col items-center text-center space-y-8 max-w-md mx-auto animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full animate-pulse" />
          <div className="relative bg-slate-900 p-8 rounded-full border-4 border-slate-800 shadow-2xl">
            <SearchX className="w-24 h-24 text-slate-500" />
          </div>
          <div className="absolute -bottom-4 -right-4 bg-yellow-500 text-slate-900 font-black text-xl px-4 py-2 rounded-xl border-4 border-slate-900 transform rotate-12 shadow-lg">
            404
          </div>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-display font-bold text-white tracking-tight">
            Ball Out of Bounds!
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            The page you're looking for has rolled away or doesn't exist. Let's get you back to the field.
          </p>
        </div>
        <Button 
          size="lg" 
          onClick={() => navigate('/')}
          className="btn-kid-primary h-14 px-8 text-lg shadow-xl shadow-blue-500/20"
        >
          <Home className="w-5 h-5 mr-2" /> Return to Lobby
        </Button>
      </div>
    </AppLayout>
  );
}