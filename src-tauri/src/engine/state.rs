use super::modes::GameMode;
use super::piece::{ActivePiece, TetrominoType};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum GameStatus {
    #[default]
    Title,
    Ready,
    Playing,
    Paused,
    GameOver,
    Completed,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum InputAction {
    MoveLeft,
    MoveRight,
    SoftDrop,
    HardDrop,
    RotateCW,
    RotateCCW,
    Hold,
    Pause,
    Restart,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct ActivePieceDto {
    pub piece_type: TetrominoType,
    pub x: i32,
    pub y: i32, // y in display coordinates (y - 20)
    pub blocks: [(i32, i32); 4], // blocks in display coordinates
}

impl From<&ActivePiece> for ActivePieceDto {
    fn from(p: &ActivePiece) -> Self {
        let raw_blocks = p.blocks();
        let display_blocks = [
            (raw_blocks[0].0, raw_blocks[0].1 - 20),
            (raw_blocks[1].0, raw_blocks[1].1 - 20),
            (raw_blocks[2].0, raw_blocks[2].1 - 20),
            (raw_blocks[3].0, raw_blocks[3].1 - 20),
        ];

        Self {
            piece_type: p.piece_type,
            x: p.x,
            y: p.y - 20,
            blocks: display_blocks,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct ActionNotification {
    pub action_name: String, // e.g. "Tetris", "T-Spin Double", "Back-to-Back"
    pub combo: u32,
    pub b2b: bool,
    pub points: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct GameStatistics {
    pub total_pieces: u32,
    pub pieces_per_second: f32,
    pub lines_cleared: u32,
    pub total_tetrises: u32,
    pub total_tspins: u32,
    pub max_combo: u32,
    pub max_b2b_chain: u32,
    pub perfect_clears: u32,
    pub final_score: u64,
    pub elapsed_time_ms: u64,
    pub mode: GameMode,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GameStateSnapshot {
    pub board: Vec<Vec<Option<TetrominoType>>>, // 10x20 visible field
    pub active_piece: Option<ActivePieceDto>,
    pub ghost_blocks: Option<[(i32, i32); 4]>,  // Ghost blocks in display coords (y - 20)
    pub hold_piece: Option<TetrominoType>,
    pub can_hold: bool,
    pub next_queue: Vec<TetrominoType>,         // 5 lookahead items
    pub score: u64,
    pub level: u32,
    pub lines: u32,
    pub combo: u32,
    pub back_to_back: bool,
    pub elapsed_time_ms: u64,
    pub remaining_time_ms: Option<u64>,
    pub status: GameStatus,
    pub countdown_seconds: Option<u32>,         // 3..2..1 during Ready state
    pub mode: GameMode,
    pub last_action: Option<ActionNotification>,
    pub stats: Option<GameStatistics>,
}
