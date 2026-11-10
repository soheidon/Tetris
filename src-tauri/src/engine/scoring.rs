use super::board::{Board, BOARD_HEIGHT, BOARD_WIDTH};
use super::piece::{ActivePiece, RotationState, TetrominoType};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum TSpinType {
    None,
    Mini,
    Regular,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ActionType {
    None,
    Single,
    Double,
    Triple,
    Tetris,
    TSpinNone(TSpinType),
    TSpinSingle(TSpinType),
    TSpinDouble(TSpinType),
    TSpinTriple,
    PerfectClear(usize),
}

#[derive(Clone, Debug, Default)]
pub struct ScoreManager {
    pub score: u64,
    pub lines: u32,
    pub level: u32,
    pub combo: u32,
    pub back_to_back: bool,
    pub total_pieces: u32,
    pub total_tetrises: u32,
    pub total_tspins: u32,
    pub max_combo: u32,
    pub max_b2b_chain: u32,
    pub current_b2b_chain: u32,
    pub perfect_clears: u32,
}

impl ScoreManager {
    pub fn new(starting_level: u32) -> Self {
        Self {
            score: 0,
            lines: 0,
            level: starting_level.max(1),
            combo: 0,
            back_to_back: false,
            total_pieces: 0,
            total_tetrises: 0,
            total_tspins: 0,
            max_combo: 0,
            max_b2b_chain: 0,
            current_b2b_chain: 0,
            perfect_clears: 0,
        }
    }

    /// Evaluates T-Spin status according to SRS 3-corner rule and Test 4 kick exception
    pub fn check_t_spin(
        piece: &ActivePiece,
        board: &Board,
        last_move_was_rotation: bool,
        last_kick_index: usize,
    ) -> TSpinType {
        if !last_move_was_rotation || piece.piece_type != TetrominoType::T {
            return TSpinType::None;
        }

        // T-piece center is at (piece.x + 1, piece.y + 1)
        // 4 diagonal corners relative to bounding box top-left:
        // Top-left: (0, 0), Top-right: (2, 0), Bottom-left: (0, 2), Bottom-right: (2, 2)
        let corners = [
            (piece.x, piece.y),         // Top-left (0)
            (piece.x + 2, piece.y),     // Top-right (1)
            (piece.x, piece.y + 2),     // Bottom-left (2)
            (piece.x + 2, piece.y + 2), // Bottom-right (3)
        ];

        let is_occupied = |(cx, cy): (i32, i32)| -> bool {
            if cx < 0 || cx >= BOARD_WIDTH as i32 || cy >= BOARD_HEIGHT as i32 {
                return true; // Wall or floor counts as occupied
            }
            if cy < 0 {
                return false; // Above board is open air
            }
            board.cells[cy as usize][cx as usize].is_some()
        };

        let occupied_corners = [
            is_occupied(corners[0]),
            is_occupied(corners[1]),
            is_occupied(corners[2]),
            is_occupied(corners[3]),
        ];

        let occupied_count = occupied_corners.iter().filter(|&&o| o).count();
        if occupied_count < 3 {
            return TSpinType::None;
        }

        // Determine which 2 corners are the "front" (pointing side) corners
        let (front_a, front_b) = match piece.rotation {
            RotationState::R0 => (0, 1),   // Top-left, Top-right
            RotationState::R90 => (1, 3),  // Top-right, Bottom-right
            RotationState::R180 => (2, 3), // Bottom-left, Bottom-right
            RotationState::R270 => (0, 2), // Top-left, Bottom-left
        };

        let both_front_occupied = occupied_corners[front_a] && occupied_corners[front_b];

        if both_front_occupied {
            TSpinType::Regular
        } else if last_kick_index == 4 {
            // Test 5 (index 4) offset (1, 2) promotion exception
            TSpinType::Regular
        } else {
            TSpinType::Mini
        }
    }

    /// Evaluates lines cleared, T-Spin, Combo, B2B, and Perfect Clear, and returns the action type and points awarded
    pub fn process_placement(
        &mut self,
        cleared_lines: usize,
        t_spin: TSpinType,
        is_perfect_clear: bool,
        level_override: Option<u32>,
    ) -> (ActionType, u64) {
        self.total_pieces += 1;
        let effective_level = level_override.unwrap_or(self.level);

        let mut base_points: u64 = 0;
        let mut is_b2b_action = false;
        let action: ActionType;

        match (t_spin, cleared_lines) {
            (TSpinType::Regular, 0) => {
                base_points = 400;
                self.total_tspins += 1;
                action = ActionType::TSpinNone(TSpinType::Regular);
            }
            (TSpinType::Mini, 0) => {
                base_points = 100;
                self.total_tspins += 1;
                action = ActionType::TSpinNone(TSpinType::Mini);
            }
            (TSpinType::Regular, 1) => {
                base_points = 800;
                is_b2b_action = true;
                self.total_tspins += 1;
                action = ActionType::TSpinSingle(TSpinType::Regular);
            }
            (TSpinType::Mini, 1) => {
                base_points = 200;
                is_b2b_action = true;
                self.total_tspins += 1;
                action = ActionType::TSpinSingle(TSpinType::Mini);
            }
            (TSpinType::Regular, 2) => {
                base_points = 1200;
                is_b2b_action = true;
                self.total_tspins += 1;
                action = ActionType::TSpinDouble(TSpinType::Regular);
            }
            (TSpinType::Mini, 2) => {
                base_points = 400;
                is_b2b_action = true;
                self.total_tspins += 1;
                action = ActionType::TSpinDouble(TSpinType::Mini);
            }
            (TSpinType::Regular, 3) => {
                base_points = 1600;
                is_b2b_action = true;
                self.total_tspins += 1;
                action = ActionType::TSpinTriple;
            }
            (TSpinType::None, 1) => {
                base_points = 100;
                action = ActionType::Single;
            }
            (TSpinType::None, 2) => {
                base_points = 300;
                action = ActionType::Double;
            }
            (TSpinType::None, 3) => {
                base_points = 500;
                action = ActionType::Triple;
            }
            (TSpinType::None, 4) => {
                base_points = 800;
                is_b2b_action = true;
                self.total_tetrises += 1;
                action = ActionType::Tetris;
            }
            _ => {
                action = ActionType::None;
            }
        }

        let mut round_points: u64 = 0;

        if cleared_lines > 0 {
            self.lines += cleared_lines as u32;

            // B2B multiplier check
            if is_b2b_action {
                if self.back_to_back {
                    // 1.5x multiplier on B2B
                    round_points += (base_points * 3 / 2) * (effective_level as u64);
                    self.current_b2b_chain += 1;
                    if self.current_b2b_chain > self.max_b2b_chain {
                        self.max_b2b_chain = self.current_b2b_chain;
                    }
                } else {
                    round_points += base_points * (effective_level as u64);
                    self.back_to_back = true;
                    self.current_b2b_chain = 1;
                }
            } else {
                round_points += base_points * (effective_level as u64);
                self.back_to_back = false;
                self.current_b2b_chain = 0;
            }

            // Combo bonus
            if self.combo > 0 {
                let combo_bonus = 50 * (self.combo as u64) * (effective_level as u64);
                round_points += combo_bonus;
            }
            self.combo += 1;
            if self.combo > self.max_combo {
                self.max_combo = self.combo;
            }

            // Perfect clear bonus
            if is_perfect_clear {
                self.perfect_clears += 1;
                let pc_bonus = match cleared_lines {
                    1 => 800,
                    2 => 1200,
                    3 => 1800,
                    4 => 2000,
                    _ => 0,
                } * (effective_level as u64);
                round_points += pc_bonus;
            }
        } else {
            // No lines cleared
            if base_points > 0 {
                round_points += base_points * (effective_level as u64);
            }
            self.combo = 0;
            // B2B state is maintained when placing pieces without clearing lines
        }

        self.score += round_points;
        (action, round_points)
    }

    pub fn add_soft_drop_points(&mut self, cells: u32) {
        self.score += cells as u64;
    }

    pub fn add_hard_drop_points(&mut self, cells: u32) {
        self.score += (cells as u64) * 2;
    }
}
