import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { GameMode, GameStateSnapshot, InputAction } from '../types/game';
import type { RecordsData, RecordEntry } from '../types/records';
import type { UserSettings } from '../types/settings';
import type { SfxType } from '../audio/SfxManager';

export const tauriBridge = {
  startGame: async (mode?: GameMode, startingLevel?: number): Promise<GameStateSnapshot> => {
    return await invoke('start_game', { mode, startingLevel });
  },

  restartGame: async (): Promise<GameStateSnapshot> => {
    return await invoke('restart_game');
  },

  pauseGame: async (): Promise<GameStateSnapshot> => {
    return await invoke('pause_game');
  },

  resumeGame: async (): Promise<GameStateSnapshot> => {
    return await invoke('resume_game');
  },

  sendInput: async (action: InputAction, pressed: boolean): Promise<void> => {
    return await invoke('send_input', { action, pressed });
  },

  getGameState: async (): Promise<GameStateSnapshot> => {
    return await invoke('get_game_state');
  },

  getSettings: async (): Promise<UserSettings> => {
    return await invoke('get_settings');
  },

  updateSettings: async (settings: UserSettings): Promise<void> => {
    return await invoke('update_settings', { settings });
  },

  getRecords: async (): Promise<RecordsData> => {
    return await invoke('get_records');
  },

  saveRecord: async (mode: GameMode, entry: RecordEntry): Promise<void> => {
    return await invoke('save_record', { mode, entry });
  },

  resetRecords: async (mode?: GameMode): Promise<void> => {
    return await invoke('reset_records', { mode });
  },

  subscribeGameState: (callback: (state: GameStateSnapshot) => void): Promise<UnlistenFn> => {
    return listen<GameStateSnapshot>('game_state_update', (event) => {
      callback(event.payload);
    });
  },

  subscribeSfx: (callback: (sfx: SfxType) => void): Promise<UnlistenFn> => {
    return listen<SfxType>('game_sfx', (event) => {
      callback(event.payload);
    });
  },
};
