export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export type GameMode = 'Marathon' | 'Sprint' | 'Ultra';

export type GameStatus =
  | 'Title'
  | 'Ready'
  | 'Playing'
  | 'Paused'
  | 'GameOver'
  | 'Completed';

export type InputAction =
  | 'MoveLeft'
  | 'MoveRight'
  | 'SoftDrop'
  | 'HardDrop'
  | 'RotateCW'
  | 'RotateCCW'
  | 'Hold'
  | 'Pause'
  | 'Restart';

export interface ActivePieceDto {
  piece_type: TetrominoType;
  x: number;
  y: number; // 0..19 in visible display coords
  blocks: [number, number][]; // [x, y] in visible display coords
}

export interface ActionNotification {
  action_name: string;
  combo: number;
  b2b: boolean;
  points: number;
}

export interface GameStatistics {
  total_pieces: number;
  pieces_per_second: number;
  lines_cleared: number;
  total_tetrises: number;
  total_tspins: number;
  max_combo: number;
  max_b2b_chain: number;
  perfect_clears: number;
  final_score: number;
  elapsed_time_ms: number;
  mode: GameMode;
}

export interface GameStateSnapshot {
  board: (TetrominoType | null)[][]; // 20 rows x 10 cols
  active_piece: ActivePieceDto | null;
  ghost_blocks: [number, number][] | null;
  hold_piece: TetrominoType | null;
  can_hold: boolean;
  next_queue: TetrominoType[];
  score: number;
  level: number;
  lines: number;
  combo: number;
  back_to_back: boolean;
  elapsed_time_ms: number;
  remaining_time_ms: number | null;
  status: GameStatus;
  countdown_seconds: number | null;
  mode: GameMode;
  last_action: ActionNotification | null;
  stats: GameStatistics | null;
}
