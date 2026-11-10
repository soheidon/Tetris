import React, { useState } from 'react';
import { BgmManager } from '../audio/BgmManager';
import { SfxManager } from '../audio/SfxManager';
import { AudioQuickControls } from '../components/AudioQuickControls';
import { LanguageToggle } from '../components/LanguageToggle';
import { useTranslation } from '../i18n';
import type { KeyBindings, UserSettings } from '../types/settings';

interface SettingsScreenProps {
  settings: UserSettings;
  onSave: (newSettings: UserSettings) => Promise<void>;
  onCancel: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings: initialSettings,
  onSave,
  onCancel,
}) => {
  const { language, t } = useTranslation();
  const [settings, setSettings] = useState<UserSettings>(() => ({
    music_enabled: true,
    music_volume: 40,
    sfx_enabled: true,
    sfx_volume: 50,
    ...JSON.parse(JSON.stringify(initialSettings)),
  }));
  const [listeningKey, setListeningKey] = useState<keyof KeyBindings | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getActionLabel = (action: keyof KeyBindings): string => {
    return t.settings.actions[action] ?? action;
  };

  const validateBindings = (bindings: KeyBindings): string | null => {
    const map = new Map<string, string>();
    const actions: (keyof KeyBindings)[] = [
      'move_left',
      'move_right',
      'soft_drop',
      'hard_drop',
      'rotate_cw',
      'rotate_ccw',
      'hold',
      'pause',
      'restart',
    ];

    for (const key of actions) {
      const val = bindings[key].toLowerCase();
      const label = getActionLabel(key);
      if (map.has(val)) {
        return `${t.settings.duplicateWarning} ("${bindings[key]}": ${map.get(val)} / ${label})`;
      }
      map.set(val, label);
    }
    return null;
  };

  const handleKeyCapture = (e: React.KeyboardEvent) => {
    if (!listeningKey) return;
    e.preventDefault();
    e.stopPropagation();

    const keyName = e.key === ' ' ? 'Space' : e.key;
    const newBindings = { ...settings.key_bindings, [listeningKey]: keyName };
    const err = validateBindings(newBindings);
    if (err) {
      setErrorMsg(err);
    } else {
      setErrorMsg(null);
      setSettings({ ...settings, key_bindings: newBindings });
    }
    setListeningKey(null);
  };

  const handleSave = async () => {
    const err = validateBindings(settings.key_bindings);
    if (err) {
      setErrorMsg(err);
      return;
    }
    try {
      const merged: UserSettings = {
        ...settings,
        language,
        music_enabled: settings.music_enabled ?? true,
        music_volume: settings.music_volume ?? 40,
        sfx_enabled: settings.sfx_enabled ?? true,
        sfx_volume: settings.sfx_volume ?? 50,
      };
      // Save-time safeguard: merge authoritative LanguageContext language & audio settings
      await onSave(merged);
      BgmManager.getInstance().updateSettings({
        music_enabled: merged.music_enabled,
        music_volume: merged.music_volume,
      });
      SfxManager.getInstance().updateSettings({
        sfx_enabled: merged.sfx_enabled,
        sfx_volume: merged.sfx_volume,
      });
    } catch (err: any) {
      setErrorMsg(String(err));
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm(`${t.settings.resetDefaults}?`)) {
      const defaultSettings: UserSettings = {
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
        language, // Preserve authoritative language selection
        music_enabled: true,
        music_volume: 40,
        sfx_enabled: true,
        sfx_volume: 50,
      };
      setSettings(defaultSettings);
      BgmManager.getInstance().updateSettings({
        music_enabled: true,
        music_volume: 40,
      });
      SfxManager.getInstance().updateSettings({
        sfx_enabled: true,
        sfx_volume: 50,
      });
      setErrorMsg(null);
    }
  };

  const handleCancel = () => {
    // Revert live audition settings to initialSettings
    BgmManager.getInstance().updateSettings({
      music_enabled: initialSettings.music_enabled,
      music_volume: initialSettings.music_volume,
    });
    SfxManager.getInstance().updateSettings({
      sfx_enabled: initialSettings.sfx_enabled,
      sfx_volume: initialSettings.sfx_volume,
    });
    onCancel();
  };

  return (
    <div className="settings-screen" onKeyDown={handleKeyCapture} tabIndex={0}>
      <div className="settings-container">
        <div className="header-row">
          <h2>{t.settings.title}</h2>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={handleCancel}>
              {t.settings.cancel}
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              {t.settings.saveChanges}
            </button>
          </div>
        </div>

        {errorMsg && <div className="error-banner">{errorMsg}</div>}

        <div className="settings-scroll-content">
          {/* Language Selection Section */}
          <div className="settings-section">
            <h3>{t.settings.languageSection}</h3>
            <div style={{ marginTop: '8px' }}>
              <LanguageToggle />
            </div>
          </div>

          {/* Audio & BGM Section */}
          <div className="settings-section">
            <h3>{t.settings.audioSection}</h3>
            <div className="audio-quick-controls-row">
              <AudioQuickControls
                settings={settings}
                onSettingsChange={(updated) => setSettings(updated)}
                persist={false}
              />
            </div>
            <p className="section-desc">{t.settings.musicDesc}</p>

            <div className="slider-row" style={{ marginTop: '16px' }}>
              <label>
                {t.settings.musicVolume}: <strong>{settings.music_volume ?? 40}%</strong>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                disabled={!(settings.music_enabled ?? true)}
                value={settings.music_volume ?? 40}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const updated = { ...settings, music_volume: val };
                  setSettings(updated);
                  BgmManager.getInstance().updateSettings({ music_volume: val });
                }}
              />
            </div>

            <div className="slider-row" style={{ marginTop: '20px' }}>
              <label>
                {t.settings.sfxVolume}: <strong>{settings.sfx_volume ?? 50}%</strong>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                disabled={!(settings.sfx_enabled ?? true)}
                value={settings.sfx_volume ?? 50}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const updated = { ...settings, sfx_volume: val };
                  setSettings(updated);
                  SfxManager.getInstance().updateSettings({ sfx_volume: val });
                }}
              />
            </div>
          </div>

          {/* Controls Section */}
          <div className="settings-section">
            <h3>{t.settings.controlsSection}</h3>
            <p className="section-desc">{t.settings.pressKey}</p>

            <div className="bindings-grid">
              {(
                [
                  'move_left',
                  'move_right',
                  'soft_drop',
                  'hard_drop',
                  'rotate_cw',
                  'rotate_ccw',
                  'hold',
                  'pause',
                  'restart',
                ] as (keyof KeyBindings)[]
              ).map((key) => (
                <div key={key} className="binding-row">
                  <span className="binding-label">{getActionLabel(key)}</span>
                  <button
                    className={`key-btn ${listeningKey === key ? 'listening' : ''}`}
                    onClick={() => {
                      setListeningKey(key);
                      setErrorMsg(null);
                    }}
                  >
                    {listeningKey === key ? t.settings.pressKey : settings.key_bindings[key]}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Handling (DAS / ARR) Section */}
          <div className="settings-section">
            <h3>{t.settings.tuningSection}</h3>
            <div className="slider-row">
              <label>
                {t.settings.das}: <strong>{settings.das_ms} ms</strong>
              </label>
              <input
                type="range"
                min="80"
                max="300"
                step="5"
                value={settings.das_ms}
                onChange={(e) => setSettings({ ...settings, das_ms: parseInt(e.target.value, 10) })}
              />
            </div>

            <div className="slider-row">
              <label>
                {t.settings.arr}: <strong>{settings.arr_ms} ms</strong> {settings.arr_ms === 0 && '(Instant)'}
              </label>
              <input
                type="range"
                min="0"
                max="80"
                step="2"
                value={settings.arr_ms}
                onChange={(e) => setSettings({ ...settings, arr_ms: parseInt(e.target.value, 10) })}
              />
            </div>
          </div>

          {/* Gameplay & Visuals Section */}
          <div className="settings-section">
            <h3>{t.settings.gameplaySection}</h3>
            <div className="toggle-grid">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.show_ghost}
                  onChange={(e) => setSettings({ ...settings, show_ghost: e.target.checked })}
                />
                {t.settings.ghost}
              </label>

              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.show_grid}
                  onChange={(e) => setSettings({ ...settings, show_grid: e.target.checked })}
                />
                {t.settings.grid}
              </label>

              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.show_next_queue}
                  onChange={(e) => setSettings({ ...settings, show_next_queue: e.target.checked })}
                />
                {t.settings.nextQueue}
              </label>

              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.show_hold}
                  onChange={(e) => setSettings({ ...settings, show_hold: e.target.checked })}
                />
                {t.settings.holdSlot}
              </label>

              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.reduce_motion}
                  onChange={(e) => setSettings({ ...settings, reduce_motion: e.target.checked })}
                />
                {t.settings.reduceMotion}
              </label>
            </div>
          </div>
        </div>

        <div className="footer-row">
          <button className="btn btn-danger-outline" onClick={handleResetDefaults}>
            {t.settings.resetDefaults}
          </button>
        </div>
      </div>
    </div>
  );
};
