import React, { useEffect, useState } from 'react';
import { Smartphone, RotateCw } from 'lucide-react';
export function OrientationLock() {
  const [showLock, setShowLock] = useState(false);
  useEffect(() => {
    const checkOrientation = () => {
      // Check if device is in portrait mode
      const isPortrait = window.matchMedia("(orientation: portrait)").matches;
      // Check if device is effectively mobile sized (width < 768px in portrait)
      const isMobileSize = window.innerWidth < 768;
      // Only show lock screen on mobile devices in portrait
      setShowLock(isPortrait && isMobileSize);
    };
    // Initial check
    checkOrientation();
    // Listen for changes
    const mediaQuery = window.matchMedia("(orientation: portrait)");
    const resizeHandler = () => checkOrientation();
    // Modern browsers support addEventListener on MediaQueryList
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", resizeHandler);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(resizeHandler);
    }
    window.addEventListener('resize', resizeHandler);
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", resizeHandler);
      } else {
        mediaQuery.removeListener(resizeHandler);
      }
      window.removeEventListener('resize', resizeHandler);
    };
  }, []);
  if (!showLock) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
      <div className="relative mb-8">
        <Smartphone className="w-24 h-24 text-slate-600" />
        <RotateCw className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 text-haxball-blue animate-spin-slow" />
      </div>
      <h2 className="text-3xl font-display font-bold text-white mb-4">
        Please Rotate Device
      </h2>
      <p className="text-slate-400 text-lg max-w-xs mx-auto">
        KickStar League is designed for landscape mode. Rotate your phone to play!
      </p>
      <div className="mt-12 flex gap-4">
        <div className="w-16 h-10 border-2 border-slate-700 rounded-lg bg-slate-800/50" />
        <div className="w-24 h-10 border-2 border-haxball-blue rounded-lg bg-haxball-blue/20 animate-pulse" />
      </div>
    </div>
  );
}