use falling_blocks_lib::engine::board::Board;
use falling_blocks_lib::engine::game::{GameEngine, SfxType};
use falling_blocks_lib::engine::modes::GameMode;
use falling_blocks_lib::engine::piece::{ActivePiece, RotationState, TetrominoType};
use falling_blocks_lib::engine::randomizer::SevenBagRandomizer;
use falling_blocks_lib::engine::scoring::{ActionType, ScoreManager, TSpinType};
use falling_blocks_lib::engine::state::{GameStatus, InputAction};
use falling_blocks_lib::storage::records::{RecordEntry, RecordsData};
use falling_blocks_lib::storage::settings::UserSettings;
use std::collections::HashSet;
use std::fs;

// 1. 全7種類のピース生成
#[test]
fn test_piece_generation() {
    for &piece_type in &TetrominoType::ALL {
        let piece = ActivePiece::new(piece_type);
        assert_eq!(piece.piece_type, piece_type);
        assert_eq!(piece.rotation, RotationState::R0);
        let blocks = piece.blocks();
        assert_eq!(blocks.len(), 4);
    }
}

// 2. 7-bagの分布
#[test]
fn test_seven_bag_distribution() {
    let mut randomizer = SevenBagRandomizer::with_seed(42);

    for _ in 0..10 {
        let mut bag_set = HashSet::new();
        for _ in 0..7 {
            let p = randomizer.next_piece();
            assert!(bag_set.insert(p), "Piece {:?} was duplicated in a single 7-bag", p);
        }
        assert_eq!(bag_set.len(), 7);
    }
}

// 3. 固定シードでの再現性
#[test]
fn test_fixed_seed_reproducibility() {
    let mut r1 = SevenBagRandomizer::with_seed(99999);
    let mut r2 = SevenBagRandomizer::with_seed(99999);

    let seq1: Vec<_> = (0..50).map(|_| r1.next_piece()).collect();
    let seq2: Vec<_> = (0..50).map(|_| r2.next_piece()).collect();

    assert_eq!(seq1, seq2);
}

// 4. 左右移動と壁衝突
#[test]
fn test_horizontal_movement_and_wall_collision() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }
    assert_eq!(engine.status, GameStatus::Playing);

    // Move fully left
    for _ in 0..15 {
        engine.try_move_horizontal(-1);
    }
    let piece_left = engine.active_piece.unwrap();
    let min_x = piece_left.blocks().iter().map(|&(x, _)| x).min().unwrap();
    assert_eq!(min_x, 0, "Piece should stop at left wall x=0");

    // Move fully right
    for _ in 0..20 {
        engine.try_move_horizontal(1);
    }
    let piece_right = engine.active_piece.unwrap();
    let max_x = piece_right.blocks().iter().map(|&(x, _)| x).max().unwrap();
    assert_eq!(max_x, 9, "Piece should stop at right wall x=9");
}

// 5. 床衝突
#[test]
fn test_floor_collision() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }

    let mut dropped = 0;
    while engine.soft_drop_step() {
        dropped += 1;
        assert!(dropped < 40, "Piece fell more than board height!");
    }

    let piece = engine.active_piece.unwrap();
    let max_y = piece.blocks().iter().map(|&(_, y)| y).max().unwrap();
    assert_eq!(max_y, 39, "Piece should touch the bottom floor at y=39");
}

// 6. SRS回転
#[test]
fn test_srs_basic_rotation() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }

    let initial = engine.active_piece.unwrap();
    assert_eq!(initial.rotation, RotationState::R0);

    assert!(engine.try_rotate(true));
    assert_eq!(engine.active_piece.unwrap().rotation, RotationState::R90);

    assert!(engine.try_rotate(true));
    assert_eq!(engine.active_piece.unwrap().rotation, RotationState::R180);

    assert!(engine.try_rotate(true));
    assert_eq!(engine.active_piece.unwrap().rotation, RotationState::R270);

    assert!(engine.try_rotate(true));
    assert_eq!(engine.active_piece.unwrap().rotation, RotationState::R0);
}

// 7. Wall Kick (JLSTZ and I across transitions)
#[test]
fn test_srs_wall_kick() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.status = GameStatus::Playing;

    // 1. JLSTZ T-piece against right wall (0 -> 1)
    let mut t_right = ActivePiece::new(TetrominoType::T);
    t_right.x = 8;
    t_right.y = 25;
    t_right.rotation = RotationState::R0;
    engine.active_piece = Some(t_right);
    assert!(engine.try_rotate(true), "T-piece 0->1 against right wall should succeed via kick");
    assert!(engine.active_piece.unwrap().blocks().iter().all(|&(x, _)| x < 10));

    // 2. JLSTZ T-piece against left wall (0 -> 3)
    let mut t_left = ActivePiece::new(TetrominoType::T);
    t_left.x = -1;
    t_left.y = 25;
    t_left.rotation = RotationState::R0;
    engine.active_piece = Some(t_left);
    assert!(engine.try_rotate(false), "T-piece 0->3 against left wall should succeed via kick");
    assert!(engine.active_piece.unwrap().blocks().iter().all(|&(x, _)| x >= 0));

    // 3. I-piece against right wall (0 -> 1)
    let mut i_right = ActivePiece::new(TetrominoType::I);
    i_right.x = 8;
    i_right.y = 25;
    i_right.rotation = RotationState::R0;
    engine.active_piece = Some(i_right);
    assert!(engine.try_rotate(true), "I-piece 0->1 against right wall should kick into bounds");
    assert!(engine.active_piece.unwrap().blocks().iter().all(|&(x, _)| x >= 0 && x < 10));

    // 4. I-piece against floor (1 -> 2)
    let mut i_floor = ActivePiece::new(TetrominoType::I);
    i_floor.x = 4;
    i_floor.y = 36;
    i_floor.rotation = RotationState::R90;
    engine.active_piece = Some(i_floor);
    assert!(engine.try_rotate(true), "I-piece 1->2 against floor should kick upwards");
    assert!(engine.active_piece.unwrap().blocks().iter().all(|&(_, y)| y < 40));
}

// 8. Hold制限
#[test]
fn test_hold_mechanism() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }

    let first_piece = engine.active_piece.unwrap().piece_type;
    assert!(engine.can_hold);

    assert!(engine.try_hold());
    assert_eq!(engine.hold_piece, Some(first_piece));
    assert!(!engine.can_hold);

    assert!(!engine.try_hold(), "Second hold in same turn must fail");

    engine.hard_drop();
    assert!(engine.can_hold, "can_hold must reset after piece locks");
}

// 9. Ghost位置
#[test]
fn test_ghost_piece_calculation() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }

    let ghost_blocks = engine.calculate_ghost_blocks().expect("Ghost blocks must exist");
    let ghost_max_y = ghost_blocks.iter().map(|&(_, y)| y).max().unwrap();

    let mut clone_engine = engine.clone();
    clone_engine.hard_drop();

    assert_eq!(ghost_max_y, 19, "Ghost piece should project to floor y=19 (39-20)");
}

// 10. Soft Drop (Speed and scoring)
#[test]
fn test_soft_drop_speed_and_distance() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }

    // Level 1 base gravity is 60 ticks. Soft drop factor is 20x -> effective interval is 3 ticks.
    let initial_y = engine.active_piece.unwrap().y;
    engine.input_state.soft_drop_pressed = true;

    // 2 ticks: no drop yet
    engine.tick();
    engine.tick();
    assert_eq!(engine.active_piece.unwrap().y, initial_y);

    // 3rd tick: soft drop triggers 1 cell drop and awards 1 point
    engine.tick();
    assert_eq!(engine.active_piece.unwrap().y, initial_y + 1);
    assert_eq!(engine.score_manager.score, 1);
}

// 11. Hard Drop
#[test]
fn test_hard_drop_instant_lock() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }

    let initial_piece = engine.active_piece.unwrap().piece_type;
    engine.hard_drop();

    assert_ne!(engine.active_piece.unwrap().piece_type, initial_piece);
    assert!(engine.score_manager.score > 0, "Hard drop should award points");
}

// 12. Lock Delay
#[test]
fn test_lock_delay_timing() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }

    while engine.soft_drop_step() {}

    let initial_piece = engine.active_piece.unwrap();

    for _ in 0..29 {
        engine.tick();
    }
    assert_eq!(engine.active_piece.unwrap().piece_type, initial_piece.piece_type);

    engine.tick();
    assert_ne!(engine.active_piece.unwrap().piece_type, initial_piece.piece_type);
}

// 13. Lock Delayリセット上限
#[test]
fn test_lock_delay_reset_limit() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }

    while engine.soft_drop_step() {}

    for i in 0..15 {
        let dx = if i % 2 == 0 { 1 } else { -1 };
        assert!(engine.try_move_horizontal(dx));
        assert_eq!(engine.lock_resets, (i + 1) as u32);
    }

    assert!(engine.try_move_horizontal(1));
    assert_eq!(engine.lock_resets, 15, "lock_resets must cap at 15");
}

// 14. Single / Double / Triple / Tetris
#[test]
fn test_line_clear_types() {
    let mut score_mgr = ScoreManager::new(1);

    // 1. Single (1 line, 100 * 1 = 100)
    let (a1, p1) = score_mgr.process_placement(1, TSpinType::None, false, None);
    assert_eq!(a1, ActionType::Single);
    assert_eq!(p1, 100);

    // 2. Double (2 lines, 300 * 1 = 300)
    let (a2, p2) = score_mgr.process_placement(2, TSpinType::None, false, None);
    assert_eq!(a2, ActionType::Double);
    // Combo 1 bonus: 50 * 1 * 1 = 50 -> 350
    assert_eq!(p2, 350);

    // Reset combo
    score_mgr.process_placement(0, TSpinType::None, false, None);

    // 3. Triple (3 lines, 500 * 1 = 500)
    let (a3, p3) = score_mgr.process_placement(3, TSpinType::None, false, None);
    assert_eq!(a3, ActionType::Triple);
    assert_eq!(p3, 500);

    // Reset combo
    score_mgr.process_placement(0, TSpinType::None, false, None);

    // 4. Tetris (4 lines, 800 * 1 = 800)
    let (a4, p4) = score_mgr.process_placement(4, TSpinType::None, false, None);
    assert_eq!(a4, ActionType::Tetris);
    assert_eq!(p4, 800);
}

// 15. T-Spin各種 (Regular, Mini, Test 4 kick promotion, Line clears)
#[test]
fn test_t_spin_detection() {
    let mut board = Board::new();

    // 1. Regular T-Spin: 3 corners, both front corners occupied
    board.cells[36][3] = Some(TetrominoType::I); // Front-left
    board.cells[36][5] = Some(TetrominoType::I); // Front-right
    board.cells[38][3] = Some(TetrominoType::I); // Back-left
    let mut t_piece = ActivePiece::new(TetrominoType::T);
    t_piece.x = 3;
    t_piece.y = 36;
    t_piece.rotation = RotationState::R0;

    let tspin_reg = ScoreManager::check_t_spin(&t_piece, &board, true, 0);
    assert_eq!(tspin_reg, TSpinType::Regular);

    // 2. T-Spin Mini: 3 corners, only 1 front corner occupied, kick index < 4
    let mut board_mini = Board::new();
    board_mini.cells[36][3] = Some(TetrominoType::I); // Front-left
    board_mini.cells[38][3] = Some(TetrominoType::I); // Back-left
    board_mini.cells[38][5] = Some(TetrominoType::I); // Back-right (Front-right is open)
    let tspin_mini = ScoreManager::check_t_spin(&t_piece, &board_mini, true, 0);
    assert_eq!(tspin_mini, TSpinType::Mini);

    // 3. Test 4 kick promotion: only 1 front corner occupied, but kick index is 4 (Test 5) -> Promoted to Regular!
    let tspin_promoted = ScoreManager::check_t_spin(&t_piece, &board_mini, true, 4);
    assert_eq!(tspin_promoted, TSpinType::Regular);

    // 4. Line clear scoring classifications (testing each with fresh ScoreManager to isolate B2B)
    let mut score_mgr1 = ScoreManager::new(1);
    let (act_mini1, pts_mini1) = score_mgr1.process_placement(1, TSpinType::Mini, false, None);
    assert_eq!(act_mini1, ActionType::TSpinSingle(TSpinType::Mini));
    assert_eq!(pts_mini1, 200);

    let mut score_mgr2 = ScoreManager::new(1);
    let (act_reg2, pts_reg2) = score_mgr2.process_placement(2, TSpinType::Regular, false, None);
    assert_eq!(act_reg2, ActionType::TSpinDouble(TSpinType::Regular));
    assert_eq!(pts_reg2, 1200);

    let mut score_mgr3 = ScoreManager::new(1);
    let (act_reg3, pts_reg3) = score_mgr3.process_placement(3, TSpinType::Regular, false, None);
    assert_eq!(act_reg3, ActionType::TSpinTriple);
    assert_eq!(pts_reg3, 1600);
}

// 16. Combo
#[test]
fn test_combo_bonus() {
    let mut score_mgr = ScoreManager::new(1);

    let (_, pts1) = score_mgr.process_placement(1, TSpinType::None, false, None);
    assert_eq!(pts1, 100);
    assert_eq!(score_mgr.combo, 1);

    let (_, pts2) = score_mgr.process_placement(1, TSpinType::None, false, None);
    assert_eq!(pts2, 150);
    assert_eq!(score_mgr.combo, 2);

    score_mgr.process_placement(0, TSpinType::None, false, None);
    assert_eq!(score_mgr.combo, 0);
}

// 17. B2B
#[test]
fn test_back_to_back_chain() {
    let mut score_mgr = ScoreManager::new(1);

    let (_, pts1) = score_mgr.process_placement(4, TSpinType::None, false, None);
    assert_eq!(pts1, 800);
    assert!(score_mgr.back_to_back);

    let (_, pts2) = score_mgr.process_placement(4, TSpinType::None, false, None);
    assert_eq!(pts2, 1250);
    assert!(score_mgr.back_to_back);

    let (_, _pts3) = score_mgr.process_placement(1, TSpinType::None, false, None);
    assert!(!score_mgr.back_to_back);
}

// 18. Perfect Clear
#[test]
fn test_perfect_clear_bonus() {
    let mut score_mgr = ScoreManager::new(1);
    let (_, pts) = score_mgr.process_placement(4, TSpinType::None, true, None);
    assert_eq!(pts, 2800);
}

// 19. Top-out
#[test]
fn test_top_out_game_over() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }

    for x in 0..10 {
        engine.board.cells[18][x] = Some(TetrominoType::I);
        engine.board.cells[19][x] = Some(TetrominoType::I);
    }

    engine.hard_drop();
    assert_eq!(engine.status, GameStatus::GameOver);
}

// 20. Marathonレベル上昇
#[test]
fn test_marathon_level_progression() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.start();

    engine.score_manager.lines = 10;
    let new_level = engine.mode_manager.get_current_level(engine.score_manager.lines);
    assert_eq!(new_level, 2);

    let gravity_lv1 = engine.mode_manager.get_gravity_interval_ticks(1);
    let gravity_lv2 = engine.mode_manager.get_gravity_interval_ticks(2);
    assert!(gravity_lv2 < gravity_lv1, "Level 2 gravity must be faster (fewer ticks) than Level 1");
}

// 21. Sprintクリア (Simulating line clears through engine until completion)
#[test]
fn test_sprint_40l_completion() {
    let mut engine = GameEngine::new(GameMode::Sprint, 1, Some(101));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }

    // Simulate 10 Tetrises (40 lines) through gameplay
    for i in 1..=10 {
        // Clear board completely so each iteration has a clean canvas
        engine.board = Board::new();

        // Pre-fill bottom 4 rows (36..40) except column 9
        for row in 36..40 {
            for col in 0..9 {
                engine.board.cells[row][col] = Some(TetrominoType::O);
            }
        }

        // Spawn vertical I-piece in column 9 (offsets at R90 are (2,0), (2,1), (2,2), (2,3))
        let mut i_piece = ActivePiece::new(TetrominoType::I);
        i_piece.rotation = RotationState::R90;
        i_piece.x = 7; // x + 2 = 9
        i_piece.y = 20;
        engine.active_piece = Some(i_piece);

        // Hard drop lands at y=36 (blocks at rows 36, 37, 38, 39 in column 9), completing all 4 lines
        engine.hard_drop();
        assert_eq!(engine.score_manager.lines, i * 4, "Each Tetris should add exactly 4 lines");
    }

    assert_eq!(engine.score_manager.lines, 40, "40 lines must be cleared");
    assert_eq!(engine.status, GameStatus::Completed, "Sprint must transition to Completed");
    assert!(engine.stats.is_some(), "Statistics must be calculated on completion");
    let stats = engine.stats.as_ref().unwrap();
    assert_eq!(stats.lines_cleared, 40);
    assert!(stats.total_pieces >= 10);
    assert!(stats.pieces_per_second >= 0.0);
}

// 22. Ultra時間終了
#[test]
fn test_ultra_120_time_limit() {
    let mut engine = GameEngine::new(GameMode::Ultra, 1, Some(101));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }

    for _ in 0..7200 {
        engine.tick();
    }

    assert_eq!(engine.status, GameStatus::Completed);
}

// 23. Pause中の時間・状態停止 (Verifying all timers freeze)
#[test]
fn test_pause_time_freezing() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }

    // Set initial timers
    engine.gravity_timer = 15;
    engine.lock_delay_timer = 10;
    engine.input_state.das_timer = 5;

    engine.pause();
    assert_eq!(engine.status, GameStatus::Paused);

    let initial_ticks = engine.elapsed_ticks;
    let initial_gravity = engine.gravity_timer;
    let initial_lock_delay = engine.lock_delay_timer;
    let initial_das = engine.input_state.das_timer;

    for _ in 0..60 {
        engine.tick();
    }

    assert_eq!(engine.elapsed_ticks, initial_ticks, "Elapsed ticks must not advance while paused");
    assert_eq!(engine.gravity_timer, initial_gravity, "Gravity timer must not advance while paused");
    assert_eq!(engine.lock_delay_timer, initial_lock_delay, "Lock delay timer must not advance while paused");
    assert_eq!(engine.input_state.das_timer, initial_das, "DAS timer must not advance while paused");
}

// 24. 高速連続入力
#[test]
fn test_high_speed_input_queue() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }

    engine.handle_input(InputAction::MoveLeft, true);
    engine.handle_input(InputAction::RotateCW, true);
    engine.handle_input(InputAction::MoveRight, true);
    engine.handle_input(InputAction::SoftDrop, true);

    assert_eq!(engine.status, GameStatus::Playing);
    assert!(engine.active_piece.is_some());
}

// 25. 記録データの読み書き
#[test]
fn test_storage_serialization_and_recovery() {
    let temp_dir = std::env::temp_dir().join("falling_blocks_test_storage");
    let _ = fs::create_dir_all(&temp_dir);

    let settings_path = temp_dir.join("settings.json");
    let records_path = temp_dir.join("records.json");

    let mut settings = UserSettings::default();
    assert_eq!(settings.language, "ja", "Default language must be 'ja'");
    settings.das_ms = 150;
    settings.language = "en".into();
    UserSettings::save_to_path(&settings_path, &settings).unwrap();
    let loaded_settings = UserSettings::load_or_default(&settings_path);
    assert_eq!(loaded_settings.das_ms, 150);
    assert_eq!(loaded_settings.language, "en");

    // Legacy JSON without language, music_enabled, music_volume fields must deserialize seamlessly with defaults
    let legacy_json = r#"{
        "schema_version": 1,
        "window_width": 800,
        "window_height": 600,
        "fullscreen": false,
        "show_ghost": true,
        "show_grid": true,
        "reduce_motion": false,
        "key_bindings": {
            "move_left": "ArrowLeft",
            "move_right": "ArrowRight",
            "soft_drop": "ArrowDown",
            "hard_drop": " ",
            "rotate_cw": "ArrowUp",
            "rotate_ccw": "z",
            "hold": "c",
            "pause": "Escape",
            "restart": "r"
        },
        "das_ms": 167,
        "arr_ms": 33,
        "soft_drop_multiplier": 20,
        "starting_level": 1,
        "show_next_queue": true,
        "show_hold": true
    }"#;
    fs::write(&settings_path, legacy_json).unwrap();
    let legacy_loaded = UserSettings::load_or_default(&settings_path);
    assert_eq!(legacy_loaded.language, "ja", "Legacy settings without language must default to 'ja'");
    assert_eq!(legacy_loaded.music_enabled, true, "Legacy settings without music_enabled must default to true");
    assert_eq!(legacy_loaded.music_volume, 40, "Legacy settings without music_volume must default to 40");
    assert!(!settings_path.with_extension("json.bak").exists(), "Legacy file must not trigger backup corruption");

    // Out-of-range volume clamping check
    let out_of_range_json = r#"{
        "schema_version": 1,
        "window_width": 800,
        "window_height": 600,
        "fullscreen": false,
        "show_ghost": true,
        "show_grid": true,
        "reduce_motion": false,
        "key_bindings": {
            "move_left": "ArrowLeft",
            "move_right": "ArrowRight",
            "soft_drop": "ArrowDown",
            "hard_drop": " ",
            "rotate_cw": "ArrowUp",
            "rotate_ccw": "z",
            "hold": "c",
            "pause": "Escape",
            "restart": "r"
        },
        "das_ms": 167,
        "arr_ms": 33,
        "soft_drop_multiplier": 20,
        "starting_level": 99,
        "show_next_queue": true,
        "show_hold": true,
        "language": "en",
        "music_enabled": true,
        "music_volume": 250
    }"#;
    fs::write(&settings_path, out_of_range_json).unwrap();
    let clamped_loaded = UserSettings::load_or_default(&settings_path);
    assert_eq!(clamped_loaded.starting_level, 15, "starting_level must clamp to 15");
    assert_eq!(clamped_loaded.music_volume, 100, "music_volume must clamp to 100");

    fs::write(&settings_path, "{ corrupted json: invalid").unwrap();
    let recovered_settings = UserSettings::load_or_default(&settings_path);
    assert_eq!(recovered_settings.das_ms, 167);
    assert!(settings_path.with_extension("json.bak").exists());

    let mut records = RecordsData::new();
    for i in 1..=12 {
        records.add_record(
            GameMode::Marathon,
            RecordEntry {
                score: i * 1000,
                lines: (i * 10) as u32,
                level: Some(1),
                time_ms: 60000,
                pieces: Some(50),
                pps: Some(1.2),
                date: "2026-11-10".into(),
                timestamp_unix: 1794300000 + i,
            },
        );
    }
    assert_eq!(records.marathon.len(), 10, "Top 10 cap must be enforced");
    assert_eq!(records.marathon[0].score, 12000, "Highest score must be first");

    RecordsData::save_to_path(&records_path, &records).unwrap();
    let loaded_records = RecordsData::load_or_default(&records_path);
    assert_eq!(loaded_records.marathon.len(), 10);
    assert_eq!(loaded_records.marathon[0].score, 12000);

    let _ = fs::remove_dir_all(&temp_dir);
}

// 26. 単一キータップ時の1マス移動およびDAS/ARRタイマー遷移の確定的検証 (Double Shift Bug是正検証)
#[test]
fn test_single_key_tap_and_das_timing() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(101));
    engine.status = GameStatus::Playing;

    // テスト用のピースを配置 (中央 x = 5, y = 20)
    let mut piece = ActivePiece::new(TetrominoType::T);
    piece.x = 5;
    piece.y = 20;
    engine.active_piece = Some(piece);

    // 1. キー押下直後の即時シフト (Tick 0): 1マスのみ移動
    engine.handle_input(InputAction::MoveLeft, true);
    assert_eq!(
        engine.active_piece.as_ref().unwrap().x,
        4,
        "Keydown should immediately move piece by 1 cell"
    );

    // 2. DAS待機期間 (Tick 1..=10): 重複移動が一切発生せず、x == 4 を維持すること
    for tick in 1..=10 {
        engine.tick();
        assert_eq!(
            engine.active_piece.as_ref().unwrap().x,
            4,
            "Tick {} (during DAS wait) must not move the piece",
            tick
        );
    }

    // 3. Tick 11 (DAS超過・ARR開始): arr_timer = 1 のため移動なし
    engine.tick();
    assert_eq!(
        engine.active_piece.as_ref().unwrap().x,
        4,
        "Tick 11 (ARR tick 1) must not move the piece"
    );

    // 4. Tick 12 (第1回 ARR リピートシフト): 1マス移動して x == 3
    engine.tick();
    assert_eq!(
        engine.active_piece.as_ref().unwrap().x,
        3,
        "Tick 12 (first ARR repeat) must move piece to x=3"
    );

    // 5. Tick 13: arr_timer = 1 のため移動なし
    engine.tick();
    assert_eq!(
        engine.active_piece.as_ref().unwrap().x,
        3,
        "Tick 13 must not move the piece"
    );

    // 6. Tick 14 (第2回 ARR リピートシフト): 1マス移動して x == 2
    engine.tick();
    assert_eq!(
        engine.active_piece.as_ref().unwrap().x,
        2,
        "Tick 14 (second ARR repeat) must move piece to x=2"
    );

    // 7. キー解放 (KeyUp): 移動が停止すること
    engine.handle_input(InputAction::MoveLeft, false);
    engine.tick(); // Tick 15
    assert_eq!(
        engine.active_piece.as_ref().unwrap().x,
        2,
        "Tick 15 (after key release) must keep piece at x=2"
    );
}

// 27. 全8種類の効果音（SfxType）の生成およびdrain_sfxの検証
#[test]
fn test_sfx_queue_and_drain_all_eight_variants() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(42));
    engine.start();
    // Ready countdown
    for _ in 0..180 {
        engine.tick();
    }
    assert_eq!(engine.status, GameStatus::Playing);
    let _ = engine.drain_sfx();

    // 1. Move SFX
    let moved = engine.try_move_horizontal(1);
    assert!(moved);
    let sfx = engine.drain_sfx();
    assert_eq!(sfx, vec![SfxType::Move], "Horizontal move must queue SfxType::Move");

    // 2. Rotate SFX
    let rotated = engine.try_rotate(true);
    assert!(rotated);
    let sfx = engine.drain_sfx();
    assert_eq!(sfx, vec![SfxType::Rotate], "Rotation must queue SfxType::Rotate");

    // 3. Hold SFX
    let held = engine.try_hold();
    assert!(held);
    let sfx = engine.drain_sfx();
    assert_eq!(sfx, vec![SfxType::Hold], "Hold must queue SfxType::Hold");

    // 4. Lock SFX (Hard Drop with no lines cleared)
    engine.hard_drop();
    let sfx = engine.drain_sfx();
    assert!(sfx.contains(&SfxType::Lock), "Placement with no line clears must queue SfxType::Lock");

    // 5. LineClear SFX (1 line clear, alongside Lock SFX)
    engine.board = Board::new();
    for col in 0..9 {
        engine.board.cells[39][col] = Some(TetrominoType::O);
    }
    let mut i_piece = ActivePiece::new(TetrominoType::I);
    i_piece.rotation = RotationState::R90;
    i_piece.x = 7;
    i_piece.y = 20;
    engine.active_piece = Some(i_piece);
    engine.drain_sfx();
    engine.hard_drop();
    let sfx = engine.drain_sfx();
    assert_eq!(sfx, vec![SfxType::Lock, SfxType::LineClear], "Single line clear must queue both Lock and LineClear");

    // 6. Tetris SFX (4 lines clear, alongside Lock SFX)
    engine.board = Board::new();
    for row in 36..40 {
        for col in 0..9 {
            engine.board.cells[row][col] = Some(TetrominoType::O);
        }
    }
    let mut i_piece4 = ActivePiece::new(TetrominoType::I);
    i_piece4.rotation = RotationState::R90;
    i_piece4.x = 7;
    i_piece4.y = 20;
    engine.active_piece = Some(i_piece4);
    engine.drain_sfx();
    engine.hard_drop();
    let sfx = engine.drain_sfx();
    assert_eq!(sfx, vec![SfxType::Lock, SfxType::Tetris], "4-line clear must queue both Lock and Tetris");

    // 7. T-Spin SFX (alongside Lock SFX)
    engine.board = Board::new();
    engine.board.cells[36][3] = Some(TetrominoType::I); // Front-left
    engine.board.cells[36][5] = Some(TetrominoType::I); // Front-right
    engine.board.cells[38][3] = Some(TetrominoType::I); // Back-left
    let mut t_piece = ActivePiece::new(TetrominoType::T);
    t_piece.x = 3;
    t_piece.y = 36;
    t_piece.rotation = RotationState::R0;
    engine.active_piece = Some(t_piece);
    engine.last_move_was_rotation = true;
    engine.last_kick_index = 0;
    engine.drain_sfx();
    engine.hard_drop();
    let sfx = engine.drain_sfx();
    assert!(sfx.contains(&SfxType::Lock) && sfx.contains(&SfxType::TSpin), "T-Spin placement must queue both Lock and TSpin");

    // 8. GameOver SFX (Block out)
    engine.board = Board::new();
    for col in 0..10 {
        for row in 18..23 {
            engine.board.cells[row][col] = Some(TetrominoType::O);
        }
    }
    let next_p = ActivePiece::new(TetrominoType::O);
    engine.active_piece = Some(next_p);
    engine.drain_sfx();
    engine.hard_drop();
    let sfx = engine.drain_sfx();
    assert!(sfx.contains(&SfxType::GameOver), "Game over must queue SfxType::GameOver");
}

// 28. UserSettingsの後方互換性および音量クランプ検証
#[test]
fn test_user_settings_sfx_backward_compatibility_and_clamping() {
    // 過去バージョンの JSON（sfx_enabled, sfx_volume が存在しない）
    let legacy_json = r#"{
        "schema_version": 1,
        "window_width": 800,
        "window_height": 600,
        "fullscreen": false,
        "show_ghost": true,
        "show_grid": true,
        "reduce_motion": false,
        "key_bindings": {
            "move_left": "ArrowLeft",
            "move_right": "ArrowRight",
            "soft_drop": "ArrowDown",
            "hard_drop": " ",
            "rotate_cw": "ArrowUp",
            "rotate_ccw": "z",
            "hold": "c",
            "pause": "Escape",
            "restart": "r"
        },
        "das_ms": 167,
        "arr_ms": 33,
        "soft_drop_multiplier": 20,
        "starting_level": 1,
        "show_next_queue": true,
        "show_hold": true,
        "language": "ja",
        "music_enabled": true,
        "music_volume": 40
    }"#;

    let settings: UserSettings = serde_json::from_str(legacy_json).expect("Deserialization must succeed");
    assert_eq!(settings.sfx_enabled, true, "Default sfx_enabled must be true");
    assert_eq!(settings.sfx_volume, 50, "Default sfx_volume must be 50");

    // 音量クランプ検証（load_or_default経由）
    let temp_dir = std::env::temp_dir().join(format!("test_fb_settings_{}", std::process::id()));
    let _ = fs::create_dir_all(&temp_dir);
    let settings_file = temp_dir.join("settings.json");

    let clamped_json = r#"{
        "schema_version": 1,
        "window_width": 800,
        "window_height": 600,
        "fullscreen": false,
        "show_ghost": true,
        "show_grid": true,
        "reduce_motion": false,
        "key_bindings": {
            "move_left": "ArrowLeft",
            "move_right": "ArrowRight",
            "soft_drop": "ArrowDown",
            "hard_drop": " ",
            "rotate_cw": "ArrowUp",
            "rotate_ccw": "z",
            "hold": "c",
            "pause": "Escape",
            "restart": "r"
        },
        "das_ms": 167,
        "arr_ms": 33,
        "soft_drop_multiplier": 20,
        "starting_level": 1,
        "show_next_queue": true,
        "show_hold": true,
        "language": "ja",
        "music_enabled": true,
        "music_volume": 120,
        "sfx_enabled": true,
        "sfx_volume": 150
    }"#;
    fs::write(&settings_file, clamped_json).unwrap();
    let loaded = UserSettings::load_or_default(&settings_file);
    assert_eq!(loaded.music_volume, 100, "Music volume must be clamped to 100");
    assert_eq!(loaded.sfx_volume, 100, "SFX volume must be clamped to 100");
    let _ = fs::remove_dir_all(&temp_dir);
}

// 29. 60Hz ティックおよび ARR 連続移動における SFX 生成検証
#[test]
fn test_sfx_emission_via_tick_and_input() {
    let mut engine = GameEngine::new(GameMode::Marathon, 1, Some(12345));
    engine.start();
    for _ in 0..180 {
        engine.tick();
    }
    let _ = engine.drain_sfx();

    // ARR 連続移動テスト: KeyDown で 1 マス移動
    engine.handle_input(InputAction::MoveLeft, true);
    let sfx = engine.drain_sfx();
    assert_eq!(sfx, vec![SfxType::Move]);

    // Tick 1〜10 (DAS待機): SFXなし
    for _ in 1..=10 {
        engine.tick();
        assert!(engine.drain_sfx().is_empty());
    }

    // Tick 11 (ARR tick 1): SFXなし
    engine.tick();
    assert!(engine.drain_sfx().is_empty());

    // Tick 12 (第1回 ARR リピート移動): Move SFX がキューイングされること
    engine.tick();
    let sfx = engine.drain_sfx();
    assert_eq!(sfx, vec![SfxType::Move], "ARR repeat must generate SfxType::Move in tick");
}

