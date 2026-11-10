import React, { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';
import { tauriBridge } from '../services/tauriBridge';
import type { GameMode } from '../types/game';
import type { RecordEntry, RecordsData } from '../types/records';

interface RecordsScreenProps {
  onBack: () => void;
}

export const RecordsScreen: React.FC<RecordsScreenProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<GameMode>('Marathon');
  const [records, setRecords] = useState<RecordsData | null>(null);

  const loadRecords = async () => {
    try {
      const data = await tauriBridge.getRecords();
      setRecords(data);
    } catch (err) {
      console.error('Failed to load records:', err);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleReset = async () => {
    const confirmMsg = t.records.resetConfirm.replace('{mode}', getTabLabel(activeTab));
    if (window.confirm(confirmMsg)) {
      await tauriBridge.resetRecords(activeTab);
      await loadRecords();
    }
  };

  const getActiveList = (): RecordEntry[] => {
    if (!records) return [];
    if (activeTab === 'Marathon') return records.marathon;
    if (activeTab === 'Sprint') return records.sprint;
    return records.ultra;
  };

  const formatTime = (ms: number): string => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const centis = Math.floor((ms % 1000) / 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
  };

  const list = getActiveList();

  const getTabLabel = (mode: GameMode): string => {
    if (mode === 'Marathon') return t.modes.marathon.name;
    if (mode === 'Sprint') return t.modes.sprint.name;
    return t.modes.ultra.name;
  };

  return (
    <div className="records-screen">
      <div className="records-container">
        <div className="header-row">
          <h2>{t.records.title}</h2>
          <button className="btn btn-secondary" onClick={onBack}>
            {t.records.back}
          </button>
        </div>

        <div className="tab-row">
          {(['Marathon', 'Sprint', 'Ultra'] as GameMode[]).map((mode) => (
            <button
              key={mode}
              className={`tab-btn ${activeTab === mode ? 'active' : ''}`}
              onClick={() => setActiveTab(mode)}
            >
              {getTabLabel(mode)}
            </button>
          ))}
        </div>

        <div className="records-table-container">
          {list.length === 0 ? (
            <div className="empty-records">{t.records.noRecords}</div>
          ) : (
            <table className="records-table">
              <thead>
                <tr>
                  <th>{t.records.rank}</th>
                  <th>{activeTab === 'Sprint' ? t.records.time : t.records.score}</th>
                  <th>{t.records.lines}</th>
                  {activeTab === 'Marathon' && <th>{t.records.level}</th>}
                  {activeTab === 'Sprint' && <th>{t.records.pps}</th>}
                  {activeTab !== 'Sprint' && <th>{t.records.time}</th>}
                  <th>{t.records.date}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item, idx) => (
                  <tr key={idx} className={idx === 0 ? 'top-rank' : ''}>
                    <td className="rank-cell">#{idx + 1}</td>
                    <td className="primary-stat">
                      {activeTab === 'Sprint' ? formatTime(item.time_ms) : item.score.toLocaleString()}
                    </td>
                    <td>{item.lines}</td>
                    {activeTab === 'Marathon' && <td>{item.level ?? 1}</td>}
                    {activeTab === 'Sprint' && <td>{item.pps?.toFixed(2) ?? '-'}</td>}
                    {activeTab !== 'Sprint' && <td>{formatTime(item.time_ms)}</td>}
                    <td className="date-cell">{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="footer-row">
          <button className="btn btn-danger-outline" onClick={handleReset}>
            {t.common.reset} ({getTabLabel(activeTab)})
          </button>
        </div>
      </div>
    </div>
  );
};
