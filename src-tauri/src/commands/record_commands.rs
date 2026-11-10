use crate::engine::modes::GameMode;
use crate::storage::records::{RecordEntry, RecordsData};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn get_records_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;
    Ok(app_dir.join("records.json"))
}

#[tauri::command]
pub fn get_records(app: AppHandle) -> Result<RecordsData, String> {
    let path = get_records_path(&app)?;
    Ok(RecordsData::load_or_default(path))
}

#[tauri::command]
pub fn save_record(app: AppHandle, mode: GameMode, entry: RecordEntry) -> Result<(), String> {
    let path = get_records_path(&app)?;
    let mut records = RecordsData::load_or_default(&path);
    records.add_record(mode, entry);
    RecordsData::save_to_path(path, &records)
}

#[tauri::command]
pub fn reset_records(app: AppHandle, mode: Option<GameMode>) -> Result<(), String> {
    let path = get_records_path(&app)?;
    let mut records = RecordsData::load_or_default(&path);
    match mode {
        Some(GameMode::Marathon) => records.marathon.clear(),
        Some(GameMode::Sprint) => records.sprint.clear(),
        Some(GameMode::Ultra) => records.ultra.clear(),
        None => {
            records.marathon.clear();
            records.sprint.clear();
            records.ultra.clear();
        }
    }
    RecordsData::save_to_path(path, &records)
}
