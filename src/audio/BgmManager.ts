/**
 * BgmManager: Singleton Audio Controller for Falling Blocks
 *
 * Implements seamless loop background music playback for Korobeiniki 8-Bit Chiptune.
 * Uses Web Audio API (AudioBufferSourceNode -> GainNode -> destination) with HTMLAudioElement fallback.
 * Strictly adheres to state transition precedence, focus/blur handling, and async disposal safety.
 *
 * Requirements:
 * - Default volume: 40% (effective gain 0.40).
 * - Immediate volume adjustment.
 * - Auto-pause on blur, conditional auto-resume on focus.
 * - Stale blur-pause state cleared unconditionally on any screen transition, non-playing state, or settings update.
 */

export type ScreenType = 'title' | 'game' | 'records' | 'settings';
export type GamePlayStatus = 'ready' | 'playing' | 'paused' | 'game_over' | 'completed';

export interface AudioSettings {
  music_enabled: boolean;
  music_volume: number;
}

let sharedAudioContext: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext | null {
  if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
    return sharedAudioContext;
  }
  if (typeof window === 'undefined') return null;
  const AudioCtxClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return null;
  try {
    sharedAudioContext = new (AudioCtxClass as any)();
  } catch {
    try {
      sharedAudioContext = (AudioCtxClass as any)();
    } catch {
      return null;
    }
  }
  return sharedAudioContext;
}

export function setSharedAudioContextForTest(ctx: AudioContext | null): void {
  sharedAudioContext = ctx;
}

export function resetSharedAudioContextForTest(): void {
  if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
    try {
      void sharedAudioContext.close();
    } catch {
      // Safe ignore
    }
  }
  sharedAudioContext = null;
}

export function unlockAudio(): void {
  const ctx = getSharedAudioContext();
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume();
  }
}

export class BgmManager {
  private static instance: BgmManager | null = null;

  private isInitialized = false;
  private isDisposed = false;
  private isPausedByBlur = false;

  private currentScreen: ScreenType = 'title';
  private currentStatus: GamePlayStatus = 'ready';

  private musicEnabled = true;
  private musicVolume = 40; // 0..100, default 40

  // Audio subsystem
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private audioElement: HTMLAudioElement | null = null;

  // Track position (seconds)
  private pauseOffset = 0;
  private startedAt = 0;
  private isPlaying = false;

  // Async load guard
  private loadSessionId = 0;

  private constructor() {
    // Singleton
  }

  public static getInstance(): BgmManager {
    if (!BgmManager.instance) {
      BgmManager.instance = new BgmManager();
    }
    return BgmManager.instance;
  }

  /**
   * Resets singleton for testing environments.
   */
  public static resetInstanceForTest(): void {
    if (BgmManager.instance) {
      BgmManager.instance.dispose();
      BgmManager.instance = null;
    }
    resetSharedAudioContextForTest();
  }

  public unlockAudioContext(): void {
    unlockAudio();
  }

  /**
   * Initializes event listeners and audio graph. Idempotent.
   */
  public init(initialSettings?: Partial<AudioSettings>): void {
    if (this.isInitialized && !this.isDisposed) {
      if (initialSettings) {
        this.updateSettings(initialSettings);
      }
      return;
    }

    this.isDisposed = false;
    this.isInitialized = true;
    this.isPausedByBlur = false;

    if (initialSettings) {
      if (typeof initialSettings.music_enabled === 'boolean') {
        this.musicEnabled = initialSettings.music_enabled;
      }
      if (typeof initialSettings.music_volume === 'number') {
        this.musicVolume = Math.min(Math.max(initialSettings.music_volume, 0), 100);
      }
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('blur', this.onWindowBlur);
      window.addEventListener('focus', this.onWindowFocus);
      window.addEventListener('pointerdown', unlockAudio, { once: true });
      window.addEventListener('keydown', unlockAudio, { once: true });
    }

    this.loadAudioBuffer();
  }

  /**
   * Disposes audio graph and cleans up all listeners and memory. Idempotent.
   */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.stopPlaybackInternal(true);

    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('blur', this.onWindowBlur);
      window.removeEventListener('focus', this.onWindowFocus);
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        void this.audioContext.close();
      } catch {
        // Safe ignore
      }
    }

    this.audioContext = null;
    this.audioBuffer = null;
    this.gainNode = null;
    this.audioElement = null;

    this.isPausedByBlur = false;
    this.isDisposed = true;
    this.isInitialized = false;
    this.loadSessionId++;
  }

  /**
   * Calculates normalized gain: 0.0 to 1.0. Default 40 produces 0.40.
   */
  public getEffectiveVolume(): number {
    if (!this.musicEnabled) return 0;
    const clamped = Math.min(Math.max(this.musicVolume, 0), 100);
    return clamped / 100.0;
  }

  /**
   * Update audio settings. Unconditionally clears isPausedByBlur.
   */
  public updateSettings(settings: Partial<AudioSettings>): void {
    // Clear blur-pause state unconditionally on ANY settings change
    this.isPausedByBlur = false;

    if (typeof settings.music_enabled === 'boolean') {
      this.musicEnabled = settings.music_enabled;
    }
    if (typeof settings.music_volume === 'number') {
      this.musicVolume = Math.min(Math.max(settings.music_volume, 0), 100);
    }

    const effVol = this.getEffectiveVolume();

    // Apply to Web Audio GainNode
    if (this.gainNode && this.audioContext) {
      try {
        this.gainNode.gain.setValueAtTime(effVol, this.audioContext.currentTime);
      } catch {
        this.gainNode.gain.value = effVol;
      }
    }

    // Apply to fallback HTMLAudioElement
    if (this.audioElement) {
      this.audioElement.volume = effVol;
    }

    // If disabled while playing, pause playback
    if (!this.musicEnabled && this.isPlaying) {
      this.pause();
    } else if (
      this.musicEnabled &&
      this.currentScreen === 'game' &&
      this.currentStatus === 'playing'
    ) {
      if (!this.isPlaying || (!this.sourceNode && !this.audioElement)) {
        this.play();
      }
    }
  }

  /**
   * Screen state synchronization.
   * If transitioning out of 'game', stops music and clears isPausedByBlur.
   */
  public setScreen(screen: ScreenType): void {
    const prev = this.currentScreen;
    this.currentScreen = screen;

    if (screen !== 'game') {
      // Clear blur-pause flag unconditionally on non-game screen transition
      this.isPausedByBlur = false;
      this.stop();
    } else if (prev !== 'game' && this.currentStatus === 'playing') {
      this.play();
    }
  }

  /**
   * GameStatus synchronization inside 'game' screen.
   */
  public setGameStatus(status: GamePlayStatus): void {
    this.currentStatus = status;

    if (this.currentScreen !== 'game') {
      this.stop();
      return;
    }

    switch (status) {
      case 'playing':
        this.play();
        break;
      case 'paused':
        // User manual pause: unconditionally clear isPausedByBlur and preserve position
        this.isPausedByBlur = false;
        this.pause();
        break;
      case 'ready':
      case 'game_over':
      case 'completed':
        // Non-playing status unconditionally clears isPausedByBlur and stops
        this.isPausedByBlur = false;
        this.stop();
        break;
    }
  }

  /**
   * Restarts BGM from beginning (0.0s).
   */
  public restart(): void {
    this.pauseOffset = 0;
    if (this.currentScreen === 'game' && this.currentStatus === 'playing') {
      this.play(true);
    }
  }

  /**
   * Explicit play request.
   */
  public play(fromStart = false): void {
    if (!this.musicEnabled) {
      return;
    }

    if (fromStart) {
      this.pauseOffset = 0;
    }

    this.startPlaybackInternal();
  }

  /**
   * Explicit pause request (preserves offset).
   */
  public pause(): void {
    this.stopPlaybackInternal(false);
  }

  /**
   * Explicit stop request (resets offset to 0).
   */
  public stop(): void {
    this.pauseOffset = 0;
    this.stopPlaybackInternal(true);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getIsPausedByBlur(): boolean {
    return this.isPausedByBlur;
  }

  public getCurrentOffset(): number {
    if (this.isPlaying && this.audioContext && this.audioBuffer) {
      const elapsed = this.audioContext.currentTime - this.startedAt;
      return (this.pauseOffset + elapsed) % this.audioBuffer.duration;
    }
    return this.pauseOffset;
  }

  // --------------------------------------------------------------------------
  // Internal Playback Control
  // --------------------------------------------------------------------------

  private startPlaybackInternal(): void {
    if (!this.musicEnabled) {
      return;
    }
    if (this.isPlaying && (this.sourceNode || this.audioElement)) {
      return;
    }

    const effVol = this.getEffectiveVolume();

    // Try Web Audio API first
    if (this.audioBuffer && this.audioContext) {
      try {
        if (this.audioContext.state === 'suspended') {
          void this.audioContext.resume();
        }

        // Clean up previous source node if any
        if (this.sourceNode) {
          try { this.sourceNode.stop(); } catch { /* ignore */ }
          this.sourceNode.disconnect();
          this.sourceNode = null;
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = this.audioBuffer;
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = this.audioBuffer.duration;

        if (!this.gainNode) {
          this.gainNode = this.audioContext.createGain();
          this.gainNode.connect(this.audioContext.destination);
        }
        this.gainNode.gain.setValueAtTime(effVol, this.audioContext.currentTime);

        source.connect(this.gainNode);

        const duration = this.audioBuffer.duration || 76.8;
        const offset = this.pauseOffset % duration;
        source.start(0, offset);

        this.sourceNode = source;
        this.startedAt = this.audioContext.currentTime;
        this.isPlaying = true;
        return;
      } catch (err) {
        console.warn('Web Audio playback failed, falling back to HTMLAudioElement:', err);
      }
    }

    // HTMLAudioElement Fallback
    if (!this.audioElement && typeof Audio !== 'undefined') {
      try {
        this.audioElement = new Audio('/audio/korobeiniki_8bit.ogg');
        this.audioElement.loop = true;
      } catch {
        // Audio constructor may fail in strict headless environments
      }
    }

    if (this.audioElement) {
      try {
        this.audioElement.volume = effVol;
        if (this.pauseOffset > 0 && Number.isFinite(this.audioElement.duration)) {
          this.audioElement.currentTime = this.pauseOffset % this.audioElement.duration;
        }
        const playPromise = this.audioElement.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            // Ignored in headless/jsdom environments where autoplay or codecs are mocked
          });
        }
      } catch (err) {
        // Ignored in jsdom
      }
      this.isPlaying = true;
      return;
    }

    // Logical playback state in headless/test environments
    this.isPlaying = true;
  }

  private stopPlaybackInternal(resetOffset: boolean): void {
    if (this.isPlaying && this.audioContext && this.audioBuffer) {
      const elapsed = this.audioContext.currentTime - this.startedAt;
      this.pauseOffset = resetOffset ? 0 : (this.pauseOffset + elapsed) % this.audioBuffer.duration;
    } else if (this.audioElement) {
      this.pauseOffset = resetOffset ? 0 : this.audioElement.currentTime;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch {
        // Safe ignore
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioElement) {
      try {
        this.audioElement.pause();
        if (resetOffset) {
          this.audioElement.currentTime = 0;
        }
      } catch {
        // Safe ignore
      }
    }

    this.isPlaying = false;
  }

  private loadAudioBuffer(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const sessionId = ++this.loadSessionId;

    try {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = getSharedAudioContext();
      }
      if (!this.audioContext) {
        return;
      }

      fetch('/audio/korobeiniki_8bit.ogg')
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          return res.arrayBuffer();
        })
        .then((arrayBuffer) => {
          if (this.isDisposed || this.loadSessionId !== sessionId || !this.audioContext) {
            return; // Discard stale load
          }
          return this.audioContext.decodeAudioData(arrayBuffer);
        })
        .then((decoded) => {
          if (this.isDisposed || this.loadSessionId !== sessionId || !decoded) {
            return;
          }
          this.audioBuffer = decoded;
          // If the game is currently playing AND music is enabled, start/attach the audio node
          if (this.musicEnabled && this.currentScreen === 'game' && this.currentStatus === 'playing') {
            if (!this.sourceNode) {
              this.startPlaybackInternal();
            }
          }
        })
        .catch((err) => {
          console.warn('Could not decode Web Audio buffer, fallback will be used:', err);
        });
    } catch (err) {
      console.warn('AudioContext initialization error:', err);
    }
  }

  // --------------------------------------------------------------------------
  // Focus & Blur Listeners
  // --------------------------------------------------------------------------

  private onWindowBlur = (): void => {
    if (this.isPlaying) {
      this.isPausedByBlur = true;
      this.pause();
    }
  };

  private onWindowFocus = (): void => {
    if (
      this.isPausedByBlur &&
      this.currentScreen === 'game' &&
      this.currentStatus === 'playing'
    ) {
      this.play();
    }
    this.isPausedByBlur = false;
  };
}
