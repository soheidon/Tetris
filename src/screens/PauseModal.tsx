import React from 'react';
import { AudioQuickControls } from '../components/AudioQuickControls';
import { useTranslation } from '../i18n';
import type { UserSettings } from '../types/settings';

interface PauseModalProps {
  settings?: UserSettings;
  onSettingsChange?: (settings: UserSettings) => void;
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  settings,
  onSettingsChange,
  onResume,
  onRestart,
  onQuitToTitle,
}) => {
  const { t } = useTranslation();

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <h2 className="modal-title">{t.pause.title}</h2>
        <div className="pause-audio-controls">
          <AudioQuickControls settings={settings} onSettingsChange={onSettingsChange} />
        </div>
        <div className="modal-buttons">
          <button className="btn btn-primary btn-large" onClick={onResume}>
            {t.pause.resume} (Esc)
          </button>
          <button className="btn btn-secondary" onClick={onRestart}>
            {t.pause.restart}
          </button>
          <button className="btn btn-danger-outline" onClick={onQuitToTitle}>
            {t.pause.quit}
          </button>
        </div>
      </div>
    </div>
  );
};
