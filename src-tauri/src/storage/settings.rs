use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct KeyBindings {
    pub move_left: String,
    pub move_right: String,
    pub soft_drop: String,
    pub hard_drop: String,
    pub rotate_cw: String,
    pub rotate_ccw: String,
    pub hold: String,
    pub pause: String,
    pub restart: String,
}

impl Default for KeyBindings {
    fn default() -> Self {
        Self {
            move_left: "ArrowLeft".into(),
            move_right: "ArrowRight".into(),
            soft_drop: "ArrowDown".into(),
            hard_drop: " ".into(), // Space
            rotate_cw: "ArrowUp".into(),
            rotate_ccw: "z".into(),
            hold: "c".into(),
            pause: "Escape".into(),
            restart: "r".into(),
        }
    }
}

impl KeyBindings {
    /// Validates that no two distinct actions share the exact same physical key
    pub fn validate_no_duplicates(&self) -> Result<(), String> {
        let mut seen = HashMap::new();
        let bindings = [
            ("Move Left", &self.move_left),
            ("Move Right", &self.move_right),
            ("Soft Drop", &self.soft_drop),
            ("Hard Drop", &self.hard_drop),
            ("Rotate CW", &self.rotate_cw),
            ("Rotate CCW", &self.rotate_ccw),
            ("Hold", &self.hold),
            ("Pause", &self.pause),
            ("Restart", &self.restart),
        ];

        for (action, key) in bindings {
            let key_norm = key.to_lowercase();
            if let Some(prev_action) = seen.insert(key_norm, action) {
                return Err(format!(
                    "Key conflict: '{}' is mapped to both {} and {}",
                    key, prev_action, action
                ));
            }
        }

        Ok(())
    }
}

fn default_language() -> String {
    "ja".into()
}

fn default_music_enabled() -> bool {
    true
}

fn default_music_volume() -> u32 {
    40
}

fn default_sfx_enabled() -> bool {
    true
}

fn default_sfx_volume() -> u32 {
    50
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct UserSettings {
    pub schema_version: u32,
    pub window_width: u32,
    pub window_height: u32,
    pub fullscreen: bool,
    pub show_ghost: bool,
    pub show_grid: bool,
    pub reduce_motion: bool,
    pub key_bindings: KeyBindings,
    pub das_ms: u32,
    pub arr_ms: u32,
    pub soft_drop_multiplier: u32,
    pub starting_level: u32,
    pub show_next_queue: bool,
    pub show_hold: bool,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default = "default_music_enabled")]
    pub music_enabled: bool,
    #[serde(default = "default_music_volume")]
    pub music_volume: u32,
    #[serde(default = "default_sfx_enabled")]
    pub sfx_enabled: bool,
    #[serde(default = "default_sfx_volume")]
    pub sfx_volume: u32,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            window_width: 800,
            window_height: 600,
            fullscreen: false,
            show_ghost: true,
            show_grid: true,
            reduce_motion: false,
            key_bindings: KeyBindings::default(),
            das_ms: 167,
            arr_ms: 33,
            soft_drop_multiplier: 20,
            starting_level: 1,
            show_next_queue: true,
            show_hold: true,
            language: "ja".into(),
            music_enabled: true,
            music_volume: 40,
            sfx_enabled: true,
            sfx_volume: 50,
        }
    }
}

impl UserSettings {
    pub fn load_or_default<P: AsRef<Path>>(path: P) -> Self {
        let p = path.as_ref();
        if !p.exists() {
            let default_settings = Self::default();
            let _ = Self::save_to_path(p, &default_settings);
            return default_settings;
        }

        match fs::read_to_string(p) {
            Ok(content) => match serde_json::from_str::<UserSettings>(&content) {
                Ok(mut settings) => {
                    settings.starting_level = settings.starting_level.clamp(1, 15);
                    settings.music_volume = settings.music_volume.min(100);
                    settings.sfx_volume = settings.sfx_volume.min(100);
                    settings
                }
                Err(err) => {
                    eprintln!("Corrupted settings file: {}. Backing up and resetting.", err);
                    let bak_path = p.with_extension("json.bak");
                    let _ = fs::copy(p, bak_path);
                    let default_settings = Self::default();
                    let _ = Self::save_to_path(p, &default_settings);
                    default_settings
                }
            },
            Err(_) => Self::default(),
        }
    }

    pub fn save_to_path<P: AsRef<Path>>(path: P, settings: &UserSettings) -> Result<(), String> {
        let p = path.as_ref();
        if let Some(parent) = p.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let json = serde_json::to_string_pretty(settings)
            .map_err(|e| format!("Serialization error: {}", e))?;
        fs::write(p, json).map_err(|e| format!("Write error: {}", e))
    }
}
