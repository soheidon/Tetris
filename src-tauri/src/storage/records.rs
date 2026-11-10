use crate::engine::modes::GameMode;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct RecordEntry {
    pub score: u64,
    pub lines: u32,
    pub level: Option<u32>,
    pub time_ms: u64,
    pub pieces: Option<u32>,
    pub pps: Option<f32>,
    pub date: String,
    pub timestamp_unix: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct RecordsData {
    pub schema_version: u32,
    pub marathon: Vec<RecordEntry>,
    pub sprint: Vec<RecordEntry>,
    pub ultra: Vec<RecordEntry>,
}

impl RecordsData {
    pub fn new() -> Self {
        Self {
            schema_version: 1,
            marathon: Vec::new(),
            sprint: Vec::new(),
            ultra: Vec::new(),
        }
    }

    pub fn add_record(&mut self, mode: GameMode, entry: RecordEntry) {
        match mode {
            GameMode::Marathon => {
                self.marathon.push(entry);
                // Sort by score descending; stable sort keeps earlier timestamp higher on tie
                self.marathon.sort_by(|a, b| {
                    b.score
                        .cmp(&a.score)
                        .then_with(|| a.timestamp_unix.cmp(&b.timestamp_unix))
                });
                self.marathon.truncate(10);
            }
            GameMode::Sprint => {
                self.sprint.push(entry);
                // Sort by time_ms ascending (faster is better)
                self.sprint.sort_by(|a, b| {
                    a.time_ms
                        .cmp(&b.time_ms)
                        .then_with(|| a.timestamp_unix.cmp(&b.timestamp_unix))
                });
                self.sprint.truncate(10);
            }
            GameMode::Ultra => {
                self.ultra.push(entry);
                // Sort by score descending
                self.ultra.sort_by(|a, b| {
                    b.score
                        .cmp(&a.score)
                        .then_with(|| a.timestamp_unix.cmp(&b.timestamp_unix))
                });
                self.ultra.truncate(10);
            }
        }
    }

    pub fn load_or_default<P: AsRef<Path>>(path: P) -> Self {
        let p = path.as_ref();
        if !p.exists() {
            let default_data = Self::new();
            let _ = Self::save_to_path(p, &default_data);
            return default_data;
        }

        match fs::read_to_string(p) {
            Ok(content) => match serde_json::from_str::<RecordsData>(&content) {
                Ok(data) => data,
                Err(err) => {
                    eprintln!("Corrupted records file: {}. Backing up and resetting.", err);
                    let bak_path = p.with_extension("json.bak");
                    let _ = fs::copy(p, bak_path);
                    let default_data = Self::new();
                    let _ = Self::save_to_path(p, &default_data);
                    default_data
                }
            },
            Err(_) => Self::new(),
        }
    }

    pub fn save_to_path<P: AsRef<Path>>(path: P, data: &RecordsData) -> Result<(), String> {
        let p = path.as_ref();
        if let Some(parent) = p.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let json = serde_json::to_string_pretty(data)
            .map_err(|e| format!("Serialization error: {}", e))?;
        fs::write(p, json).map_err(|e| format!("Write error: {}", e))
    }
}
