import React, { useState } from 'react';
import { unlockAudio } from '../audio/BgmManager';
import { AudioQuickControls } from '../components/AudioQuickControls';
import { LanguageToggle } from '../components/LanguageToggle';
import { useTranslation } from '../i18n';
import type { GameMode } from '../types/game';

interface TitleScreenProps {
  onStartGame: (mode: GameMode, startingLevel: number) => void;
  onOpenSettings: () => void;
  onOpenRecords: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  onOpenSettings,
  onOpenRecords,
}) => {
  const { t } = useTranslation();
  const [selectedMode, setSelectedMode] = useState<GameMode>('Marathon');
  const [startingLevel, setStartingLevel] = useState<number>(1);

  return (
    <div className="title-screen">
      <div className="title-header-bar">
        <AudioQuickControls />
        <LanguageToggle />
      </div>

      <div className="title-container">
        <img src="/favicon.png" alt="Falling Blocks" className="game-title-icon" />
        <h1 className="game-title">
          FALLING <span className="title-accent">{t.title.accent}</span>
        </h1>
        <p className="game-subtitle">{t.title.subtitle}</p>

        <div className="mode-selection">
          <label className="section-label">{t.title.selectMode}</label>
          <div className="mode-cards">
            <button
              className={`mode-card ${selectedMode === 'Marathon' ? 'active' : ''}`}
              onClick={() => setSelectedMode('Marathon')}
            >
              <h3>{t.modes.marathon.name}</h3>
              <p>{t.modes.marathon.desc}</p>
            </button>

            <button
              className={`mode-card ${selectedMode === 'Sprint' ? 'active' : ''}`}
              onClick={() => setSelectedMode('Sprint')}
            >
              <h3>{t.modes.sprint.name}</h3>
              <p>{t.modes.sprint.desc}</p>
            </button>

            <button
              className={`mode-card ${selectedMode === 'Ultra' ? 'active' : ''}`}
              onClick={() => setSelectedMode('Ultra')}
            >
              <h3>{t.modes.ultra.name}</h3>
              <p>{t.modes.ultra.desc}</p>
            </button>
          </div>
        </div>

        {selectedMode === 'Marathon' && (
          <div className="starting-level-picker">
            <label>{t.title.startingLevel}: <strong>{startingLevel}</strong></label>
            <input
              type="range"
              min="1"
              max="15"
              value={startingLevel}
              onChange={(e) => setStartingLevel(parseInt(e.target.value, 10))}
            />
          </div>
        )}

        <div className="menu-actions">
          <button
            className="btn btn-primary btn-large"
            onClick={() => {
              unlockAudio();
              onStartGame(selectedMode, startingLevel);
            }}
          >
            {t.title.playGame}
          </button>
          <div className="menu-sub-actions">
            <button className="btn btn-secondary" onClick={onOpenRecords}>
              {t.title.records}
            </button>
            <button className="btn btn-secondary" onClick={onOpenSettings}>
              {t.title.settings}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
