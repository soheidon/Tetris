import React, { useEffect, useRef } from 'react';
import { useTranslation } from '../i18n';
import { tauriBridge } from '../services/tauriBridge';
import type { GameStateSnapshot } from '../types/game';

interface GameOverModalProps {
  snapshot: GameStateSnapshot;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  snapshot,
  onRestart,
  onQuitToTitle,
}) => {
  const { t } = useTranslation();
  const isVictory = snapshot.status === 'Completed';
  const stats = snapshot.stats;
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current || !stats) return;
    savedRef.current = true;

    const dateStr = new Date().toISOString().split('T')[0];
    const unixNow = Math.floor(Date.now() / 1000);

    tauriBridge
      .saveRecord(snapshot.mode, {
        score: stats.final_score,
        lines: stats.lines_cleared,
        level: snapshot.level,
        time_ms: stats.elapsed_time_ms,
        pieces: stats.total_pieces,
        pps: stats.pieces_per_second,
        date: dateStr,
        timestamp_unix: unixNow,
      })
      .catch((err) => console.error('Failed to auto-save record:', err));
  }, [snapshot, stats]);

  const formatTime = (ms: number): string => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const centis = Math.floor((ms % 1000) / 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
  };

  const modeName =
    snapshot.mode === 'Marathon'
      ? t.modes.marathon.name
      : snapshot.mode === 'Sprint'
        ? t.modes.sprint.name
        : t.modes.ultra.name;

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog results-dialog">
        <h2 className={`results-title ${isVictory ? 'victory' : 'gameover'}`}>
          {isVictory ? t.gameover.titleCompleted : t.gameover.titleGameOver}
        </h2>
        <p className="results-mode">{modeName}</p>

        <div className="results-grid">
          <div className="result-card primary-result">
            <span className="card-label">{t.gameover.finalScore}</span>
            <span className="card-value">{snapshot.score.toLocaleString()}</span>
          </div>

          <div className="result-card">
            <span className="card-label">{t.gameover.linesCleared}</span>
            <span className="card-value">{snapshot.lines}</span>
          </div>

          <div className="result-card">
            <span className="card-label">{t.gameover.clearTime}</span>
            <span className="card-value">{formatTime(snapshot.elapsed_time_ms)}</span>
          </div>

          <div className="result-card">
            <span className="card-label">{t.gameover.piecesPerSec}</span>
            <span className="card-value">
              {stats?.total_pieces ?? 0} ({stats?.pieces_per_second.toFixed(2) ?? '0.00'})
            </span>
          </div>

          <div className="result-card">
            <span className="card-label">{t.gameover.tetrisesAndTspins}</span>
            <span className="card-value">
              {stats?.total_tetrises ?? 0} / {stats?.total_tspins ?? 0}
            </span>
          </div>

          <div className="result-card">
            <span className="card-label">{t.gameover.maxComboAndB2b}</span>
            <span className="card-value">
              {stats?.max_combo ? stats.max_combo - 1 : 0} / {stats?.max_b2b_chain ?? 0}
            </span>
          </div>
        </div>

        <div className="modal-buttons">
          <button className="btn btn-primary btn-large" onClick={onRestart}>
            {t.gameover.playAgain} (R)
          </button>
          <button className="btn btn-secondary" onClick={onQuitToTitle}>
            {t.gameover.quit}
          </button>
        </div>
      </div>
    </div>
  );
};
