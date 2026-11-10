import React, { useEffect, useState } from 'react';
import { BgmManager, unlockAudio } from '../audio/BgmManager';
import { SfxManager } from '../audio/SfxManager';
import { useTranslation } from '../i18n';
import { tauriBridge } from '../services/tauriBridge';
import type { UserSettings } from '../types/settings';

interface AudioQuickControlsProps {
  settings?: UserSettings | null;
  onSettingsChange?: (settings: UserSettings) => void;
  className?: string;
  persist?: boolean;
}

const DEFAULT_SETTINGS_FALLBACK: UserSettings = {
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

export const AudioQuickControls: React.FC<AudioQuickControlsProps> = ({
  settings: propSettings,
  onSettingsChange,
  className = '',
  persist = true,
}) => {
  const { t } = useTranslation();
  const [localSettings, setLocalSettings] = useState<UserSettings>(
    propSettings ?? DEFAULT_SETTINGS_FALLBACK
  );

  useEffect(() => {
    if (propSettings) {
      setLocalSettings(propSettings);
    } else {
      tauriBridge
        .getSettings()
        .then((s) => setLocalSettings(s))
        .catch(() => {
          /* use fallback */
        });
    }
  }, [propSettings]);

  const musicEnabled = localSettings.music_enabled;
  const sfxEnabled = localSettings.sfx_enabled;

  const handleToggleBgm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement)?.blur();
    unlockAudio();
    const prev = localSettings;
    const updated: UserSettings = {
      ...localSettings,
      music_enabled: !musicEnabled,
    };
    setLocalSettings(updated);
    BgmManager.getInstance().updateSettings({
      music_enabled: updated.music_enabled,
      music_volume: updated.music_volume,
    });
    onSettingsChange?.(updated);
    if (persist) {
      try {
        await tauriBridge.updateSettings(updated);
      } catch (err) {
        console.error('Failed to update BGM settings, rolling back:', err);
        setLocalSettings(prev);
        BgmManager.getInstance().updateSettings({
          music_enabled: prev.music_enabled,
          music_volume: prev.music_volume,
        });
        onSettingsChange?.(prev);
      }
    }
  };

  const handleToggleSfx = async (e: React.MouseEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement)?.blur();
    unlockAudio();
    const prev = localSettings;
    const updated: UserSettings = {
      ...localSettings,
      sfx_enabled: !sfxEnabled,
    };
    setLocalSettings(updated);
    SfxManager.getInstance().updateSettings({
      sfx_enabled: updated.sfx_enabled,
      sfx_volume: updated.sfx_volume,
    });
    if (updated.sfx_enabled) {
      SfxManager.getInstance().play('Move');
    }
    onSettingsChange?.(updated);
    if (persist) {
      try {
        await tauriBridge.updateSettings(updated);
      } catch (err) {
        console.error('Failed to update SFX settings, rolling back:', err);
        setLocalSettings(prev);
        SfxManager.getInstance().updateSettings({
          sfx_enabled: prev.sfx_enabled,
          sfx_volume: prev.sfx_volume,
        });
        onSettingsChange?.(prev);
      }
    }
  };

  return (
    <div className={`audio-quick-controls ${className}`} role="toolbar" aria-label="Audio controls">
      {/* BGM Button: ◯ with note ♪, / when off */}
      <button
        type="button"
        tabIndex={-1}
        className={`audio-btn bgm-btn ${musicEnabled ? 'active' : 'inactive'}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleToggleBgm}
        title={musicEnabled ? t.audio.bgmOn : t.audio.bgmOff}
        aria-label={musicEnabled ? t.audio.bgmOn : t.audio.bgmOff}
        aria-pressed={musicEnabled}
      >
        <svg
          viewBox="0 0 28 28"
          width="24"
          height="24"
          className="audio-icon"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer circle */}
          <circle
            cx="14"
            cy="14"
            r="11"
            stroke="currentColor"
            strokeWidth="1.8"
            className="circle-outer"
          />
          {/* Note ♪: Notehead, stem, flag */}
          <ellipse cx="12" cy="17" rx="2.8" ry="2" transform="rotate(-20 12 17)" fill="currentColor" />
          <path
            d="M14.5 16.5 V8.5 C14.5 8.5 15.8 7.5 18 9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Diagonal strike-through when OFF */}
          {!musicEnabled && (
            <line
              x1="6"
              y1="22"
              x2="22"
              y2="6"
              stroke="#ef4444"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="strike-line"
            />
          )}
        </svg>
      </button>

      {/* SFX Button: ◯ with speaker, / when off */}
      <button
        type="button"
        tabIndex={-1}
        className={`audio-btn sfx-btn ${sfxEnabled ? 'active' : 'inactive'}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleToggleSfx}
        title={sfxEnabled ? t.audio.sfxOn : t.audio.sfxOff}
        aria-label={sfxEnabled ? t.audio.sfxOn : t.audio.sfxOff}
        aria-pressed={sfxEnabled}
      >
        <svg
          viewBox="0 0 28 28"
          width="24"
          height="24"
          className="audio-icon"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer circle */}
          <circle
            cx="14"
            cy="14"
            r="11"
            stroke="currentColor"
            strokeWidth="1.8"
            className="circle-outer"
          />
          {/* Speaker body: box + cone */}
          <path
            d="M8.5 11.5 H10.8 L14.2 8.5 V19.5 L10.8 16.5 H8.5 Z"
            fill="currentColor"
          />
          {/* Sound waves (when ON) */}
          {sfxEnabled && (
            <>
              <path
                d="M16.8 11.5 C17.8 12.5 17.8 15.5 16.8 16.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M19.2 9.5 C21 11.2 21 16.8 19.2 18.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </>
          )}
          {/* Diagonal strike-through when OFF */}
          {!sfxEnabled && (
            <line
              x1="6"
              y1="22"
              x2="22"
              y2="6"
              stroke="#ef4444"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="strike-line"
            />
          )}
        </svg>
      </button>
    </div>
  );
};
