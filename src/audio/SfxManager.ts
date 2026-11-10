/**
 * SfxManager: Real-time Procedural 8-bit Retro Audio Synthesizer for Falling Blocks
 *
 * Synthesizes all 8 game sound effects procedurally via Web Audio API.
 * Uses the shared AudioContext instance for zero-delay, sub-15ms acoustic response.
 *
 * 8 Sound Effects (1:1 mapping with Rust SfxType):
 * 1. Move: Short crisp blip (35ms, 750Hz square wave)
 * 2. Rotate: High chirp/whir (45ms, 650Hz -> 1250Hz sweep)
 * 3. Lock: Low thud/click (80ms triangle 220Hz -> 55Hz + 15ms transient noise)
 * 4. LineClear: Bright 4-note ascending arpeggio (180ms, C5-E5-G5-C6)
 * 5. Tetris: Grand fanfare arpeggio (450ms, G4-C5-E5-G5-C6-E6)
 * 6. TSpin: Distinct resonant electronic modulation (260ms, Q=6.0 BPF)
 * 7. Hold: Whoosh downward noise sweep (75ms, 3500Hz -> 800Hz BPF)
 * 8. GameOver: Descending minor phrase (650ms, Eb4-D4-Db4-C4 pitch bend)
 */

import { getSharedAudioContext, unlockAudio } from './BgmManager';

export type SfxType =
  | 'Move'
  | 'Rotate'
  | 'Lock'
  | 'LineClear'
  | 'Tetris'
  | 'TSpin'
  | 'Hold'
  | 'GameOver';

export interface SfxSettings {
  sfx_enabled: boolean;
  sfx_volume: number; // 0..100
}

export class SfxManager {
  private static instance: SfxManager | null = null;

  private isInitialized = false;
  private sfxEnabled = true;
  private sfxVolume = 50; // 0..100, default 50

  // Cached noise buffer for noise-based SFX (Hold and Lock click)
  private noiseBuffer: AudioBuffer | null = null;

  private constructor() {
    // Singleton
  }

  public static getInstance(): SfxManager {
    if (!SfxManager.instance) {
      SfxManager.instance = new SfxManager();
    }
    return SfxManager.instance;
  }

  public static resetInstanceForTest(): void {
    if (SfxManager.instance) {
      SfxManager.instance.dispose();
      SfxManager.instance = null;
    }
  }

  public init(initialSettings?: Partial<SfxSettings>): void {
    if (this.isInitialized) {
      if (initialSettings) {
        this.updateSettings(initialSettings);
      }
      return;
    }
    this.isInitialized = true;
    if (initialSettings) {
      this.updateSettings(initialSettings);
    }
  }

  public getInitialized(): boolean {
    return this.isInitialized;
  }

  public dispose(): void {
    this.isInitialized = false;
    this.noiseBuffer = null;
  }

  public updateSettings(settings: Partial<SfxSettings>): void {
    if (typeof settings.sfx_enabled === 'boolean') {
      this.sfxEnabled = settings.sfx_enabled;
    }
    if (typeof settings.sfx_volume === 'number') {
      this.sfxVolume = Math.min(Math.max(settings.sfx_volume, 0), 100);
    }
  }

  public getEffectiveVolume(): number {
    if (!this.sfxEnabled) return 0;
    const clamped = Math.min(Math.max(this.sfxVolume, 0), 100);
    return clamped / 100.0;
  }

  public unlockAudioContext(): void {
    unlockAudio();
  }

  /**
   * Synthesizes and plays the requested sound effect immediately.
   */
  public play(type: SfxType): void {
    const masterVol = this.getEffectiveVolume();
    if (masterVol <= 0) {
      return; // Sound disabled or volume 0
    }

    const ctx = getSharedAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;

    switch (type) {
      case 'Move':
        this.playMove(ctx, now, masterVol);
        break;
      case 'Rotate':
        this.playRotate(ctx, now, masterVol);
        break;
      case 'Lock':
        this.playLock(ctx, now, masterVol);
        break;
      case 'LineClear':
        this.playLineClear(ctx, now, masterVol);
        break;
      case 'Tetris':
        this.playTetris(ctx, now, masterVol);
        break;
      case 'TSpin':
        this.playTSpin(ctx, now, masterVol);
        break;
      case 'Hold':
        this.playHold(ctx, now, masterVol);
        break;
      case 'GameOver':
        this.playGameOver(ctx, now, masterVol);
        break;
    }
  }

  // --------------------------------------------------------------------------
  // Procedural Sound Synthesizers
  // --------------------------------------------------------------------------

  /** 1. Move: Crisp blip (35ms, 750Hz square wave) */
  private playMove(ctx: AudioContext, now: number, masterVol: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(750, now);

    const baseGain = 0.35 * masterVol;
    gain.gain.setValueAtTime(baseGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.036);
  }

  /** 2. Rotate: Pitch sweep chirp (45ms, 650Hz -> 1250Hz) */
  private playRotate(ctx: AudioContext, now: number, masterVol: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(1250, now + 0.045);

    const baseGain = 0.38 * masterVol;
    gain.gain.setValueAtTime(baseGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.046);
  }

  /** 3. Lock: Low thud/click (80ms triangle 220Hz -> 55Hz + 15ms click pulse) */
  private playLock(ctx: AudioContext, now: number, masterVol: number): void {
    // 1. Low thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.08);

    const baseGain = 0.5 * masterVol;
    gain.gain.setValueAtTime(baseGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.081);

    // 2. High-frequency click transient (15ms)
    const noise = this.getOrCreateNoiseBuffer(ctx);
    if (noise) {
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noise;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1500, now);

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0.35 * masterVol, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

      noiseSource.connect(filter);
      filter.connect(clickGain);
      clickGain.connect(ctx.destination);

      noiseSource.start(now);
      noiseSource.stop(now + 0.016);
    }
  }

  /** 4. LineClear: Bright 4-note ascending arpeggio (C5, E5, G5, C6) */
  private playLineClear(ctx: AudioContext, now: number, masterVol: number): void {
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const noteDuration = 0.045; // 45ms per note, total 180ms

    freqs.forEach((freq, idx) => {
      const noteTime = now + idx * noteDuration;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, noteTime);

      const baseGain = 0.4 * masterVol;
      gain.gain.setValueAtTime(baseGain, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + noteDuration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + noteDuration + 0.005);
    });
  }

  /** 5. Tetris: Grand fanfare arpeggio (G4, C5, E5, G5, C6, E6) */
  private playTetris(ctx: AudioContext, now: number, masterVol: number): void {
    const freqs = [392.0, 523.25, 659.25, 783.99, 1046.5, 1318.51]; // G4, C5, E5, G5, C6, E6
    const noteDuration = 0.065; // 65ms per note, total ~450ms

    freqs.forEach((freq, idx) => {
      const noteTime = now + idx * noteDuration;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, noteTime);

      const isLast = idx === freqs.length - 1;
      const sustain = isLast ? 0.15 : noteDuration;
      const baseGain = (isLast ? 0.48 : 0.42) * masterVol;

      gain.gain.setValueAtTime(baseGain, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + sustain);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + sustain + 0.01);
    });
  }

  /** 6. TSpin: Distinct electronic modulation (260ms, resonant BPF sweep) */
  private playTSpin(ctx: AudioContext, now: number, masterVol: number): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.13);
    osc.frequency.linearRampToValueAtTime(500, now + 0.26);

    filter.type = 'bandpass';
    filter.Q.setValueAtTime(6.0, now);
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(2200, now + 0.13);
    filter.frequency.linearRampToValueAtTime(600, now + 0.26);

    const baseGain = 0.42 * masterVol;
    gain.gain.setValueAtTime(baseGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.265);
  }

  /** 7. Hold: Whoosh downward noise sweep (75ms, 3500Hz -> 800Hz BPF) */
  private playHold(ctx: AudioContext, now: number, masterVol: number): void {
    const noise = this.getOrCreateNoiseBuffer(ctx);
    if (!noise) return;

    const source = ctx.createBufferSource();
    source.buffer = noise;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(3.0, now);
    filter.frequency.setValueAtTime(3500, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.075);

    const gain = ctx.createGain();
    const baseGain = 0.38 * masterVol;
    gain.gain.setValueAtTime(baseGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + 0.076);
  }

  /** 8. GameOver: Descending minor phrase (650ms, Eb4-D4-Db4-C4 pitch bend) */
  private playGameOver(ctx: AudioContext, now: number, masterVol: number): void {
    const notes = [311.13, 293.66, 277.18, 261.63]; // Eb4, D4, Db4, C4
    const noteDuration = 0.15; // 150ms per note

    notes.forEach((freq, idx) => {
      const noteTime = now + idx * noteDuration;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, noteTime);

      const isLast = idx === notes.length - 1;
      const sustain = isLast ? 0.25 : noteDuration;
      if (isLast) {
        osc.frequency.exponentialRampToValueAtTime(130, noteTime + sustain);
      }

      const baseGain = 0.45 * masterVol;
      gain.gain.setValueAtTime(baseGain, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + sustain);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + sustain + 0.01);
    });
  }

  /**
   * Helper to generate a 1-second white noise AudioBuffer once and cache it.
   */
  private getOrCreateNoiseBuffer(ctx: AudioContext): AudioBuffer | null {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }

    try {
      const sampleRate = ctx.sampleRate || 44100;
      const buffer = ctx.createBuffer(1, sampleRate, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < sampleRate; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
      return this.noiseBuffer;
    } catch {
      return null;
    }
  }
}

export const sfxManager = SfxManager.getInstance();
