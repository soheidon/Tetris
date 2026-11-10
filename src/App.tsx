import React, { useEffect, useState } from 'react';
import { BgmManager } from './audio/BgmManager';
import { SfxManager } from './audio/SfxManager';
import { LanguageProvider } from './i18n';
import { GameScreen } from './screens/GameScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TitleScreen } from './screens/TitleScreen';
import { tauriBridge } from './services/tauriBridge';
import type { GameMode, GameStateSnapshot } from './types/game';
import type { Language, UserSettings } from './types/settings';
import './styles/main.css';

export const App: React.FC = () => {
  const [screen, setScreen] = useState<'title' | 'game' | 'settings' | 'records'>('title');
  const [snapshot, setSnapshot] = useState<GameStateSnapshot | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<Language>('ja');
  const userChosenLanguageRef = React.useRef<Language | null>(null);

  useEffect(() => {
    // Synchronize screen state with BgmManager
    BgmManager.getInstance().setScreen(screen);
  }, [screen]);

  useEffect(() => {
    // Initialize BgmManager and SfxManager
    BgmManager.getInstance().init();
    SfxManager.getInstance().init();

    // Load initial settings with race-condition safeguard
    tauriBridge
      .getSettings()
      .then(async (loadedSettings) => {
        BgmManager.getInstance().updateSettings({
          music_enabled: loadedSettings.music_enabled,
          music_volume: loadedSettings.music_volume,
        });
        SfxManager.getInstance().updateSettings({
          sfx_enabled: loadedSettings.sfx_enabled,
          sfx_volume: loadedSettings.sfx_volume,
        });

        if (userChosenLanguageRef.current !== null) {
          // User already made an explicit language selection during startup
          const updated = { ...loadedSettings, language: userChosenLanguageRef.current };
          setSettings(updated);
          await tauriBridge.updateSettings(updated);
        } else {
          setSettings(loadedSettings);
          setActiveLanguage(loadedSettings.language);
        }
      })
      .catch(console.error);

    // Subscribe to IPC game state stream (~30Hz)
    let unlistenGameState: (() => void) | null = null;
    tauriBridge
      .subscribeGameState((newSnapshot) => {
        setSnapshot(newSnapshot);
      })
      .then((unlisten) => {
        unlistenGameState = unlisten;
      })
      .catch(console.error);

    // Subscribe to IPC SFX stream
    let unlistenSfx: (() => void) | null = null;
    tauriBridge
      .subscribeSfx((sfx) => {
        SfxManager.getInstance().play(sfx);
      })
      .then((unlisten) => {
        unlistenSfx = unlisten;
      })
      .catch(console.error);

    return () => {
      if (unlistenGameState) unlistenGameState();
      if (unlistenSfx) unlistenSfx();
    };
  }, []);

  const handleStartGame = async (mode: GameMode, startingLevel: number) => {
    try {
      const initialSnapshot = await tauriBridge.startGame(mode, startingLevel);
      setSnapshot(initialSnapshot);
      setScreen('game');
    } catch (err) {
      console.error('Failed to start game:', err);
    }
  };

  const handleSaveSettings = async (newSettings: UserSettings) => {
    await tauriBridge.updateSettings(newSettings);
    setSettings(newSettings);
    setScreen('title');
  };

  const handleLanguageChange = async (newLang: Language) => {
    userChosenLanguageRef.current = newLang;
    setActiveLanguage(newLang);
    try {
      const current = settings ?? (await tauriBridge.getSettings());
      const updated = { ...current, language: newLang };
      setSettings(updated);
      await tauriBridge.updateSettings(updated);
    } catch (err) {
      console.error('Failed to persist language setting:', err);
    }
  };

  return (
    <LanguageProvider
      initialLanguage={activeLanguage}
      onLanguageChange={handleLanguageChange}
    >
      <div className="app-root">
        {screen === 'title' && (
          <TitleScreen
            onStartGame={handleStartGame}
            onOpenSettings={() => setScreen('settings')}
            onOpenRecords={() => setScreen('records')}
          />
        )}

        {screen === 'game' && settings && (
          <GameScreen
            snapshot={snapshot}
            settings={settings}
            onSettingsChange={(newSettings) => setSettings(newSettings)}
            onQuitToTitle={() => {
              tauriBridge.pauseGame().catch(console.error);
              setScreen('title');
            }}
          />
        )}

        {screen === 'settings' && settings && (
          <SettingsScreen
            settings={settings}
            onSave={handleSaveSettings}
            onCancel={() => setScreen('title')}
          />
        )}

        {screen === 'records' && (
          <RecordsScreen onBack={() => setScreen('title')} />
        )}
      </div>
    </LanguageProvider>
  );
};

export default App;
