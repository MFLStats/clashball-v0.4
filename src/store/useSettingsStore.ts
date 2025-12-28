import { create } from 'zustand';
import { persist } from 'zustand/middleware';
interface SettingsState {
  volume: number;
  showNames: boolean;
  particles: boolean;
  graphicsQuality: 'high' | 'low';
  setVolume: (volume: number) => void;
  setShowNames: (show: boolean) => void;
  setParticles: (show: boolean) => void;
  setGraphicsQuality: (quality: 'high' | 'low') => void;
}
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      volume: 0.5,
      showNames: true,
      particles: true,
      graphicsQuality: 'high',
      setVolume: (volume) => set({ volume }),
      setShowNames: (showNames) => set({ showNames }),
      setParticles: (particles) => set({ particles }),
      setGraphicsQuality: (graphicsQuality) => set({ graphicsQuality }),
    }),
    {
      name: 'kickstar-settings',
    }
  )
);