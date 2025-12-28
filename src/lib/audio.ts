export class SoundEngine {
  private static ctx: AudioContext | null = null;
  private static masterGain: GainNode | null = null;
  private static volume: number = 0.5; // Default volume
  static setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      // Smooth transition to avoid clicks
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }
  static init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume; // Initialize with current volume
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(console.error);
    }
  }
  private static createOscillator(type: OscillatorType, freq: number): OscillatorNode | null {
    if (!this.ctx || !this.masterGain) return null;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    return osc;
  }
  private static createGain(): GainNode | null {
    if (!this.ctx || !this.masterGain) return null;
    const gain = this.ctx.createGain();
    gain.connect(this.masterGain);
    return gain;
  }
  private static createWhiteNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = 2 * this.ctx.sampleRate; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
  static playKick() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.createOscillator('triangle', 150);
    const gain = this.createGain();
    if (osc && gain) {
      osc.connect(gain);
      // Pitch drop for "thud" effect
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
      // Volume envelope
      gain.gain.setValueAtTime(1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  }
  static playWall() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.createOscillator('sine', 800);
    const gain = this.createGain();
    if (osc && gain) {
      osc.connect(gain);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
      osc.start(t);
      osc.stop(t + 0.05);
    }
  }
  static playPlayer() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.createOscillator('square', 200);
    const gain = this.createGain();
    if (osc && gain) {
      osc.connect(gain);
      // Filter to soften the square wave
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      osc.disconnect();
      osc.connect(filter);
      filter.connect(gain);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      osc.start(t);
      osc.stop(t + 0.08);
    }
  }
  static playGoal() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major Arpeggio (C5, E5, G5, C6)
    notes.forEach((freq, i) => {
      const osc = this.createOscillator('triangle', freq);
      const gain = this.createGain();
      if (osc && gain) {
        osc.connect(gain);
        const startTime = t + i * 0.1;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      }
    });
  }
  static playWhistle() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.createOscillator('sine', 2000);
    const gain = this.createGain();
    const lfo = this.ctx.createOscillator(); // For trill effect
    if (osc && gain && lfo) {
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 500; // Modulation depth
      lfo.frequency.value = 15; // Trill speed
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.8, t + 0.05);
      gain.gain.linearRampToValueAtTime(0.8, t + 0.5);
      gain.gain.linearRampToValueAtTime(0, t + 0.8);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + 0.8);
      lfo.stop(t + 0.8);
    }
  }
  static playCrowdCheer() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const buffer = this.createWhiteNoiseBuffer();
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.linearRampToValueAtTime(1000, t + 1.5); // Rising cheer
    const gain = this.createGain();
    if (!gain) return;
    source.connect(filter);
    filter.connect(gain);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 2.0);
    source.start(t);
    source.stop(t + 2.0);
  }
  static playHeavyImpact() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    // 1. Low Frequency Thud
    const osc = this.createOscillator('sine', 80);
    const oscGain = this.createGain();
    if (osc && oscGain) {
      osc.connect(oscGain);
      osc.frequency.exponentialRampToValueAtTime(10, t + 0.2);
      oscGain.gain.setValueAtTime(0.8, t);
      oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    }
    // 2. Short Noise Burst
    const buffer = this.createWhiteNoiseBuffer();
    if (buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const noiseGain = this.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      if (noiseGain) {
        source.connect(filter);
        filter.connect(noiseGain);
        noiseGain.gain.setValueAtTime(0.5, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        source.start(t);
        source.stop(t + 0.1);
      }
    }
  }
}