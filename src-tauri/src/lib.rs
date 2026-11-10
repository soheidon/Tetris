pub mod commands;
pub mod engine;
pub mod runtime;
pub mod storage;

use engine::GameEngine;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub engine: Arc<Mutex<GameEngine>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let engine_instance = Arc::new(Mutex::new(GameEngine::new(
        engine::modes::GameMode::Marathon,
        1,
        None,
    )));

    let loop_engine = Arc::clone(&engine_instance);

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(AppState {
            engine: engine_instance,
        })
        .setup(move |app| {
            runtime::loop_runner::spawn_game_loop(app.handle().clone(), loop_engine);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::game_commands::start_game,
            commands::game_commands::restart_game,
            commands::game_commands::pause_game,
            commands::game_commands::resume_game,
            commands::game_commands::send_input,
            commands::game_commands::get_game_state,
            commands::settings_commands::get_settings,
            commands::settings_commands::update_settings,
            commands::record_commands::get_records,
            commands::record_commands::save_record,
            commands::record_commands::reset_records,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
