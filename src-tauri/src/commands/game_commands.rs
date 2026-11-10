use crate::engine::modes::GameMode;
use crate::engine::movement::MovementConfig;
use crate::engine::state::{GameStateSnapshot, InputAction};
use crate::storage::settings::UserSettings;
use crate::AppState;
use tauri::{AppHandle, Emitter, Manager, State};

#[tauri::command]
pub fn start_game(
    app: AppHandle,
    state: State<'_, AppState>,
    mode: Option<GameMode>,
    starting_level: Option<u32>,
) -> Result<GameStateSnapshot, String> {
    let mut engine = state.engine.lock().map_err(|e| e.to_string())?;
    let mode = mode.unwrap_or(GameMode::Marathon);
    let level = starting_level.unwrap_or(1);

    // Load persisted movement configuration (DAS/ARR/SoftDrop)
    let settings_path = app
        .path()
        .app_data_dir()
        .map(|d| d.join("settings.json"))
        .unwrap_or_default();
    let settings = UserSettings::load_or_default(&settings_path);

    *engine = crate::engine::GameEngine::new(mode, level, None);
    engine.set_movement_config(MovementConfig::from_ms(
        settings.das_ms,
        settings.arr_ms,
        settings.soft_drop_multiplier,
    ));
    engine.start();
    for ev in engine.drain_sfx() {
        let _ = app.emit("game_sfx", ev);
    }

    Ok(engine.snapshot())
}

#[tauri::command]
pub fn restart_game(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<GameStateSnapshot, String> {
    let mut engine = state.engine.lock().map_err(|e| e.to_string())?;
    let settings_path = app
        .path()
        .app_data_dir()
        .map(|d| d.join("settings.json"))
        .unwrap_or_default();
    let settings = UserSettings::load_or_default(&settings_path);

    engine.restart();
    for ev in engine.drain_sfx() {
        let _ = app.emit("game_sfx", ev);
    }
    engine.set_movement_config(MovementConfig::from_ms(
        settings.das_ms,
        settings.arr_ms,
        settings.soft_drop_multiplier,
    ));

    Ok(engine.snapshot())
}

#[tauri::command]
pub fn pause_game(state: State<'_, AppState>) -> Result<GameStateSnapshot, String> {
    let mut engine = state.engine.lock().map_err(|e| e.to_string())?;
    engine.pause();
    Ok(engine.snapshot())
}

#[tauri::command]
pub fn resume_game(state: State<'_, AppState>) -> Result<GameStateSnapshot, String> {
    let mut engine = state.engine.lock().map_err(|e| e.to_string())?;
    engine.resume();
    Ok(engine.snapshot())
}

#[tauri::command]
pub fn send_input(
    app: AppHandle,
    state: State<'_, AppState>,
    action: InputAction,
    pressed: bool,
) -> Result<(), String> {
    let mut engine = state.engine.lock().map_err(|e| e.to_string())?;
    engine.handle_input(action, pressed);
    let sfx = engine.drain_sfx();
    for ev in sfx {
        let _ = app.emit("game_sfx", ev);
    }
    Ok(())
}

#[tauri::command]
pub fn get_game_state(state: State<'_, AppState>) -> Result<GameStateSnapshot, String> {
    let engine = state.engine.lock().map_err(|e| e.to_string())?;
    Ok(engine.snapshot())
}
