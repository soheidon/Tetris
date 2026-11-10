use crate::engine::movement::MovementConfig;
use crate::storage::settings::UserSettings;
use crate::AppState;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

fn get_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;
    Ok(app_dir.join("settings.json"))
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<UserSettings, String> {
    let path = get_settings_path(&app)?;
    Ok(UserSettings::load_or_default(path))
}

#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: UserSettings,
) -> Result<(), String> {
    settings.key_bindings.validate_no_duplicates()?;
    let path = get_settings_path(&app)?;

    // Persist to disk
    UserSettings::save_to_path(path, &settings)?;

    // Apply directly to active engine instance
    if let Ok(mut engine) = state.engine.lock() {
        engine.set_movement_config(MovementConfig::from_ms(
            settings.das_ms,
            settings.arr_ms,
            settings.soft_drop_multiplier,
        ));
    }

    Ok(())
}
