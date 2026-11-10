export type Language = 'en' | 'ja';

export interface KeyBindings {
  move_left: string;
  move_right: string;
  soft_drop: string;
  hard_drop: string;
  rotate_cw: string;
  rotate_ccw: string;
  hold: string;
  pause: string;
  restart: string;
}

export interface UserSettings {
  schema_version: number;
  window_width: number;
  window_height: number;
  fullscreen: boolean;
  show_ghost: boolean;
  show_grid: boolean;
  reduce_motion: boolean;
  key_bindings: KeyBindings;
  das_ms: number;
  arr_ms: number;
  soft_drop_multiplier: number;
  starting_level: number;
  show_next_queue: boolean;
  show_hold: boolean;
  language: Language;
  music_enabled: boolean;
  music_volume: number;
  sfx_enabled: boolean;
  sfx_volume: number;
}
