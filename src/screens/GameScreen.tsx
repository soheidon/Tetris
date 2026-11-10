import React, { useEffect, useRef } from 'react';
import { BgmManager, type GamePlayStatus } from '../audio/BgmManager';
import { AudioQuickControls } from '../components/AudioQuickControls';
import { GameRenderer } from '../canvas/renderer';
import { useKeyboard } from '../hooks/useKeyboard';
import { tauriBridge } from '../services/tauriBridge';
import type { GameStateSnapshot } from '../types/game';
import type { UserSettings } from '../types/settings';
import { GameOverModal } from './GameOverModal';
import { PauseModal } from './PauseModal';

interface GameScreenProps {
  snapshot: GameStateSnapshot | null;
  settings: UserSettings;
  onQuitToTitle: () => void;
  onSettingsChange?: (settings: UserSettings) => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  snapshot,
  settings,
  onQuitToTitle,
  onSettingsChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const snapshotRef = useRef<GameStateSnapshot | null>(snapshot);
  const settingsRef = useRef<UserSettings>(settings);

  snapshotRef.current = snapshot;
  settingsRef.current = settings;

  const isPlaying = snapshot?.status === 'Playing';
  useKeyboard(settings, isPlaying);

  // Synchronize snapshot status with BgmManager
  useEffect(() => {
    if (!snapshot) return;
    const statusMap: Record<string, GamePlayStatus> = {
      Ready: 'ready',
      Playing: 'playing',
      Paused: 'paused',
      GameOver: 'game_over',
      Completed: 'completed',
    };
    const mapped = statusMap[snapshot.status] ?? 'ready';
    BgmManager.getInstance().setGameStatus(mapped);
  }, [snapshot?.status]);

  // Setup renderer and animation frame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    rendererRef.current = new GameRenderer(canvas);

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let animId: number;
    const renderLoop = () => {
      if (rendererRef.current && snapshotRef.current) {
        rendererRef.current.render(snapshotRef.current, settingsRef.current);
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const handleResume = () => {
    tauriBridge.resumeGame().catch(console.error);
  };

  const handleRestart = () => {
    BgmManager.getInstance().restart();
    tauriBridge.restartGame().catch(console.error);
  };

  return (
    <div className="game-screen">
      <div className="game-header-bar">
        <AudioQuickControls settings={settings} onSettingsChange={onSettingsChange} />
      </div>
      <canvas ref={canvasRef} className="game-canvas" />

      {snapshot?.status === 'Paused' && (
        <PauseModal
          settings={settings}
          onSettingsChange={onSettingsChange}
          onResume={handleResume}
          onRestart={handleRestart}
          onQuitToTitle={onQuitToTitle}
        />
      )}

      {(snapshot?.status === 'GameOver' || snapshot?.status === 'Completed') && (
        <GameOverModal
          snapshot={snapshot}
          onRestart={handleRestart}
          onQuitToTitle={onQuitToTitle}
        />
      )}
    </div>
  );
};
