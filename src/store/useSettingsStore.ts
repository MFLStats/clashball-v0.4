import { create } from 'zustand';
import { persist } from 'zustand/middleware';
interface SettingsState {
  volume: number;
  showNames: boolean;
  particles: boolean;
  screenShake: boolean;
  setVolume: (volume: number) => void;
  setShowNames: (show: boolean) => void;
  setParticles: (show: boolean) => void;
  setScreenShake: (enabled: boolean) => void;
}
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      volume: 0.5,
      showNames: true,
      particles: true,
      screenShake: true,
      setVolume: (volume) => set({ volume }),
      setShowNames: (showNames) => set({ showNames }),
      setParticles: (particles) => set({ particles }),
      setScreenShake: (screenShake) => set({ screenShake }),
    }),
    {
      name: 'kickstar-settings',
    }
  )
);