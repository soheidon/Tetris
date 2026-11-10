use serde::{Deserialize, Serialize};
use super::board::Board;
use super::modes::{GameMode, ModeManager};
use super::movement::{Direction, InputState, MovementConfig};
use super::piece::{ActivePiece, TetrominoType};
use super::randomizer::SevenBagRandomizer;
use super::rotation::get_wall_kick_offsets;
use super::scoring::{ActionType, ScoreManager, TSpinType};
use super::state::{
    ActionNotification, ActivePieceDto, GameStateSnapshot, GameStatistics, GameStatus, InputAction,
};

pub const TICKS_PER_SECOND: u64 = 60;
pub const LOCK_DELAY_TICKS: u32 = 30; // 500ms at 60Hz
pub const MAX_LOCK_RESETS: u32 = 15;
pub const READY_COUNTDOWN_TICKS: u32 = 180; // 3 seconds at 60Hz

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum SfxType {
    Move,
    Rotate,
    Lock,
    LineClear,
    Tetris,
    TSpin,
    Hold,
    GameOver,
}

#[derive(Clone, Debug)]
pub struct GameEngine {
    pub board: Board,
    pub active_piece: Option<ActivePiece>,
    pub hold_piece: Option<TetrominoType>,
    pub can_hold: bool,
    pub randomizer: SevenBagRandomizer,
    pub movement_config: MovementConfig,
    pub input_state: InputState,
    pub score_manager: ScoreManager,
    pub mode_manager: ModeManager,
    pub status: GameStatus,
    pub elapsed_ticks: u64,
    pub ready_ticks_remaining: u32,
    pub gravity_timer: u32,
    pub lock_delay_timer: u32,
    pub lock_resets: u32,
    pub is_touching_ground: bool,
    pub last_move_was_rotation: bool,
    pub last_kick_index: usize,
    pub last_notification: Option<ActionNotification>,
    pub stats: Option<GameStatistics>,
    pub sfx_queue: Vec<SfxType>,
}

impl GameEngine {
    pub fn new(mode: GameMode, starting_level: u32, seed: Option<u64>) -> Self {
        let randomizer = match seed {
            Some(s) => SevenBagRandomizer::with_seed(s),
            None => SevenBagRandomizer::new(),
        };

        Self {
            board: Board::new(),
            active_piece: None,
            hold_piece: None,
            can_hold: true,
            randomizer,
            movement_config: MovementConfig::default(),
            input_state: InputState::new(),
            score_manager: ScoreManager::new(starting_level),
            mode_manager: ModeManager::new(mode, starting_level),
            status: GameStatus::Title,
            elapsed_ticks: 0,
            ready_ticks_remaining: READY_COUNTDOWN_TICKS,
            gravity_timer: 0,
            lock_delay_timer: 0,
            lock_resets: 0,
            is_touching_ground: false,
            last_move_was_rotation: false,
            last_kick_index: 0,
            last_notification: None,
            stats: None,
            sfx_queue: Vec::new(),
        }
    }

    /// Drains all accumulated sound effect events
    pub fn drain_sfx(&mut self) -> Vec<SfxType> {
        self.sfx_queue.drain(..).collect()
    }

    /// Starts a game in Ready state (countdown)
    pub fn start(&mut self) {
        self.status = GameStatus::Ready;
        self.ready_ticks_remaining = READY_COUNTDOWN_TICKS;
        self.elapsed_ticks = 0;
        self.board = Board::new();
        self.hold_piece = None;
        self.can_hold = true;
        self.last_notification = None;
        self.stats = None;
        self.sfx_queue.clear();
        self.spawn_next_piece();
    }

    pub fn pause(&mut self) {
        if self.status == GameStatus::Playing {
            self.status = GameStatus::Paused;
        }
    }

    pub fn resume(&mut self) {
        if self.status == GameStatus::Paused {
            self.status = GameStatus::Playing;
        }
    }

    pub fn toggle_pause(&mut self) {
        match self.status {
            GameStatus::Playing => self.pause(),
            GameStatus::Paused => self.resume(),
            _ => {}
        }
    }

    pub fn set_movement_config(&mut self, config: MovementConfig) {
        self.movement_config = config;
    }

    pub fn restart(&mut self) {
        let starting_level = self.mode_manager.starting_level;
        let mode = self.mode_manager.mode;
        let seed = self.randomizer.seed();
        *self = Self::new(mode, starting_level, Some(seed));
        self.start();
    }

    /// Spawns the next piece from the 7-bag randomizer
    fn spawn_next_piece(&mut self) {
        let piece_type = self.randomizer.next_piece();
        let piece = ActivePiece::new(piece_type);

        if !self.board.is_piece_valid(&piece) {
            // Block out (Top-out) game over
            self.handle_game_over();
            return;
        }

        self.active_piece = Some(piece);
        self.lock_delay_timer = 0;
        self.lock_resets = 0;
        self.gravity_timer = 0;
        self.last_move_was_rotation = false;
        self.last_kick_index = 0;
        self.update_ground_contact();
    }

    fn update_ground_contact(&mut self) {
        if let Some(mut piece) = self.active_piece {
            piece.y += 1;
            self.is_touching_ground = !self.board.is_piece_valid(&piece);
        } else {
            self.is_touching_ground = false;
        }
    }

    /// Handles keyboard input transitions
    pub fn handle_input(&mut self, action: InputAction, pressed: bool) {
        if action == InputAction::Pause && pressed {
            self.toggle_pause();
            return;
        }

        if action == InputAction::Restart && pressed {
            if self.status == GameStatus::GameOver || self.status == GameStatus::Completed {
                self.restart();
            }
            return;
        }

        if self.status != GameStatus::Playing {
            return;
        }

        match action {
            InputAction::MoveLeft => {
                self.input_state.set_key_direction(Direction::Left, pressed);
                if pressed {
                    self.try_move_horizontal(-1);
                }
            }
            InputAction::MoveRight => {
                self.input_state.set_key_direction(Direction::Right, pressed);
                if pressed {
                    self.try_move_horizontal(1);
                }
            }
            InputAction::SoftDrop => {
                self.input_state.set_soft_drop(pressed);
            }
            InputAction::HardDrop => {
                if pressed {
                    self.hard_drop();
                }
            }
            InputAction::RotateCW => {
                if pressed {
                    self.try_rotate(true);
                }
            }
            InputAction::RotateCCW => {
                if pressed {
                    self.try_rotate(false);
                }
            }
            InputAction::Hold => {
                if pressed {
                    self.try_hold();
                }
            }
            _ => {}
        }
    }

    /// Moves piece left or right by dx
    pub fn try_move_horizontal(&mut self, dx: i32) -> bool {
        let Some(mut piece) = self.active_piece else {
            return false;
        };

        piece.x += dx;
        if self.board.is_piece_valid(&piece) {
            self.active_piece = Some(piece);
            self.last_move_was_rotation = false;

            // Reset lock delay if touching ground
            self.update_ground_contact();
            if self.is_touching_ground && self.lock_resets < MAX_LOCK_RESETS {
                self.lock_delay_timer = 0;
                self.lock_resets += 1;
            }
            self.sfx_queue.push(SfxType::Move);
            true
        } else {
            false
        }
    }

    /// Rotates piece using SRS Wall Kicks
    pub fn try_rotate(&mut self, clockwise: bool) -> bool {
        let Some(piece) = self.active_piece else {
            return false;
        };

        let from_rot = piece.rotation;
        let to_rot = if clockwise {
            from_rot.rotate_cw()
        } else {
            from_rot.rotate_ccw()
        };

        let kicks = get_wall_kick_offsets(piece.piece_type, from_rot, to_rot);

        for (idx, &(dx, dy)) in kicks.iter().enumerate() {
            let mut candidate = piece;
            candidate.rotation = to_rot;
            candidate.x += dx;
            candidate.y += dy;

            if self.board.is_piece_valid(&candidate) {
                self.active_piece = Some(candidate);
                self.last_move_was_rotation = true;
                self.last_kick_index = idx;

                self.update_ground_contact();
                if self.is_touching_ground && self.lock_resets < MAX_LOCK_RESETS {
                    self.lock_delay_timer = 0;
                    self.lock_resets += 1;
                }
                self.sfx_queue.push(SfxType::Rotate);
                return true;
            }
        }

        false
    }

    /// Swaps or holds current piece
    pub fn try_hold(&mut self) -> bool {
        if !self.can_hold {
            return false;
        }

        let Some(piece) = self.active_piece else {
            return false;
        };

        let current_type = piece.piece_type;
        self.can_hold = false;

        if let Some(held) = self.hold_piece {
            self.hold_piece = Some(current_type);
            let next_piece = ActivePiece::new(held);
            if !self.board.is_piece_valid(&next_piece) {
                self.handle_game_over();
                return false;
            }
            self.active_piece = Some(next_piece);
        } else {
            self.hold_piece = Some(current_type);
            self.spawn_next_piece();
        }

        self.lock_delay_timer = 0;
        self.lock_resets = 0;
        self.gravity_timer = 0;
        self.last_move_was_rotation = false;
        self.update_ground_contact();
        self.sfx_queue.push(SfxType::Hold);
        true
    }

    /// Drops piece immediately and locks it
    pub fn hard_drop(&mut self) {
        let Some(mut piece) = self.active_piece else {
            return;
        };

        let mut dropped_cells = 0;
        while {
            let mut test_piece = piece;
            test_piece.y += 1;
            if self.board.is_piece_valid(&test_piece) {
                piece.y += 1;
                dropped_cells += 1;
                true
            } else {
                false
            }
        } {}

        self.active_piece = Some(piece);
        self.score_manager.add_hard_drop_points(dropped_cells);
        self.lock_active_piece();
    }

    /// Drops piece downwards by 1 cell (Soft drop)
    pub fn soft_drop_step(&mut self) -> bool {
        let Some(mut piece) = self.active_piece else {
            return false;
        };

        piece.y += 1;
        if self.board.is_piece_valid(&piece) {
            self.active_piece = Some(piece);
            self.score_manager.add_soft_drop_points(1);
            self.last_move_was_rotation = false;
            self.update_ground_contact();
            true
        } else {
            false
        }
    }

    /// Calculates the ghost piece landing position (y-coordinate)
    pub fn calculate_ghost_blocks(&self) -> Option<[(i32, i32); 4]> {
        let piece = self.active_piece?;
        let mut ghost = piece;

        while {
            let mut test_ghost = ghost;
            test_ghost.y += 1;
            if self.board.is_piece_valid(&test_ghost) {
                ghost.y += 1;
                true
            } else {
                false
            }
        } {}

        let raw_blocks = ghost.blocks();
        Some([
            (raw_blocks[0].0, raw_blocks[0].1 - 20),
            (raw_blocks[1].0, raw_blocks[1].1 - 20),
            (raw_blocks[2].0, raw_blocks[2].1 - 20),
            (raw_blocks[3].0, raw_blocks[3].1 - 20),
        ])
    }

    /// Locks current piece onto board, clears lines, computes score, and checks completion
    fn lock_active_piece(&mut self) {
        let Some(piece) = self.active_piece.take() else {
            return;
        };

        // Lock Out check: completely above row 20
        if self.board.is_all_above_visible(&piece) {
            self.handle_game_over();
            return;
        }

        // Evaluate T-Spin before placing
        let t_spin = ScoreManager::check_t_spin(
            &piece,
            &self.board,
            self.last_move_was_rotation,
            self.last_kick_index,
        );

        // Place blocks
        self.board.place_piece(&piece);

        // Clear lines
        let cleared = self.board.clear_lines();
        let is_pc = self.board.is_empty();

        // Level override: Ultra uses level 1 for scoring
        let level_override = if self.mode_manager.mode == GameMode::Ultra {
            Some(1)
        } else {
            None
        };

        // Process score & combos
        let (action, pts) = self.score_manager.process_placement(
            cleared.len(),
            t_spin,
            is_pc,
            level_override,
        );

        // Update Marathon level
        let new_level = self.mode_manager.get_current_level(self.score_manager.lines);
        self.score_manager.level = new_level;

        // Set action notification for UI banner
        self.last_notification = match action {
            ActionType::None => None,
            ActionType::Single => Some(ActionNotification {
                action_name: "Single".into(),
                combo: self.score_manager.combo,
                b2b: false,
                points: pts,
            }),
            ActionType::Double => Some(ActionNotification {
                action_name: "Double".into(),
                combo: self.score_manager.combo,
                b2b: false,
                points: pts,
            }),
            ActionType::Triple => Some(ActionNotification {
                action_name: "Triple".into(),
                combo: self.score_manager.combo,
                b2b: false,
                points: pts,
            }),
            ActionType::Tetris => Some(ActionNotification {
                action_name: "Tetris!".into(),
                combo: self.score_manager.combo,
                b2b: self.score_manager.back_to_back,
                points: pts,
            }),
            ActionType::TSpinNone(t) => Some(ActionNotification {
                action_name: format!("T-Spin {:?}", t),
                combo: 0,
                b2b: false,
                points: pts,
            }),
            ActionType::TSpinSingle(t) => Some(ActionNotification {
                action_name: format!("T-Spin {:?} Single", t),
                combo: self.score_manager.combo,
                b2b: self.score_manager.back_to_back,
                points: pts,
            }),
            ActionType::TSpinDouble(t) => Some(ActionNotification {
                action_name: format!("T-Spin {:?} Double", t),
                combo: self.score_manager.combo,
                b2b: self.score_manager.back_to_back,
                points: pts,
            }),
            ActionType::TSpinTriple => Some(ActionNotification {
                action_name: "T-Spin Triple!!".into(),
                combo: self.score_manager.combo,
                b2b: self.score_manager.back_to_back,
                points: pts,
            }),
            ActionType::PerfectClear(_) => Some(ActionNotification {
                action_name: "PERFECT CLEAR!!".into(),
                combo: self.score_manager.combo,
                b2b: self.score_manager.back_to_back,
                points: pts,
            }),
        };

        // Always queue Lock SFX upon piece touchdown / placement
        self.sfx_queue.push(SfxType::Lock);

        // Queue placement result SFX if applicable (LineClear, Tetris, TSpin)
        if cleared.len() == 4 {
            self.sfx_queue.push(SfxType::Tetris);
        } else if t_spin != TSpinType::None {
            self.sfx_queue.push(SfxType::TSpin);
        } else if !cleared.is_empty() {
            self.sfx_queue.push(SfxType::LineClear);
        }

        // Check Mode Completion
        if self
            .mode_manager
            .is_completed(self.score_manager.lines, self.elapsed_ticks)
        {
            self.handle_completed();
            return;
        }

        // Refresh hold permission on lock and spawn next piece
        self.can_hold = true;
        self.spawn_next_piece();
    }

    fn handle_game_over(&mut self) {
        self.status = GameStatus::GameOver;
        self.sfx_queue.push(SfxType::GameOver);
        self.build_statistics();
    }

    fn handle_completed(&mut self) {
        self.status = GameStatus::Completed;
        self.build_statistics();
    }

    fn build_statistics(&mut self) {
        let elapsed_seconds = (self.elapsed_ticks as f32) / (TICKS_PER_SECOND as f32);
        let pps = if elapsed_seconds > 0.0 {
            (self.score_manager.total_pieces as f32) / elapsed_seconds
        } else {
            0.0
        };

        self.stats = Some(GameStatistics {
            total_pieces: self.score_manager.total_pieces,
            pieces_per_second: pps,
            lines_cleared: self.score_manager.lines,
            total_tetrises: self.score_manager.total_tetrises,
            total_tspins: self.score_manager.total_tspins,
            max_combo: self.score_manager.max_combo,
            max_b2b_chain: self.score_manager.max_b2b_chain,
            perfect_clears: self.score_manager.perfect_clears,
            final_score: self.score_manager.score,
            elapsed_time_ms: self.elapsed_ticks * 1000 / TICKS_PER_SECOND,
            mode: self.mode_manager.mode,
        });
    }

    /// Fixed 60Hz tick
    pub fn tick(&mut self) {
        match self.status {
            GameStatus::Ready => {
                if self.ready_ticks_remaining > 0 {
                    self.ready_ticks_remaining -= 1;
                }
                if self.ready_ticks_remaining == 0 {
                    self.status = GameStatus::Playing;
                }
            }
            GameStatus::Playing => {
                self.elapsed_ticks += 1;

                // Mode time check (Ultra)
                if self
                    .mode_manager
                    .is_completed(self.score_manager.lines, self.elapsed_ticks)
                {
                    self.handle_completed();
                    return;
                }

                // DAS/ARR horizontal auto-repeat
                if let Some((dir, shifts)) =
                    self.input_state.update_das_arr(&self.movement_config)
                {
                    let dx = match dir {
                        Direction::Left => -1,
                        Direction::Right => 1,
                    };
                    for _ in 0..shifts {
                        if !self.try_move_horizontal(dx) {
                            break;
                        }
                    }
                }

                // Gravity interval
                let base_gravity_interval = self
                    .mode_manager
                    .get_gravity_interval_ticks(self.score_manager.level);

                let is_soft_dropping = self.input_state.soft_drop_pressed;

                if base_gravity_interval == 0 {
                    // 20G: drops to floor every tick
                    while self.soft_drop_step() {}
                } else if is_soft_dropping {
                    // True 20x (or configured multiplier) soft drop speed
                    let effective_interval = (base_gravity_interval / self.movement_config.soft_drop_factor).max(1);
                    self.gravity_timer += 1;
                    if self.gravity_timer >= effective_interval {
                        self.gravity_timer = 0;
                        let _ = self.soft_drop_step();
                    }
                } else {
                    self.gravity_timer += 1;
                    if self.gravity_timer >= base_gravity_interval {
                        self.gravity_timer = 0;
                        let _ = self.soft_drop_step();
                    }
                }

                // Lock Delay handling
                self.update_ground_contact();
                if self.is_touching_ground {
                    self.lock_delay_timer += 1;
                    if self.lock_delay_timer >= LOCK_DELAY_TICKS
                        || self.lock_resets >= MAX_LOCK_RESETS
                    {
                        self.lock_active_piece();
                    }
                } else {
                    self.lock_delay_timer = 0;
                }
            }
            _ => {}
        }
    }

    /// Produces snapshot DTO for UI rendering
    pub fn snapshot(&self) -> GameStateSnapshot {
        let countdown = if self.status == GameStatus::Ready {
            Some((self.ready_ticks_remaining / 60) + 1)
        } else {
            None
        };

        GameStateSnapshot {
            board: self.board.visible_cells(),
            active_piece: self.active_piece.as_ref().map(ActivePieceDto::from),
            ghost_blocks: self.calculate_ghost_blocks(),
            hold_piece: self.hold_piece,
            can_hold: self.can_hold,
            next_queue: self.randomizer.peek_next(5),
            score: self.score_manager.score,
            level: self.score_manager.level,
            lines: self.score_manager.lines,
            combo: self.score_manager.combo,
            back_to_back: self.score_manager.back_to_back,
            elapsed_time_ms: self.elapsed_ticks * 1000 / TICKS_PER_SECOND,
            remaining_time_ms: self.mode_manager.remaining_time_ms(self.elapsed_ticks),
            status: self.status,
            countdown_seconds: countdown,
            mode: self.mode_manager.mode,
            last_action: self.last_notification.clone(),
            stats: self.stats.clone(),
        }
    }
}
