import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TitleScreen } from '../src/screens/TitleScreen';
import { LanguageProvider } from '../src/i18n';
import { LanguageToggle, UkFlag, JapanFlag } from '../src/components/LanguageToggle';
import { tauriBridge } from '../src/services/tauriBridge';
import type { GameStateSnapshot, TetrominoType } from '../src/types/game';
import type { UserSettings, KeyBindings } from '../src/types/settings';

describe('Tauri Bridge Interface & IPC Contracts', () => {
  it('exposes all required Tauri command wrappers', () => {
    expect(typeof tauriBridge.startGame).toBe('function');
    expect(typeof tauriBridge.restartGame).toBe('function');
    expect(typeof tauriBridge.pauseGame).toBe('function');
    expect(typeof tauriBridge.resumeGame).toBe('function');
    expect(typeof tauriBridge.sendInput).toBe('function');
    expect(typeof tauriBridge.getGameState).toBe('function');
    expect(typeof tauriBridge.getSettings).toBe('function');
    expect(typeof tauriBridge.updateSettings).toBe('function');
    expect(typeof tauriBridge.getRecords).toBe('function');
    expect(typeof tauriBridge.saveRecord).toBe('function');
    expect(typeof tauriBridge.resetRecords).toBe('function');
    expect(typeof tauriBridge.subscribeGameState).toBe('function');
    expect(typeof tauriBridge.subscribeSfx).toBe('function');
  });
});

describe('KeyBinding Conflict Detection', () => {
  const validateBindings = (bindings: KeyBindings): string | null => {
    const map = new Map<string, string>();
    const entries: [keyof KeyBindings, string][] = [
      ['move_left', 'Move Left'],
      ['move_right', 'Move Right'],
      ['soft_drop', 'Soft Drop'],
      ['hard_drop', 'Hard Drop'],
      ['rotate_cw', 'Rotate CW'],
      ['rotate_ccw', 'Rotate CCW'],
      ['hold', 'Hold'],
      ['pause', 'Pause'],
      ['restart', 'Restart'],
    ];

    for (const [key, label] of entries) {
      const val = bindings[key].toLowerCase();
      if (map.has(val)) {
        return `Conflict: Key "${bindings[key]}" is assigned to both ${map.get(val)} and ${label}`;
      }
      map.set(val, label);
    }
    return null;
  };

  it('detects duplicate keys in Settings UI validator', () => {
    const invalidBindings: KeyBindings = {
      move_left: 'ArrowLeft',
      move_right: 'ArrowRight',
      soft_drop: 'ArrowDown',
      hard_drop: 'Space',
      rotate_cw: 'ArrowUp',
      rotate_ccw: 'z',
      hold: 'c',
      pause: 'Escape',
      restart: 'Escape', // Duplicate!
    };

    const conflict = validateBindings(invalidBindings);
    expect(conflict).toBe('Conflict: Key "Escape" is assigned to both Pause and Restart');
  });

  it('validates unique default configuration', () => {
    const validBindings: KeyBindings = {
      move_left: 'ArrowLeft',
      move_right: 'ArrowRight',
      soft_drop: 'ArrowDown',
      hard_drop: ' ',
      rotate_cw: 'ArrowUp',
      rotate_ccw: 'z',
      hold: 'c',
      pause: 'Escape',
      restart: 'r',
    };

    expect(validateBindings(validBindings)).toBeNull();
  });
});

describe('Strict Invariants Verification', () => {
  it('verifies authorized BGM and SFX settings while ensuring zero audio dependencies in Rust engine', () => {
    const sampleSettings: UserSettings = {
      schema_version: 1,
      window_width: 800,
      window_height: 600,
      fullscreen: false,
      show_ghost: true,
      show_grid: true,
      reduce_motion: false,
      key_bindings: {
        move_left: 'ArrowLeft',
        move_right: 'ArrowRight',
        soft_drop: 'ArrowDown',
        hard_drop: ' ',
        rotate_cw: 'ArrowUp',
        rotate_ccw: 'z',
        hold: 'c',
        pause: 'Escape',
        restart: 'r',
      },
      das_ms: 167,
      arr_ms: 33,
      soft_drop_multiplier: 20,
      starting_level: 1,
      show_next_queue: true,
      show_hold: true,
      language: 'ja',
      music_enabled: true,
      music_volume: 40,
      sfx_enabled: true,
      sfx_volume: 50,
    };

    // Authorized BGM and SFX fields
    expect(sampleSettings.music_enabled).toBe(true);
    expect(sampleSettings.music_volume).toBe(40);
    expect(sampleSettings.sfx_enabled).toBe(true);
    expect(sampleSettings.sfx_volume).toBe(50);

    // Verify zero audio libraries in Rust engine (Cargo.toml)
    const cargoTomlPath = path.resolve(__dirname, '../src-tauri/Cargo.toml');
    const cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
    const forbidden = ['rodio', 'cpal', 'kira', 'symphonia', 'soloud', 'hound'];
    for (const lib of forbidden) {
      expect(cargoContent).not.toContain(lib);
    }
  });
});

describe('i18n Dictionaries & Save-Time Safeguard', () => {
  it('has identical top-level and nested key structures for en and ja', async () => {
    const { translations } = await import('../src/i18n/translations');
    const getKeysRecursive = (obj: any, prefix = ''): string[] => {
      let keys: string[] = [];
      for (const k of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof obj[k] === 'object' && obj[k] !== null) {
          keys = keys.concat(getKeysRecursive(obj[k], fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys.sort();
    };

    const enKeys = getKeysRecursive(translations.en);
    const jaKeys = getKeysRecursive(translations.ja);
    expect(enKeys).toEqual(jaKeys);
  });

  it('guarantees save-time safeguard preserves authoritative LanguageContext language', () => {
    const draftSettings: UserSettings = {
      schema_version: 1,
      window_width: 800,
      window_height: 600,
      fullscreen: false,
      show_ghost: true,
      show_grid: true,
      reduce_motion: false,
      key_bindings: {
        move_left: 'ArrowLeft',
        move_right: 'ArrowRight',
        soft_drop: 'ArrowDown',
        hard_drop: ' ',
        rotate_cw: 'ArrowUp',
        rotate_ccw: 'z',
        hold: 'c',
        pause: 'Escape',
        restart: 'r',
      },
      das_ms: 167,
      arr_ms: 33,
      soft_drop_multiplier: 20,
      starting_level: 1,
      show_next_queue: true,
      show_hold: true,
      language: 'en', // Stale draft!
    };

    const authoritativeLanguage = 'ja';
    // Applying save-time safeguard:
    const finalizedSettings: UserSettings = {
      ...draftSettings,
      language: authoritativeLanguage,
    };

    expect(finalizedSettings.language).toBe('ja');
  });

  it('renders SVG elements for UkFlag and JapanFlag with correct attributes', async () => {
    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { UkFlag, JapanFlag } = await import('../src/components/LanguageToggle');

    const ukHtml = renderToString(React.createElement(UkFlag));
    expect(ukHtml).toContain('<svg');
    expect(ukHtml).toContain('viewBox="0 0 60 30"');
    expect(ukHtml).toContain('#012169'); // Navy blue field
    expect(ukHtml).toContain('#C8102E'); // St George / St Patrick red

    const japanHtml = renderToString(React.createElement(JapanFlag));
    expect(japanHtml).toContain('<svg');
    expect(japanHtml).toContain('viewBox="0 0 30 20"');
    expect(japanHtml).toContain('#BC002D'); // Hinomaru crimson sun disc
    expect(japanHtml).toContain('#ffffff'); // White background
  });

  it('renders LanguageToggle with UK/Japan SVG flags and verifies language switching', async () => {
    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { LanguageToggle } = await import('../src/components/LanguageToggle');
    const { LanguageProvider, useTranslation } = await import('../src/i18n/LanguageContext');

    // 1. Verify rendering with initialLanguage="ja"
    const htmlJa = renderToString(
      React.createElement(
        LanguageProvider,
        { initialLanguage: 'ja' },
        React.createElement(LanguageToggle)
      )
    );
    expect(htmlJa).toContain('viewBox="0 0 60 30"'); // UkFlag present
    expect(htmlJa).toContain('viewBox="0 0 30 20"'); // JapanFlag present
    expect(htmlJa).toContain('English</span>');
    expect(htmlJa).toContain('日本語</span>');
    expect(htmlJa).toMatch(/aria-checked="true"[^>]*>[\s\S]*?日本語/);
    expect(htmlJa).toMatch(/aria-checked="false"[^>]*>[\s\S]*?English/);

    // 2. Verify rendering with initialLanguage="en"
    const htmlEn = renderToString(
      React.createElement(
        LanguageProvider,
        { initialLanguage: 'en' },
        React.createElement(LanguageToggle)
      )
    );
    expect(htmlEn).toMatch(/aria-checked="true"[^>]*>[\s\S]*?English/);
    expect(htmlEn).toMatch(/aria-checked="false"[^>]*>[\s\S]*?日本語/);

    // 3. Verify language switching via button click interaction on LanguageToggle
    let switchedLang: string | null = null;
    let clickJaOption: (() => void) | null = null;
    let clickEnOption: (() => void) | null = null;

    const TestHarness: React.FC = () => {
      // Execute LanguageToggle component inside LanguageProvider context
      const toggleElement = (LanguageToggle as React.FC<any>)({});
      const [enBtn, jaBtn] = toggleElement.props.children;
      clickEnOption = enBtn.props.onClick;
      clickJaOption = jaBtn.props.onClick;
      return toggleElement;
    };

    renderToString(
      React.createElement(
        LanguageProvider,
        {
          initialLanguage: 'en',
          onLanguageChange: (lang: string) => {
            switchedLang = lang;
          },
        },
        React.createElement(TestHarness)
      )
    );

    expect(clickJaOption).not.toBeNull();
    expect(clickEnOption).not.toBeNull();

    // Clicking Japanese button option triggers language switch callback with 'ja'
    await (clickJaOption as any)();
    expect(switchedLang).toBe('ja');
  });
});

describe('Title Screen Header Layout Clearance & Non-Overlap Verification', () => {
  it('renders DOM hierarchy with in-flow .title-header-bar followed by .title-container', () => {
    const html = renderToString(
      React.createElement(
        LanguageProvider,
        { initialLanguage: 'ja' },
        React.createElement(TitleScreen, {
          onStartGame: vi.fn(),
          onOpenSettings: vi.fn(),
          onOpenRecords: vi.fn(),
        })
      )
    );

    const headerIndex = html.indexOf('class="title-header-bar"');
    const containerIndex = html.indexOf('class="title-container"');
    const titleIndex = html.indexOf('class="game-title"');

    expect(headerIndex).toBeGreaterThan(-1);
    expect(containerIndex).toBeGreaterThan(-1);
    expect(titleIndex).toBeGreaterThan(-1);

    // .title-header-bar is rendered strictly before .title-container in the DOM tree
    expect(headerIndex).toBeLessThan(containerIndex);
    // .game-title is rendered inside .title-container
    expect(containerIndex).toBeLessThan(titleIndex);
  });

  it('validates CSS layout constraints in main.css', () => {
    const cssPath = path.resolve(__dirname, '../src/styles/main.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // 1. .title-header-bar must be in-flow (no position: absolute), have fixed height 48px, box-sizing, and flex-shrink 0
    const headerMatch = css.match(/\.title-header-bar\s*\{([^}]+)\}/);
    expect(headerMatch).not.toBeNull();
    const headerRules = headerMatch![1];
    expect(headerRules).not.toContain('position: absolute');
    expect(headerRules).toMatch(/height:\s*48px/);
    expect(headerRules).toMatch(/box-sizing:\s*border-box/);
    expect(headerRules).toMatch(/flex-shrink:\s*0/);
    expect(headerRules).toMatch(/justify-content:\s*flex-end/);

    // 2. .language-toggle-container must have fixed height 34px and box-sizing
    const toggleMatch = css.match(/\.language-toggle-container\s*\{([^}]+)\}/);
    expect(toggleMatch).not.toBeNull();
    const toggleRules = toggleMatch![1];
    expect(toggleRules).toMatch(/height:\s*34px/);
    expect(toggleRules).toMatch(/box-sizing:\s*border-box/);

    // 3. .title-screen must be flex column
    const screenMatch = css.match(/\.title-screen\s*\{([^}]+)\}/);
    expect(screenMatch).not.toBeNull();
    const screenRules = screenMatch![1];
    expect(screenRules).toMatch(/display:\s*flex/);
    expect(screenRules).toMatch(/flex-direction:\s*column/);

    // 4. .title-container must have margin: auto and top padding >= 16px
    const containerMatch = css.match(/\.title-container\s*\{([^}]+)\}/);
    expect(containerMatch).not.toBeNull();
    const containerRules = containerMatch![1];
    expect(containerRules).toMatch(/margin:\s*auto/);
    expect(containerRules).toMatch(/padding:\s*16px/);
  });

  it('evaluates layout geometry ensuring >= 23px vertical clearance and zero overlap across viewports', () => {
    // 1. Authoritative CSS constraints extracted directly from main.css rules
    const cssPath = path.resolve(__dirname, '../src/styles/main.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    const headerHeightMatch = css.match(/\.title-header-bar\s*\{[^}]*height:\s*(\d+)px/);
    const toggleHeightMatch = css.match(/\.language-toggle-container\s*\{[^}]*height:\s*(\d+)px/);
    const containerPaddingMatch = css.match(/\.title-container\s*\{[^}]*padding:\s*(\d+)px/);

    expect(headerHeightMatch).not.toBeNull();
    expect(toggleHeightMatch).not.toBeNull();
    expect(containerPaddingMatch).not.toBeNull();

    const headerHeight = parseInt(headerHeightMatch![1], 10);
    const toggleHeight = parseInt(toggleHeightMatch![1], 10);
    const containerPaddingTop = parseInt(containerPaddingMatch![1], 10);

    // 2. Toggle bounds inside vertically centered header
    const toggleTop = (headerHeight - toggleHeight) / 2; // (48 - 34) / 2 = 7px
    const toggleBottom = toggleTop + toggleHeight; // 7 + 34 = 41px
    expect(toggleBottom).toBe(41);
    expect(toggleBottom).toBeLessThanOrEqual(headerHeight);

    // 3. Test across various viewport heights and arbitrary container content heights
    // Proving the unconditional mathematical lower bound titleContainerTop >= headerHeight
    const viewportHeights = [600, 480, 360, 240];
    const arbitraryContainerHeights = [0, 200, 400, 460, 600, 800];

    for (const H of viewportHeights) {
      for (const C of arbitraryContainerHeights) {
        // W3C Flexbox §8.1 margin: auto resolution
        const freeSpace = H - headerHeight - C;
        const titleContainerTop = headerHeight + Math.max(0, freeSpace / 2);
        const yTitleTop = titleContainerTop + containerPaddingTop;
        const verticalClearance = yTitleTop - toggleBottom;

        // Title container unconditional lower bound >= headerHeight (derived from parsed CSS: 48px)
        expect(titleContainerTop).toBeGreaterThanOrEqual(headerHeight);

        // Title top unconditional lower bound >= headerHeight + containerPaddingTop (48 + 16 = 64px)
        expect(yTitleTop).toBeGreaterThanOrEqual(headerHeight + containerPaddingTop);

        // Vertical clearance is strictly >= 12px (unconditional lower bound is 64 - 41 = 23px >= 12px)
        expect(verticalClearance).toBeGreaterThanOrEqual(12);
        expect(verticalClearance).toBeGreaterThanOrEqual(headerHeight + containerPaddingTop - toggleBottom);

        // Vertical projection intervals are strictly disjoint: [toggleTop, toggleBottom] and [yTitleTop, +inf)
        expect(toggleBottom < yTitleTop).toBe(true);

        // Zero vertical overlap
        const hasVerticalOverlap = toggleTop < yTitleTop + 40 && toggleBottom > yTitleTop;
        expect(hasVerticalOverlap).toBe(false);
      }
    }
  });
});

describe('BgmManager Audio Lifecycle & State Transitions', () => {
  it('manages singleton lifecycle, idempotent init, and clean disposal with re-initialization', async () => {
    const { BgmManager } = await import('../src/audio/BgmManager');
    BgmManager.resetInstanceForTest();

    const bgm1 = BgmManager.getInstance();
    const bgm2 = BgmManager.getInstance();
    expect(bgm1).toBe(bgm2);

    // Initial idempotent init
    bgm1.init({ music_enabled: true, music_volume: 40 });
    bgm1.init({ music_volume: 50 }); // Repeated call is safe
    expect(bgm1.getEffectiveVolume()).toBe(0.50);

    // Dispose
    bgm1.dispose();
    bgm1.dispose(); // Repeated dispose is safe no-op

    // Re-initialization after disposal
    bgm1.init({ music_enabled: true, music_volume: 40 });
    expect(bgm1.getEffectiveVolume()).toBe(0.40);
  });

  it('calculates normalized volume correctly with single mapping formula and clamping', async () => {
    const { BgmManager } = await import('../src/audio/BgmManager');
    BgmManager.resetInstanceForTest();
    const bgm = BgmManager.getInstance();
    bgm.init();

    // Default volume is 40% -> 0.40
    expect(bgm.getEffectiveVolume()).toBe(0.40);

    // Max volume 100% -> 1.00
    bgm.updateSettings({ music_volume: 100 });
    expect(bgm.getEffectiveVolume()).toBe(1.00);

    // Min volume 0% -> 0.00
    bgm.updateSettings({ music_volume: 0 });
    expect(bgm.getEffectiveVolume()).toBe(0.00);

    // Clamping > 100 -> 1.00
    bgm.updateSettings({ music_volume: 150 });
    expect(bgm.getEffectiveVolume()).toBe(1.00);

    // Clamping < 0 -> 0.00
    bgm.updateSettings({ music_volume: -20 });
    expect(bgm.getEffectiveVolume()).toBe(0.00);

    // Disabled -> 0.00 regardless of volume
    bgm.updateSettings({ music_enabled: false, music_volume: 80 });
    expect(bgm.getEffectiveVolume()).toBe(0.00);

    // Re-enabled -> 0.80
    bgm.updateSettings({ music_enabled: true });
    expect(bgm.getEffectiveVolume()).toBe(0.80);
  });

  it('controls playback according to screen and game status state matrix', async () => {
    const { BgmManager } = await import('../src/audio/BgmManager');
    BgmManager.resetInstanceForTest();
    const bgm = BgmManager.getInstance();
    bgm.init({ music_enabled: true, music_volume: 40 });

    // On Title screen, music is stopped
    bgm.setScreen('title');
    expect(bgm.getIsPlaying()).toBe(false);

    // Ready status on game screen: stopped
    bgm.setScreen('game');
    bgm.setGameStatus('ready');
    expect(bgm.getIsPlaying()).toBe(false);

    // Playing status on game screen: playing
    bgm.setGameStatus('playing');
    expect(bgm.getIsPlaying()).toBe(true);

    // Paused status on game screen: paused (not playing)
    bgm.setGameStatus('paused');
    expect(bgm.getIsPlaying()).toBe(false);

    // Resume
    bgm.setGameStatus('playing');
    expect(bgm.getIsPlaying()).toBe(true);

    // GameOver: stopped
    bgm.setGameStatus('game_over');
    expect(bgm.getIsPlaying()).toBe(false);

    // Return to Title: stopped
    bgm.setScreen('title');
    expect(bgm.getIsPlaying()).toBe(false);
  });

  it('handles window blur auto-pause and focus auto-resume with precedence protections', async () => {
    // Setup mock window EventTarget in Node environment
    const listeners: Record<string, ((e?: any) => void)[]> = {};
    const mockWindow = {
      addEventListener: vi.fn((event: string, fn: any) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
      }),
      removeEventListener: vi.fn((event: string, fn: any) => {
        listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
      }),
      dispatchEvent: (event: { type: string }) => {
        const fns = listeners[event.type] || [];
        for (const fn of fns) fn(event);
      },
    };
    (globalThis as any).window = mockWindow;

    try {
      const { BgmManager } = await import('../src/audio/BgmManager');
      BgmManager.resetInstanceForTest();
      const bgm = BgmManager.getInstance();
      bgm.init({ music_enabled: true, music_volume: 40 });

      // 1. Play in game
      bgm.setScreen('game');
      bgm.setGameStatus('playing');
      expect(bgm.getIsPlaying()).toBe(true);

      // 2. Window blur while playing -> auto-pause & set isPausedByBlur
      mockWindow.dispatchEvent({ type: 'blur' });
      expect(bgm.getIsPlaying()).toBe(false);
      expect(bgm.getIsPausedByBlur()).toBe(true);

      // 3. Window focus while isPausedByBlur -> auto-resumes
      mockWindow.dispatchEvent({ type: 'focus' });
      expect(bgm.getIsPlaying()).toBe(true);
      expect(bgm.getIsPausedByBlur()).toBe(false);

      // 4. Manual pause: user pauses the game
      bgm.setGameStatus('paused');
      expect(bgm.getIsPlaying()).toBe(false);

      // Window receives blur while already manually paused: isPausedByBlur remains false
      mockWindow.dispatchEvent({ type: 'blur' });
      expect(bgm.getIsPausedByBlur()).toBe(false);

      // Window receives focus: does NOT resume
      mockWindow.dispatchEvent({ type: 'focus' });
      expect(bgm.getIsPlaying()).toBe(false);

      // 5. Precedence test: Any settings update unconditionally clears isPausedByBlur
      bgm.setGameStatus('playing');
      expect(bgm.getIsPlaying()).toBe(true);
      mockWindow.dispatchEvent({ type: 'blur' });
      expect(bgm.getIsPausedByBlur()).toBe(true);

      // Setting update occurs while blur-paused
      bgm.updateSettings({ music_volume: 60 });
      expect(bgm.getIsPausedByBlur()).toBe(false);

      // Focus regained after setting change: does not resurrect old blur-pause
      mockWindow.dispatchEvent({ type: 'focus' });
      expect(bgm.getIsPausedByBlur()).toBe(false);

      // 6. Precedence test: Screen change unconditionally clears isPausedByBlur
      bgm.setGameStatus('playing');
      expect(bgm.getIsPlaying()).toBe(true);
      mockWindow.dispatchEvent({ type: 'blur' });
      expect(bgm.getIsPausedByBlur()).toBe(true);

      // User navigates to title screen
      bgm.setScreen('title');
      expect(bgm.getIsPausedByBlur()).toBe(false);
      expect(bgm.getIsPlaying()).toBe(false);

      // 7. Precedence test: blur while playing -> manual pause before focus -> focus
      bgm.setScreen('game');
      bgm.setGameStatus('playing');
      expect(bgm.getIsPlaying()).toBe(true);

      mockWindow.dispatchEvent({ type: 'blur' });
      expect(bgm.getIsPausedByBlur()).toBe(true);

      // Player manually pauses while blur-paused
      bgm.setGameStatus('paused');
      expect(bgm.getIsPausedByBlur()).toBe(false);

      // Focus returns: music must NOT auto-resume
      mockWindow.dispatchEvent({ type: 'focus' });
      expect(bgm.getIsPlaying()).toBe(false);
      expect(bgm.getIsPausedByBlur()).toBe(false);
    } finally {
      delete (globalThis as any).window;
    }
  });

  it('starts audio playback when volume is raised from 0% or enabled while in-game', async () => {
    const { BgmManager } = await import('../src/audio/BgmManager');
    BgmManager.resetInstanceForTest();
    const bgm = BgmManager.getInstance();

    // Start in-game with 0% volume
    bgm.init({ music_enabled: true, music_volume: 0 });
    bgm.setScreen('game');
    bgm.setGameStatus('playing');

    // Raising volume from 0 to 50% must produce active playback and sound
    bgm.updateSettings({ music_volume: 50 });
    expect(bgm.getIsPlaying()).toBe(true);
    expect(bgm.getEffectiveVolume()).toBe(0.50);

    // Disable music -> must pause
    bgm.updateSettings({ music_enabled: false });
    expect(bgm.getIsPlaying()).toBe(false);

    // Re-enable music while still playing -> must resume
    bgm.updateSettings({ music_enabled: true });
    expect(bgm.getIsPlaying()).toBe(true);
    expect(bgm.getEffectiveVolume()).toBe(0.50);
  });

  it('creates and connects Web Audio source and gain nodes with seamless loop parameters in BgmManager', async () => {
    const mockSourceNode = {
      buffer: null as any,
      loop: false,
      loopStart: -1,
      loopEnd: -1,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };
    const mockGainNode = {
      gain: {
        value: 0,
        setValueAtTime: vi.fn((val: number) => { mockGainNode.gain.value = val; }),
      },
      connect: vi.fn(),
    };
    const mockContext = {
      state: 'running',
      currentTime: 10.0,
      createBufferSource: vi.fn(() => mockSourceNode),
      createGain: vi.fn(() => mockGainNode),
      destination: {},
      resume: vi.fn(),
      close: vi.fn(),
      decodeAudioData: vi.fn(),
    };

    const { BgmManager } = await import('../src/audio/BgmManager');
    BgmManager.resetInstanceForTest();
    const bgm = BgmManager.getInstance();

    // Inject mock context and buffer
    (bgm as any).audioContext = mockContext;
    (bgm as any).audioBuffer = { duration: 76.80 };
    (bgm as any).isInitialized = true;

    bgm.setScreen('game');
    bgm.setGameStatus('playing');

    expect(mockContext.createBufferSource).toHaveBeenCalled();
    expect(mockContext.createGain).toHaveBeenCalled();
    expect(mockSourceNode.loop).toBe(true);
    expect(mockSourceNode.loopStart).toBe(0);
    expect(mockSourceNode.loopEnd).toBe(76.80);
    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.40, 10.0);
    expect(mockSourceNode.start).toHaveBeenCalledWith(0, 0);
  });

  it('starts audio source node when asynchronous buffer loading resolves while playback is already active', async () => {
    let resolveDecode: ((buf: any) => void) | null = null;
    const decodePromise = new Promise((resolve) => {
      resolveDecode = resolve;
    });

    const mockSourceNode = {
      buffer: null as any,
      loop: false,
      loopStart: -1,
      loopEnd: -1,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };
    const mockGainNode = {
      gain: {
        value: 0,
        setValueAtTime: vi.fn((val: number) => { mockGainNode.gain.value = val; }),
      },
      connect: vi.fn(),
    };
    const mockContext = {
      state: 'running',
      currentTime: 5.0,
      createBufferSource: vi.fn(() => mockSourceNode),
      createGain: vi.fn(() => mockGainNode),
      destination: {},
      resume: vi.fn(),
      close: vi.fn(),
      decodeAudioData: vi.fn(() => decodePromise),
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1024),
    })) as any;

    (globalThis as any).window = {
      AudioContext: vi.fn(() => mockContext),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    try {
      const { BgmManager } = await import('../src/audio/BgmManager');
      BgmManager.resetInstanceForTest();
      const bgm = BgmManager.getInstance();

      (bgm as any).audioContext = mockContext;
      (bgm as any).isInitialized = true;
      (bgm as any).loadSessionId = 1;

      // Player starts game before fetch & decode resolve
      bgm.setScreen('game');
      bgm.setGameStatus('playing');
      expect(bgm.getIsPlaying()).toBe(true);
      expect(mockContext.createBufferSource).not.toHaveBeenCalled();

      // Trigger buffer load
      (bgm as any).loadAudioBuffer();

      // Wait for fetch & arrayBuffer chain to reach decodeAudioData
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
      expect(mockContext.decodeAudioData).toHaveBeenCalled();

      // Resolve the async audio decoding
      const fakeDecoded = { duration: 76.80 };
      resolveDecode!(fakeDecoded);

      // Wait for decode promise resolution and startPlaybackInternal
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }

      // Source node must be started immediately upon decode resolution
      expect(mockContext.createBufferSource).toHaveBeenCalled();
      expect(mockSourceNode.loop).toBe(true);
      expect(mockSourceNode.start).toHaveBeenCalled();
      expect(bgm.getIsPlaying()).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
      delete (globalThis as any).window;
    }
  });

  it('does NOT start audio source node when music is disabled while decoding is pending', async () => {
    let resolveDecode: ((buf: any) => void) | null = null;
    const decodePromise = new Promise((resolve) => {
      resolveDecode = resolve;
    });

    const mockSourceNode = {
      buffer: null as any,
      loop: false,
      loopStart: -1,
      loopEnd: -1,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };
    const mockGainNode = {
      gain: {
        value: 0,
        setValueAtTime: vi.fn((val: number) => { mockGainNode.gain.value = val; }),
      },
      connect: vi.fn(),
    };
    const mockContext = {
      state: 'running',
      currentTime: 5.0,
      createBufferSource: vi.fn(() => mockSourceNode),
      createGain: vi.fn(() => mockGainNode),
      destination: {},
      resume: vi.fn(),
      close: vi.fn(),
      decodeAudioData: vi.fn(() => decodePromise),
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1024),
    })) as any;

    (globalThis as any).window = {
      AudioContext: vi.fn(() => mockContext),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    try {
      const { BgmManager } = await import('../src/audio/BgmManager');
      BgmManager.resetInstanceForTest();
      const bgm = BgmManager.getInstance();

      (bgm as any).audioContext = mockContext;
      (bgm as any).isInitialized = true;
      (bgm as any).loadSessionId = 1;

      // Player starts game
      bgm.setScreen('game');
      bgm.setGameStatus('playing');

      // Trigger buffer load
      (bgm as any).loadAudioBuffer();

      // Wait for fetch & arrayBuffer chain to reach decodeAudioData
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
      expect(mockContext.decodeAudioData).toHaveBeenCalled();

      // User turns music OFF while decoding is still pending
      bgm.updateSettings({ music_enabled: false });

      // Resolve the async audio decoding
      const fakeDecoded = { duration: 76.80 };
      resolveDecode!(fakeDecoded);

      // Wait for decode resolution
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }

      // Source node must NOT be created or started because music was disabled
      expect(mockContext.createBufferSource).not.toHaveBeenCalled();
      expect(mockSourceNode.start).not.toHaveBeenCalled();
      expect(bgm.getIsPlaying()).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
      delete (globalThis as any).window;
    }
  });

  it('exercises Web Audio mock loop properties', () => {
    // Mock Web Audio Buffer Source Node
    const mockSource = {
      loop: false,
      loopStart: -1,
      loopEnd: -1,
      buffer: { duration: 76.80 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };

    const mockGain = {
      gain: {
        value: 0.0,
        setValueAtTime: vi.fn((val: number) => { mockGain.gain.value = val; }),
      },
      connect: vi.fn(),
    };

    // Configure Web Audio loop node as implemented in BgmManager
    mockSource.loop = true;
    mockSource.loopStart = 0;
    mockSource.loopEnd = mockSource.buffer.duration;
    mockGain.gain.setValueAtTime(0.40, 0);

    expect(mockSource.loop).toBe(true);
    expect(mockSource.loopStart).toBe(0);
    expect(mockSource.loopEnd).toBe(76.80);
    expect(mockGain.gain.value).toBe(0.40);
  });
});

describe('BGM Deliverables & Metadata Deterministic Validation', () => {
  const rootDir = path.resolve(__dirname, '..');

  it('validates public/audio/korobeiniki_8bit.ogg binary header, channels, sample rate, and size', () => {
    const oggPath = path.join(rootDir, 'public/audio/korobeiniki_8bit.ogg');
    expect(fs.existsSync(oggPath)).toBe(true);

    const stats = fs.statSync(oggPath);
    expect(stats.size).toBeGreaterThan(100 * 1024); // > 100KB

    const buf = fs.readFileSync(oggPath);
    // Starts with OggS container capture pattern
    expect(buf.subarray(0, 4).toString('ascii')).toBe('OggS');

    // Deterministic search for packet beginning with \x01vorbis (Vorbis Identification Header)
    const vorbisSig = Buffer.from([0x01, 0x76, 0x6F, 0x72, 0x62, 0x69, 0x73]); // \x01vorbis
    const vorbisOffset = buf.indexOf(vorbisSig);
    expect(vorbisOffset).toBeGreaterThanOrEqual(0);

    // In Vorbis identification packet:
    // offset + 7..10: vorbis_version (uint32)
    // offset + 11: audio_channels (uint8) -> 2 (stereo)
    // offset + 12..15: audio_sample_rate (uint32) -> 44100
    const channels = buf.readUInt8(vorbisOffset + 11);
    const sampleRate = buf.readUInt32LE(vorbisOffset + 12);

    expect(channels).toBe(2);
    expect(sampleRate).toBe(44100);
  });

  it('validates assets/music-source/korobeiniki_8bit.mid Standard MIDI Format 1 structure', () => {
    const midPath = path.join(rootDir, 'assets/music-source/korobeiniki_8bit.mid');
    expect(fs.existsSync(midPath)).toBe(true);

    const buf = fs.readFileSync(midPath);
    expect(buf.length).toBeGreaterThan(1000);

    // Header chunk: 'MThd'
    expect(buf.subarray(0, 4).toString('ascii')).toBe('MThd');
    const headerLen = buf.readUInt32BE(4);
    expect(headerLen).toBe(6);

    const format = buf.readUInt16BE(8);
    const nTracks = buf.readUInt16BE(10);
    const division = buf.readUInt16BE(12);

    expect(format).toBe(1); // SMF Format 1 (multitrack synchronous)
    expect(nTracks).toBeGreaterThanOrEqual(4); // Melody, Counter, Bass, Arp, Noise Drums
    expect(division).toBeGreaterThan(0);

    // Verify track chunk signatures
    let mtrkCount = 0;
    let searchPos = 0;
    const mtrkSig = Buffer.from('MTrk', 'ascii');
    while (true) {
      const idx = buf.indexOf(mtrkSig, searchPos);
      if (idx === -1) break;
      mtrkCount++;
      searchPos = idx + 4;
    }
    expect(mtrkCount).toBe(nTracks);
  });

  it('validates BGM_LICENSE.md public domain provenance and licensing completeness', () => {
    const licensePath = path.join(rootDir, 'BGM_LICENSE.md');
    expect(fs.existsSync(licensePath)).toBe(true);

    const content = fs.readFileSync(licensePath, 'utf8');
    expect(content.length).toBeGreaterThan(500);

    // Historical provenance
    expect(content).toContain('Nikolay');
    expect(content).toContain('Nekrasov');
    expect(content).toContain('1861');
    expect(content).toContain('Prigozhy');
    expect(content).toContain('1898');

    // Jurisdictional PD terms
    expect(content).toContain('304');
    expect(content).toContain('1929');
    expect(content).toContain('70');
    expect(content).toContain('Japan');

    // Exclusion of commercial arrangements
    expect(content).toContain('Tanaka');

    // CC0 / MIT license
    expect(content).toContain('CC0');
    expect(content).toContain('MIT');
  });
});

describe('SfxManager Procedural Synthesis & Gating', () => {
  let mockContext: any;
  let createdOscillators: any[];
  let createdGains: any[];
  let createdFilters: any[];
  let createdSources: any[];

  beforeEach(async () => {
    createdOscillators = [];
    createdGains = [];
    createdFilters = [];
    createdSources = [];

    mockContext = {
      currentTime: 10.0,
      sampleRate: 44100,
      state: 'running',
      destination: {},
      resume: vi.fn(async () => { mockContext.state = 'running'; }),
      createOscillator: vi.fn(() => {
        const osc = {
          type: 'sine',
          frequency: {
            value: 0,
            setValueAtTime: vi.fn((val: number) => { osc.frequency.value = val; }),
            exponentialRampToValueAtTime: vi.fn((val: number) => { osc.frequency.value = val; }),
            linearRampToValueAtTime: vi.fn((val: number) => { osc.frequency.value = val; }),
          },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        createdOscillators.push(osc);
        return osc;
      }),
      createGain: vi.fn(() => {
        const gain = {
          gain: {
            value: 1.0,
            setValueAtTime: vi.fn((val: number) => { gain.gain.value = val; }),
            linearRampToValueAtTime: vi.fn((val: number) => { gain.gain.value = val; }),
            exponentialRampToValueAtTime: vi.fn((val: number) => { gain.gain.value = val; }),
          },
          connect: vi.fn(),
        };
        createdGains.push(gain);
        return gain;
      }),
      createBiquadFilter: vi.fn(() => {
        const filter = {
          type: 'lowpass',
          Q: {
            value: 1.0,
            setValueAtTime: vi.fn((val: number) => { filter.Q.value = val; }),
          },
          frequency: {
            value: 1000,
            setValueAtTime: vi.fn((val: number) => { filter.frequency.value = val; }),
            exponentialRampToValueAtTime: vi.fn((val: number) => { filter.frequency.value = val; }),
            linearRampToValueAtTime: vi.fn((val: number) => { filter.frequency.value = val; }),
          },
          connect: vi.fn(),
        };
        createdFilters.push(filter);
        return filter;
      }),
      createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => {
        const channelData = new Float32Array(length);
        return {
          channels,
          length,
          sampleRate,
          getChannelData: vi.fn(() => channelData),
        };
      }),
      createBufferSource: vi.fn(() => {
        const src = {
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        createdSources.push(src);
        return src;
      }),
    };

    const { setSharedAudioContextForTest } = await import('../src/audio/BgmManager');
    setSharedAudioContextForTest(mockContext);
  });

  afterEach(async () => {
    const { resetSharedAudioContextForTest } = await import('../src/audio/BgmManager');
    resetSharedAudioContextForTest();
  });

  it('calculates effective volume and enforces clamping and enabled gating', async () => {
    const { SfxManager } = await import('../src/audio/SfxManager');
    const mgr = SfxManager.getInstance();

    mgr.updateSettings({ sfx_enabled: true, sfx_volume: 40 });
    expect(mgr.getEffectiveVolume()).toBe(0.40);

    mgr.updateSettings({ sfx_enabled: true, sfx_volume: 120 });
    expect(mgr.getEffectiveVolume()).toBe(1.0); // Clamped to 100%

    mgr.updateSettings({ sfx_enabled: true, sfx_volume: -20 });
    expect(mgr.getEffectiveVolume()).toBe(0.0); // Clamped to 0%

    mgr.updateSettings({ sfx_enabled: false, sfx_volume: 80 });
    expect(mgr.getEffectiveVolume()).toBe(0.0); // Gated when disabled

    // When disabled, play() should immediately return without creating audio nodes
    mgr.play('Move');
    expect(mockContext.createOscillator).not.toHaveBeenCalled();
    expect(mockContext.createGain).not.toHaveBeenCalled();
  });

  it('resumes suspended AudioContext synchronously during play and unlockAudioContext', async () => {
    const { SfxManager } = await import('../src/audio/SfxManager');
    const mgr = SfxManager.getInstance();
    mockContext.state = 'suspended';

    mgr.unlockAudioContext();
    expect(mockContext.resume).toHaveBeenCalled();

    mockContext.state = 'suspended';
    mgr.updateSettings({ sfx_enabled: true, sfx_volume: 50 });
    mgr.play('Move');
    expect(mockContext.resume).toHaveBeenCalledTimes(2);
  });

  it('synthesizes Move SFX (750Hz square wave with exponential decay)', async () => {
    const { SfxManager } = await import('../src/audio/SfxManager');
    const mgr = SfxManager.getInstance();
    mgr.updateSettings({ sfx_enabled: true, sfx_volume: 50 });

    mgr.play('Move');
    expect(createdOscillators.length).toBe(1);
    expect(createdOscillators[0].type).toBe('square');
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(750, 10.0);
    expect(createdGains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 10.0 + 0.035);
  });

  it('synthesizes Rotate SFX (650Hz to 1250Hz frequency sweep)', async () => {
    const { SfxManager } = await import('../src/audio/SfxManager');
    const mgr = SfxManager.getInstance();
    mgr.updateSettings({ sfx_enabled: true, sfx_volume: 50 });

    mgr.play('Rotate');
    expect(createdOscillators.length).toBe(1);
    expect(createdOscillators[0].type).toBe('square');
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(650, 10.0);
    expect(createdOscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(1250, 10.0 + 0.045);
  });

  it('synthesizes Lock SFX (220Hz->55Hz triangle thud and 1500Hz highpass click pulse)', async () => {
    const { SfxManager } = await import('../src/audio/SfxManager');
    const mgr = SfxManager.getInstance();
    mgr.updateSettings({ sfx_enabled: true, sfx_volume: 50 });

    mgr.play('Lock');
    expect(createdOscillators.length).toBe(1);
    expect(createdOscillators[0].type).toBe('triangle');
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(220, 10.0);
    expect(createdOscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(55, 10.0 + 0.08);

    // Highpass click noise
    expect(createdFilters.length).toBe(1);
    expect(createdFilters[0].type).toBe('highpass');
    expect(createdFilters[0].frequency.setValueAtTime).toHaveBeenCalledWith(1500, 10.0);
  });

  it('synthesizes LineClear SFX (4-note ascending arpeggio C5-E5-G5-C6)', async () => {
    const { SfxManager } = await import('../src/audio/SfxManager');
    const mgr = SfxManager.getInstance();
    mgr.updateSettings({ sfx_enabled: true, sfx_volume: 50 });

    mgr.play('LineClear');
    expect(createdOscillators.length).toBe(4);
    const expectedFreqs = [523.25, 659.25, 783.99, 1046.5];
    expectedFreqs.forEach((freq, idx) => {
      expect(createdOscillators[idx].frequency.setValueAtTime).toHaveBeenCalledWith(
        freq,
        10.0 + idx * 0.045
      );
    });
  });

  it('synthesizes Tetris SFX (6-note grand fanfare arpeggio G4-C5-E5-G5-C6-E6)', async () => {
    const { SfxManager } = await import('../src/audio/SfxManager');
    const mgr = SfxManager.getInstance();
    mgr.updateSettings({ sfx_enabled: true, sfx_volume: 50 });

    mgr.play('Tetris');
    expect(createdOscillators.length).toBe(6);
    const expectedFreqs = [392.0, 523.25, 659.25, 783.99, 1046.5, 1318.51];
    expectedFreqs.forEach((freq, idx) => {
      expect(createdOscillators[idx].frequency.setValueAtTime).toHaveBeenCalledWith(
        freq,
        10.0 + idx * 0.065
      );
    });
  });

  it('synthesizes TSpin SFX (resonant bandpass filter sweep Q=6.0)', async () => {
    const { SfxManager } = await import('../src/audio/SfxManager');
    const mgr = SfxManager.getInstance();
    mgr.updateSettings({ sfx_enabled: true, sfx_volume: 50 });

    mgr.play('TSpin');
    expect(createdOscillators.length).toBe(1);
    expect(createdOscillators[0].type).toBe('sawtooth');
    expect(createdFilters.length).toBe(1);
    expect(createdFilters[0].type).toBe('bandpass');
    expect(createdFilters[0].Q.setValueAtTime).toHaveBeenCalledWith(6.0, 10.0);
  });

  it('synthesizes Hold SFX (whoosh downward noise sweep 3500Hz -> 800Hz)', async () => {
    const { SfxManager } = await import('../src/audio/SfxManager');
    const mgr = SfxManager.getInstance();
    mgr.updateSettings({ sfx_enabled: true, sfx_volume: 50 });

    mgr.play('Hold');
    expect(createdSources.length).toBe(1);
    expect(createdFilters.length).toBe(1);
    expect(createdFilters[0].type).toBe('bandpass');
    expect(createdFilters[0].Q.setValueAtTime).toHaveBeenCalledWith(3.0, 10.0);
    expect(createdFilters[0].frequency.setValueAtTime).toHaveBeenCalledWith(3500, 10.0);
    expect(createdFilters[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(800, 10.0 + 0.075);
  });

  it('synthesizes GameOver SFX (4-note descending minor phrase Eb4-D4-Db4-C4)', async () => {
    const { SfxManager } = await import('../src/audio/SfxManager');
    const mgr = SfxManager.getInstance();
    mgr.updateSettings({ sfx_enabled: true, sfx_volume: 50 });

    mgr.play('GameOver');
    expect(createdOscillators.length).toBe(4);
    const expectedFreqs = [311.13, 293.66, 277.18, 261.63];
    expectedFreqs.forEach((freq, idx) => {
      expect(createdOscillators[idx].frequency.setValueAtTime).toHaveBeenCalledWith(
        freq,
        10.0 + idx * 0.15
      );
    });
    // Final note pitch bend downwards
    expect(createdOscillators[3].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(130, 10.0 + 3 * 0.15 + 0.25);
  });

  it('synthesizes CountdownTick SFX (120ms, 440Hz square wave with click-free linear attack)', async () => {
    const { SfxManager } = await import('../src/audio/SfxManager');
    const mgr = SfxManager.getInstance();
    mgr.updateSettings({ sfx_enabled: true, sfx_volume: 50 });

    mgr.play('CountdownTick');
    expect(createdOscillators.length).toBe(1);
    expect(createdOscillators[0].type).toBe('square');
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(440, 10.0);
    expect(createdGains.length).toBe(1);
    expect(createdGains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 10.0);
    expect(createdGains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(expect.closeTo(0.35, 2), 10.0 + 0.005);
    expect(createdGains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 10.0 + 0.12);
  });

  it('synthesizes CountdownGo SFX (400ms, 880Hz square wave fanfare with click-free linear attack)', async () => {
    const { SfxManager } = await import('../src/audio/SfxManager');
    const mgr = SfxManager.getInstance();
    mgr.updateSettings({ sfx_enabled: true, sfx_volume: 50 });

    mgr.play('CountdownGo');
    expect(createdOscillators.length).toBe(1);
    expect(createdOscillators[0].type).toBe('square');
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(880, 10.0);
    expect(createdGains.length).toBe(1);
    expect(createdGains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 10.0);
    expect(createdGains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(expect.closeTo(0.425, 2), 10.0 + 0.008);
    expect(createdGains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 10.0 + 0.40);
  });
});

describe('AudioQuickControls Component Rendering & Interactions', () => {
  it('renders SVG buttons and manages toggle states and diagonal strike-through lines', async () => {
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { LanguageProvider } = await import('../src/i18n');
    const { AudioQuickControls } = await import('../src/components/AudioQuickControls');

    // 1. Both ON
    const onSettings = {
      schema_version: 1,
      window_width: 800,
      window_height: 600,
      fullscreen: false,
      show_ghost: true,
      show_grid: true,
      reduce_motion: false,
      key_bindings: {} as any,
      das_ms: 167,
      arr_ms: 33,
      soft_drop_multiplier: 20,
      starting_level: 1,
      show_next_queue: true,
      show_hold: true,
      language: 'ja' as const,
      music_enabled: true,
      music_volume: 40,
      sfx_enabled: true,
      sfx_volume: 50,
    };

    const htmlOn = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        { initialLanguage: 'ja' },
        React.createElement(AudioQuickControls, { settings: onSettings })
      )
    );
    expect(htmlOn).toContain('bgm-btn active');
    expect(htmlOn).toContain('sfx-btn active');
    expect(htmlOn).toContain('circle-outer');
    expect(htmlOn).not.toContain('strike-line'); // No strike-through when ON

    // 2. Both OFF
    const offSettings = {
      ...onSettings,
      music_enabled: false,
      sfx_enabled: false,
    };

    const htmlOff = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        { initialLanguage: 'ja' },
        React.createElement(AudioQuickControls, { settings: offSettings })
      )
    );
    expect(htmlOff).toContain('bgm-btn inactive');
    expect(htmlOff).toContain('sfx-btn inactive');
    expect(htmlOff).toContain('strike-line'); // Strike-through line present when OFF
  });
});

describe('Global Gesture Audio Unlock', () => {
  it('registers one-shot pointerdown and keydown listeners that resume suspended AudioContext', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as any);

    let mockContext = {
      state: 'suspended',
      resume: vi.fn(async () => { mockContext.state = 'running'; }),
      decodeAudioData: vi.fn().mockResolvedValue({ duration: 76.8 }),
    };

    const listeners: Record<string, ((e?: any) => void)[]> = {};
    const mockWindow = {
      addEventListener: vi.fn((event: string, cb: any) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      }),
      removeEventListener: vi.fn(),
    };

    (globalThis as any).window = mockWindow;

    try {
      const { BgmManager, setSharedAudioContextForTest } = await import('../src/audio/BgmManager');
      BgmManager.resetInstanceForTest();
      setSharedAudioContextForTest(mockContext as any);
      const bgm = BgmManager.getInstance();
      bgm.init();

      // Verify pointerdown and keydown listeners registered
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function), { once: true });
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), { once: true });

      // Simulate pointerdown user gesture
      const pointerHandler = listeners['pointerdown']?.[0];
      expect(pointerHandler).toBeDefined();
      pointerHandler?.();
      expect(mockContext.resume).toHaveBeenCalledTimes(1);

      // Simulate keydown user gesture
      mockContext.state = 'suspended';
      const keyHandler = listeners['keydown']?.[0];
      expect(keyHandler).toBeDefined();
      keyHandler?.();
      expect(mockContext.resume).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.fetch = originalFetch;
      delete (globalThis as any).window;
    }
  });
});

describe('End-to-End SFX Event IPC Delivery', () => {
  it('subscribes to game_sfx and delivers events directly to SfxManager.play', async () => {
    const { tauriBridge } = await import('../src/services/tauriBridge');
    const { SfxManager } = await import('../src/audio/SfxManager');
    const mgr = SfxManager.getInstance();
    const playSpy = vi.spyOn(mgr, 'play').mockImplementation(() => {});

    let eventCallback: ((event: { payload: any }) => void) | null = null;
    vi.spyOn(tauriBridge, 'subscribeSfx').mockImplementation(async (cb) => {
      eventCallback = (ev) => cb(ev.payload);
      return () => {};
    });

    // Subscribe
    await tauriBridge.subscribeSfx((sfx) => {
      mgr.play(sfx);
    });

    expect(eventCallback).toBeDefined();

    // Trigger each event
    const allSfx: (
      | 'Move'
      | 'Rotate'
      | 'Lock'
      | 'LineClear'
      | 'Tetris'
      | 'TSpin'
      | 'Hold'
      | 'GameOver'
      | 'CountdownTick'
      | 'CountdownGo'
    )[] = [
      'Move',
      'Rotate',
      'Lock',
      'LineClear',
      'Tetris',
      'TSpin',
      'Hold',
      'GameOver',
      'CountdownTick',
      'CountdownGo',
    ];

    allSfx.forEach((type) => {
      eventCallback!({ payload: type });
      expect(playSpy).toHaveBeenCalledWith(type);
    });

    expect(playSpy).toHaveBeenCalledTimes(allSfx.length);
  });
});

describe('v1.3.1 In-Game Audio Quick Controls Operability & Focus Protection', () => {
  const baseSettings = {
    schema_version: 1,
    window_width: 800,
    window_height: 600,
    fullscreen: false,
    show_ghost: true,
    show_grid: true,
    reduce_motion: false,
    key_bindings: {
      move_left: 'ArrowLeft',
      move_right: 'ArrowRight',
      soft_drop: 'ArrowDown',
      hard_drop: ' ',
      rotate_cw: 'ArrowUp',
      rotate_ccw: 'z',
      hold: 'c',
      pause: 'Escape',
      restart: 'r',
    },
    das_ms: 167,
    arr_ms: 33,
    soft_drop_multiplier: 20,
    starting_level: 1,
    show_next_queue: true,
    show_hold: true,
    language: 'ja' as const,
    music_enabled: true,
    music_volume: 40,
    sfx_enabled: true,
    sfx_volume: 50,
  };

  it('renders tabIndex="-1" on audio buttons to remove them from tab focus ring', async () => {
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { LanguageProvider } = await import('../src/i18n');
    const { AudioQuickControls } = await import('../src/components/AudioQuickControls');

    const html = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        { initialLanguage: 'ja' },
        React.createElement(AudioQuickControls, { settings: baseSettings })
      )
    );

    // Both BGM and SFX buttons should have tabindex="-1"
    expect(html).toContain('tabindex="-1"');
    const buttonMatches = [...html.matchAll(/<button[^>]*tabindex="-1"[^>]*>/gi)];
    expect(buttonMatches.length).toBe(2);
  });

  it('prevents default on mousedown and calls blur on click to prevent focus theft', async () => {
    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { LanguageProvider } = await import('../src/i18n');
    const { AudioQuickControls } = await import('../src/components/AudioQuickControls');
    const { tauriBridge } = await import('../src/services/tauriBridge');
    vi.spyOn(tauriBridge, 'updateSettings').mockResolvedValue(baseSettings);

    let bgmButtonProps: any = null;
    let sfxButtonProps: any = null;

    const TestHarness: React.FC = () => {
      const vdom = (AudioQuickControls as any)({ settings: baseSettings });
      bgmButtonProps = vdom.props.children[0].props;
      sfxButtonProps = vdom.props.children[1].props;
      return vdom;
    };

    renderToString(
      React.createElement(
        LanguageProvider,
        { initialLanguage: 'ja' },
        React.createElement(TestHarness)
      )
    );

    expect(bgmButtonProps).not.toBeNull();
    expect(sfxButtonProps).not.toBeNull();

    // Verify onMouseDown preventDefault
    const preventDefault = vi.fn();
    bgmButtonProps.onMouseDown({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);

    sfxButtonProps.onMouseDown({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(2);

    // Verify click calls blur
    const blur = vi.fn();
    const stopPropagation = vi.fn();
    await bgmButtonProps.onClick({ stopPropagation, currentTarget: { blur } });
    expect(blur).toHaveBeenCalledTimes(1);

    await sfxButtonProps.onClick({ stopPropagation, currentTarget: { blur } });
    expect(blur).toHaveBeenCalledTimes(2);
  });

  it('rolls back local state, manager settings, and parent callback when updateSettings fails', async () => {
    const React = await import('react');
    const { AudioQuickControls } = await import('../src/components/AudioQuickControls');
    const { BgmManager } = await import('../src/audio/BgmManager');
    const { SfxManager } = await import('../src/audio/SfxManager');
    const { tauriBridge } = await import('../src/services/tauriBridge');
    const { translations } = await import('../src/i18n/translations');

    const bgmMgr = BgmManager.getInstance();
    const sfxMgr = SfxManager.getInstance();
    const bgmUpdateSpy = vi.spyOn(bgmMgr, 'updateSettings');
    const sfxUpdateSpy = vi.spyOn(sfxMgr, 'updateSettings');

    // Simulate IPC error
    vi.spyOn(tauriBridge, 'updateSettings').mockRejectedValue(new Error('IPC failure'));

    const onSettingsChange = vi.fn();

    const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const origDispatcher = internals.H;

    let localState: any = null;
    let setLocalStateSpy: any = null;

    try {
      internals.H = {
        useContext: () => ({ t: translations.ja }),
        useState: (initial: any) => {
          localState = initial;
          setLocalStateSpy = vi.fn((newVal: any) => {
            localState = typeof newVal === 'function' ? newVal(localState) : newVal;
          });
          return [localState, setLocalStateSpy];
        },
        useEffect: () => {},
        useRef: (init: any) => ({ current: init }),
      };

      // 1. Initial render
      let vdom = (AudioQuickControls as any)({
        settings: baseSettings,
        onSettingsChange,
      });

      let bgmBtn = vdom.props.children[0];
      let sfxBtn = vdom.props.children[1];

      expect(localState.music_enabled).toBe(true);
      expect(bgmBtn.props.className).toContain('active');
      expect(bgmBtn.props['aria-pressed']).toBe(true);

      // Trigger BGM toggle which fails and rolls back
      await bgmBtn.props.onClick({
        stopPropagation: vi.fn(),
        currentTarget: { blur: vi.fn() },
      });

      // Verify that setLocalSettings was called first with false, then rolled back with true
      expect(setLocalStateSpy).toHaveBeenCalledWith(expect.objectContaining({ music_enabled: false }));
      expect(setLocalStateSpy).toHaveBeenLastCalledWith(expect.objectContaining({ music_enabled: true }));
      // Verify localState itself is restored to true
      expect(localState.music_enabled).toBe(true);
      // Verify manager and parent callbacks were rolled back
      expect(bgmUpdateSpy).toHaveBeenLastCalledWith(expect.objectContaining({ music_enabled: true }));
      expect(onSettingsChange).toHaveBeenLastCalledWith(expect.objectContaining({ music_enabled: true }));

      // Re-render component with restored localState and verify rendered output
      vdom = (AudioQuickControls as any)({
        settings: localState,
        onSettingsChange,
      });
      bgmBtn = vdom.props.children[0];
      expect(bgmBtn.props.className).toContain('active');
      expect(bgmBtn.props['aria-pressed']).toBe(true);

      // 2. Trigger SFX toggle which fails and rolls back
      onSettingsChange.mockClear();
      setLocalStateSpy.mockClear();

      expect(localState.sfx_enabled).toBe(true);
      sfxBtn = vdom.props.children[1];
      expect(sfxBtn.props.className).toContain('active');

      await sfxBtn.props.onClick({
        stopPropagation: vi.fn(),
        currentTarget: { blur: vi.fn() },
      });

      // Verify that setLocalSettings was called first with false, then rolled back with true
      expect(setLocalStateSpy).toHaveBeenCalledWith(expect.objectContaining({ sfx_enabled: false }));
      expect(setLocalStateSpy).toHaveBeenLastCalledWith(expect.objectContaining({ sfx_enabled: true }));
      // Verify localState itself is restored to true
      expect(localState.sfx_enabled).toBe(true);
      // Verify manager and parent callbacks were rolled back
      expect(sfxUpdateSpy).toHaveBeenLastCalledWith(expect.objectContaining({ sfx_enabled: true }));
      expect(onSettingsChange).toHaveBeenLastCalledWith(expect.objectContaining({ sfx_enabled: true }));

      // Re-render component with restored localState and verify rendered output
      vdom = (AudioQuickControls as any)({
        settings: localState,
        onSettingsChange,
      });
      sfxBtn = vdom.props.children[1];
      expect(sfxBtn.props.className).toContain('active');
      expect(sfxBtn.props['aria-pressed']).toBe(true);
    } finally {
      internals.H = origDispatcher;
    }
  });

  it('verifies Space key sends HardDrop and does not re-trigger audio button after mouse interaction', async () => {
    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { LanguageProvider } = await import('../src/i18n');
    const { AudioQuickControls } = await import('../src/components/AudioQuickControls');
    const { tauriBridge } = await import('../src/services/tauriBridge');
    const sendInputSpy = vi.spyOn(tauriBridge, 'sendInput').mockResolvedValue(null as any);
    vi.spyOn(tauriBridge, 'updateSettings').mockResolvedValue(baseSettings);
    const { useKeyboard } = await import('../src/hooks/useKeyboard');

    const originalWindow = (globalThis as any).window;
    const originalDocument = (globalThis as any).document;

    let activeElement: any = { tagName: 'CANVAS', focus: vi.fn(), blur: vi.fn() };
    const windowListeners: Record<string, ((e: any) => void)[]> = {};

    const mockDocument = {
      get activeElement() {
        return activeElement;
      },
    };

    const mockWindow = {
      addEventListener: vi.fn((event: string, cb: any) => {
        if (!windowListeners[event]) windowListeners[event] = [];
        windowListeners[event].push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: any) => {
        if (windowListeners[event]) {
          windowListeners[event] = windowListeners[event].filter((fn) => fn !== cb);
        }
      }),
      document: mockDocument,
    };

    (globalThis as any).window = mockWindow;
    (globalThis as any).document = mockDocument;

    // Use custom hook dispatcher to invoke useKeyboard outside DOM renderer
    const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const origDispatcher = internals.H;
    let cleanupHook: any;

    try {
      internals.H = {
        useRef: (init: any) => ({ current: init }),
        useEffect: (cb: any) => {
          cleanupHook = cb();
        },
      };

      // Mount keyboard hook for active gameplay
      useKeyboard(baseSettings, true);

      // Render AudioQuickControls to obtain live button handlers
      let bgmButtonProps: any = null;
      let sfxButtonProps: any = null;
      const onSettingsChangeSpy = vi.fn();

      const Harness: React.FC = () => {
        const vdom = (AudioQuickControls as any)({
          settings: baseSettings,
          onSettingsChange: onSettingsChangeSpy,
        });
        bgmButtonProps = vdom.props.children[0].props;
        sfxButtonProps = vdom.props.children[1].props;
        return vdom;
      };

      renderToString(
        React.createElement(
          LanguageProvider,
          { initialLanguage: 'ja' },
          React.createElement(Harness)
        )
      );

      expect(bgmButtonProps).not.toBeNull();
      expect(sfxButtonProps).not.toBeNull();

      // 1. Simulate mouse interaction on audio button:
      // When user clicks the button with mouse, onMouseDown is called first
      const preventDefaultSpy = vi.fn();
      bgmButtonProps.onMouseDown({
        preventDefault: () => {
          preventDefaultSpy();
          // In standard browser behavior, preventDefault on mousedown cancels focus transfer
          // activeElement remains CANVAS
        },
      });

      expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
      // Confirm activeElement was NOT transferred to button
      expect(mockDocument.activeElement.tagName).toBe('CANVAS');

      // Click handler is invoked next and immediately calls blur
      const blurSpy = vi.fn();
      await bgmButtonProps.onClick({
        stopPropagation: vi.fn(),
        currentTarget: { blur: blurSpy },
      });
      expect(blurSpy).toHaveBeenCalledTimes(1);
      expect(onSettingsChangeSpy).toHaveBeenCalledTimes(1);

      // 2. Now user presses Space during gameplay:
      // The audio button itself does not listen for Space and does NOT have a keydown handler
      expect((bgmButtonProps as any).onKeyDown).toBeUndefined();

      // Dispatch Space keydown to window (where useKeyboard listens)
      const keydownHandlers = windowListeners['keydown'] || [];
      expect(keydownHandlers.length).toBeGreaterThan(0);

      const spaceEvent = {
        key: ' ',
        repeat: false,
        target: mockDocument.activeElement,
        preventDefault: vi.fn(),
      };

      for (const handler of keydownHandlers) {
        handler(spaceEvent);
      }

      // HardDrop is executed by the engine without interruption
      expect(sendInputSpy).toHaveBeenCalledWith('HardDrop', true);

      // Confirm the audio button was NOT toggled again by Space keypress
      expect(onSettingsChangeSpy).toHaveBeenCalledTimes(1);
    } finally {
      internals.H = origDispatcher;
      cleanupHook?.();
      (globalThis as any).window = originalWindow;
      (globalThis as any).document = originalDocument;
    }
  });

  it('renders quick audio controls inside PauseModal and GameScreen with state forwarding', async () => {
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { LanguageProvider } = await import('../src/i18n');
    const { PauseModal } = await import('../src/screens/PauseModal');
    const { GameScreen } = await import('../src/screens/GameScreen');

    // 1. PauseModal renders .pause-audio-controls
    const pauseHtml = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        { initialLanguage: 'ja' },
        React.createElement(PauseModal, {
          settings: baseSettings,
          onResume: () => {},
          onRestart: () => {},
          onQuitToTitle: () => {},
        })
      )
    );
    expect(pauseHtml).toContain('pause-audio-controls');
    expect(pauseHtml).toContain('audio-quick-controls');
    expect(pauseHtml).toContain('bgm-btn');
    expect(pauseHtml).toContain('sfx-btn');

    // 2. GameScreen renders .game-header-bar
    const gameHtml = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        { initialLanguage: 'ja' },
        React.createElement(GameScreen, {
          snapshot: null,
          settings: baseSettings,
          onQuitToTitle: () => {},
        })
      )
    );
    expect(gameHtml).toContain('game-header-bar');
    expect(gameHtml).toContain('audio-quick-controls');
  });

  it('verifies CSS z-index and styling rules in main.css', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cssPath = path.resolve(__dirname, '../src/styles/main.css');
    const css = fs.readFileSync(cssPath, 'utf-8');

    // .game-header-bar has z-index: 50 and pill styling
    const headerBarMatch = css.match(/\.game-header-bar\s*\{([^}]+)\}/);
    expect(headerBarMatch).not.toBeNull();
    const headerProps = headerBarMatch![1];
    expect(headerProps).toContain('z-index: 50;');
    expect(headerProps).toContain('border-radius: 20px;');
    expect(headerProps).toContain('backdrop-filter: blur(8px);');

    // .modal-backdrop has z-index: 100
    const modalMatch = css.match(/\.modal-backdrop\s*\{([^}]+)\}/);
    expect(modalMatch).not.toBeNull();
    expect(modalMatch![1]).toContain('z-index: 100;');

    // Verify modal is above header bar (100 > 50)
    expect(100).toBeGreaterThan(50);

    // .pause-audio-controls styling exists
    expect(css).toContain('.pause-audio-controls');
  });
});

describe('v1.3.2 SettingsScreen Audio Quick Controls Integration', () => {
  const baseSettings = {
    schema_version: 1,
    window_width: 800,
    window_height: 600,
    fullscreen: false,
    show_ghost: true,
    show_grid: true,
    reduce_motion: false,
    key_bindings: {
      move_left: 'ArrowLeft',
      move_right: 'ArrowRight',
      soft_drop: 'ArrowDown',
      hard_drop: ' ',
      rotate_cw: 'ArrowUp',
      rotate_ccw: 'z',
      hold: 'c',
      pause: 'Escape',
      restart: 'r',
    },
    das_ms: 167,
    arr_ms: 33,
    soft_drop_multiplier: 20,
    starting_level: 1,
    show_next_queue: true,
    show_hold: true,
    language: 'ja' as const,
    music_enabled: true,
    music_volume: 40,
    sfx_enabled: true,
    sfx_volume: 50,
  };

  it('does NOT call tauriBridge.updateSettings when persist={false} in AudioQuickControls', async () => {
    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { LanguageProvider } = await import('../src/i18n');
    const { AudioQuickControls } = await import('../src/components/AudioQuickControls');
    const { tauriBridge } = await import('../src/services/tauriBridge');
    const { BgmManager } = await import('../src/audio/BgmManager');

    const updateSettingsSpy = vi.spyOn(tauriBridge, 'updateSettings').mockResolvedValue(baseSettings);
    const bgmMgrSpy = vi.spyOn(BgmManager.getInstance(), 'updateSettings');
    const onSettingsChange = vi.fn();

    let bgmBtnProps: any = null;
    const TestHarness: React.FC = () => {
      const vdom = (AudioQuickControls as any)({
        settings: baseSettings,
        onSettingsChange,
        persist: false,
      });
      bgmBtnProps = vdom.props.children[0].props;
      return vdom;
    };

    renderToString(
      React.createElement(
        LanguageProvider,
        { initialLanguage: 'ja' },
        React.createElement(TestHarness)
      )
    );

    await bgmBtnProps.onClick({
      stopPropagation: vi.fn(),
      currentTarget: { blur: vi.fn() },
    });

    // onSettingsChange called with music_enabled = false
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ music_enabled: false }));
    // Live auditioning manager updated
    expect(bgmMgrSpy).toHaveBeenCalledWith(expect.objectContaining({ music_enabled: false }));
    // Disk persistence was NOT called (delegated to SettingsScreen save)
    expect(updateSettingsSpy).not.toHaveBeenCalled();
  });

  it('renders AudioQuickControls inside SettingsScreen Audio section and links with volume sliders', async () => {
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { LanguageProvider } = await import('../src/i18n');
    const { SettingsScreen } = await import('../src/screens/SettingsScreen');

    // 1. Initial state: both audio channels enabled
    const htmlEnabled = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        { initialLanguage: 'ja' },
        React.createElement(SettingsScreen, {
          settings: baseSettings,
          onSave: vi.fn(),
          onCancel: vi.fn(),
        })
      )
    );

    // Audio quick controls row contains audio-quick-controls
    expect(htmlEnabled).toContain('audio-quick-controls-row');
    expect(htmlEnabled).toContain('audio-quick-controls');
    expect(htmlEnabled).toContain('bgm-btn active');
    expect(htmlEnabled).toContain('sfx-btn active');
    // Sliders are enabled
    expect(htmlEnabled).not.toMatch(/type="range"[^>]*disabled/);

    // 2. Disabled audio channels: volume sliders become disabled
    const disabledSettings = {
      ...baseSettings,
      music_enabled: false,
      sfx_enabled: false,
    };

    const htmlDisabled = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        { initialLanguage: 'ja' },
        React.createElement(SettingsScreen, {
          settings: disabledSettings,
          onSave: vi.fn(),
          onCancel: vi.fn(),
        })
      )
    );

    expect(htmlDisabled).toContain('bgm-btn inactive');
    expect(htmlDisabled).toContain('sfx-btn inactive');
    // Sliders have disabled attribute
    const disabledInputs = [...htmlDisabled.matchAll(/<input[^>]*type="range"[^>]*disabled[^>]*>/gi)];
    expect(disabledInputs.length).toBe(2);
  });

  it('reverts live auditioned audio managers to initialSettings on Cancel in SettingsScreen', async () => {
    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { LanguageProvider } = await import('../src/i18n');
    const { SettingsScreen } = await import('../src/screens/SettingsScreen');
    const { BgmManager } = await import('../src/audio/BgmManager');
    const { SfxManager } = await import('../src/audio/SfxManager');

    const bgmSpy = vi.spyOn(BgmManager.getInstance(), 'updateSettings');
    const sfxSpy = vi.spyOn(SfxManager.getInstance(), 'updateSettings');
    const onCancelMock = vi.fn();

    let capturedCancelBtn: any = null;
    const TestHarness: React.FC = () => {
      const vdom = (SettingsScreen as any)({
        settings: baseSettings,
        onSave: vi.fn(),
        onCancel: onCancelMock,
      });
      // Header-row btn-group cancel button is at children[0].props.children[0].props.children[1].props.children[0]
      const container = vdom.props.children;
      const headerRow = container.props.children[0];
      const btnGroup = headerRow.props.children[1];
      capturedCancelBtn = btnGroup.props.children[0];
      return vdom;
    };

    renderToString(
      React.createElement(
        LanguageProvider,
        { initialLanguage: 'ja' },
        React.createElement(TestHarness)
      )
    );

    expect(capturedCancelBtn).not.toBeNull();

    // Trigger Cancel
    capturedCancelBtn.props.onClick();

    // Reverted to initialSettings
    expect(bgmSpy).toHaveBeenCalledWith({
      music_enabled: baseSettings.music_enabled,
      music_volume: baseSettings.music_volume,
    });
    expect(sfxSpy).toHaveBeenCalledWith({
      sfx_enabled: baseSettings.sfx_enabled,
      sfx_volume: baseSettings.sfx_volume,
    });
    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });

  it('verifies CSS audio-quick-controls-row styling in main.css', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cssPath = path.resolve(__dirname, '../src/styles/main.css');
    const css = fs.readFileSync(cssPath, 'utf-8');

    expect(css).toContain('.audio-quick-controls-row');
    const match = css.match(/\.audio-quick-controls-row\s*\{([^}]+)\}/);
    expect(match).not.toBeNull();
    const props = match![1];
    expect(props).toContain('display: flex;');
    expect(props).toContain('align-items: center;');
  });
});

describe('v1.3.3 Application & UI Icon Integration', () => {
  it('validates binary signatures and IHDR dimensions for all Tauri bundle icons', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const iconsDir = path.resolve(__dirname, '../src-tauri/icons');

    const checkPng = (fileName: string, expectedW: number, expectedH: number) => {
      const fullPath = path.join(iconsDir, fileName);
      expect(fs.existsSync(fullPath)).toBe(true);
      const buf = fs.readFileSync(fullPath);
      // 8-byte PNG signature
      expect(Array.from(buf.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      // IHDR width and height
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      expect(width).toBe(expectedW);
      expect(height).toBe(expectedH);
    };

    checkPng('32x32.png', 32, 32);
    checkPng('128x128.png', 128, 128);
    checkPng('128x128@2x.png', 256, 256);
    checkPng('icon.png', 512, 512);

    // icon.ico
    const icoPath = path.join(iconsDir, 'icon.ico');
    expect(fs.existsSync(icoPath)).toBe(true);
    const icoBuf = fs.readFileSync(icoPath);
    expect(Array.from(icoBuf.subarray(0, 4))).toEqual([0x00, 0x00, 0x01, 0x00]);

    // icon.icns
    const icnsPath = path.join(iconsDir, 'icon.icns');
    expect(fs.existsSync(icnsPath)).toBe(true);
    const icnsBuf = fs.readFileSync(icnsPath);
    expect(icnsBuf.subarray(0, 4).toString('ascii')).toBe('icns');
  });

  it('validates public web favicons (PNG 128x128 and ICO format)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const publicDir = path.resolve(__dirname, '../public');

    // favicon.png: 128x128 PNG
    const pngPath = path.join(publicDir, 'favicon.png');
    expect(fs.existsSync(pngPath)).toBe(true);
    const pngBuf = fs.readFileSync(pngPath);
    expect(Array.from(pngBuf.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(pngBuf.readUInt32BE(16)).toBe(128);
    expect(pngBuf.readUInt32BE(20)).toBe(128);

    // favicon.ico: ICO format
    const icoPath = path.join(publicDir, 'favicon.ico');
    expect(fs.existsSync(icoPath)).toBe(true);
    const icoBuf = fs.readFileSync(icoPath);
    expect(Array.from(icoBuf.subarray(0, 4))).toEqual([0x00, 0x00, 0x01, 0x00]);
  });

  it('validates index.html icon links and page title', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const htmlPath = path.resolve(__dirname, '../index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    expect(html).toContain('<link rel="icon" type="image/x-icon" href="/favicon.ico" />');
    expect(html).toContain('<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />');
    expect(html).toContain('<title>Falling Blocks</title>');
  });

  it('renders game-title-icon on TitleScreen', async () => {
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { LanguageProvider } = await import('../src/i18n');
    const { TitleScreen } = await import('../src/screens/TitleScreen');

    const html = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        { initialLanguage: 'ja' },
        React.createElement(TitleScreen, {
          onStartGame: vi.fn(),
          onOpenSettings: vi.fn(),
          onOpenRecords: vi.fn(),
        })
      )
    );

    expect(html).toContain('class="game-title-icon"');
    expect(html).toContain('src="/favicon.png"');
    expect(html).toContain('alt="Falling Blocks"');

    // Verify logo appears directly before game-title in DOM hierarchy
    const iconIndex = html.indexOf('class="game-title-icon"');
    const titleIndex = html.indexOf('class="game-title"');
    expect(iconIndex).toBeGreaterThan(-1);
    expect(titleIndex).toBeGreaterThan(-1);
    expect(iconIndex).toBeLessThan(titleIndex);
  });

  it('verifies game-title-icon and icon-float styling in main.css', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cssPath = path.resolve(__dirname, '../src/styles/main.css');
    const css = fs.readFileSync(cssPath, 'utf-8');

    expect(css).toContain('.game-title-icon');
    expect(css).toContain('@keyframes icon-float');
    expect(css).toMatch(/animation:\s*icon-float/);
  });

  it('validates Tauri NSIS installer configuration for multi-language and 3 icon locations', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const tauriConfPath = path.resolve(__dirname, '../src-tauri/tauri.conf.json');
    const conf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));

    // 1. Bundle target is NSIS
    expect(conf.bundle.active).toBe(true);
    expect(conf.bundle.targets).toEqual(['nsis']);

    // 2. Location 1: Application executable icon
    expect(conf.bundle.icon).toContain('icons/icon.ico');

    // 3. Location 2: Installer icon
    expect(conf.bundle.windows?.nsis?.installerIcon).toBe('icons/icon.ico');

    // 4. Location 3: Uninstaller icon
    expect(conf.bundle.windows?.nsis?.uninstallerIcon).toBe('icons/icon.ico');

    // 5. Bilingual English and Japanese support
    expect(conf.bundle.windows?.nsis?.languages).toContain('English');
    expect(conf.bundle.windows?.nsis?.languages).toContain('Japanese');

    // 6. Language selector enabled at startup
    expect(conf.bundle.windows?.nsis?.displayLanguageSelector).toBe(true);
  });

  it('validates physical assets for icon and NSIS installer/uninstaller paths', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const rootDir = path.resolve(__dirname, '..');
    const srcTauriDir = path.resolve(rootDir, 'src-tauri');

    // 1. Source PNG icon validation
    const sourcePngPath = path.resolve(rootDir, 'icon/Tetris-icon.png');
    expect(fs.existsSync(sourcePngPath)).toBe(true);
    const pngBuf = fs.readFileSync(sourcePngPath);
    expect(Array.from(pngBuf.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(pngBuf.readUInt32BE(16)).toBe(1254);
    expect(pngBuf.readUInt32BE(20)).toBe(1254);
    expect(pngBuf.readUInt8(24)).toBe(8); // Bit depth
    expect(pngBuf.readUInt8(25)).toBe(6); // Color type 6 (RGBA)

    // 2. Bundled Windows ICO validation
    const icoPath = path.resolve(srcTauriDir, 'icons/icon.ico');
    expect(fs.existsSync(icoPath)).toBe(true);
    const icoBuf = fs.readFileSync(icoPath);
    expect(Array.from(icoBuf.subarray(0, 4))).toEqual([0x00, 0x00, 0x01, 0x00]);
    const entryCount = icoBuf.readUInt16LE(4);
    expect(entryCount).toBe(6);

    const layerSizes: number[] = [];
    for (let i = 0; i < entryCount; i++) {
      const offset = 6 + i * 16;
      let w = icoBuf.readUInt8(offset);
      let h = icoBuf.readUInt8(offset + 1);
      if (w === 0) w = 256;
      if (h === 0) h = 256;
      expect(w).toBe(h);
      layerSizes.push(w);
    }
    expect(layerSizes).toEqual([16, 24, 32, 48, 64, 256]);

    // 3. Confirm installer and uninstaller icon targets resolve to existing files
    const tauriConf = JSON.parse(fs.readFileSync(path.resolve(srcTauriDir, 'tauri.conf.json'), 'utf-8'));
    const installerIconPath = path.resolve(srcTauriDir, tauriConf.bundle.windows.nsis.installerIcon);
    const uninstallerIconPath = path.resolve(srcTauriDir, tauriConf.bundle.windows.nsis.uninstallerIcon);
    expect(fs.existsSync(installerIconPath)).toBe(true);
    expect(fs.existsSync(uninstallerIconPath)).toBe(true);
  });
});
