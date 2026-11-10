use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum GameMode {
    #[default]
    Marathon,
    Sprint,
    Ultra,
}

#[derive(Clone, Debug)]
pub struct ModeManager {
    pub mode: GameMode,
    pub starting_level: u32,
    pub target_lines: u32,
    pub time_limit_ticks: u32,
}

impl ModeManager {
    pub fn new(mode: GameMode, starting_level: u32) -> Self {
        let (target_lines, time_limit_ticks) = match mode {
            GameMode::Marathon => (0, 0),
            GameMode::Sprint => (40, 0),
            GameMode::Ultra => (0, 120 * 60), // 120 seconds * 60 ticks
        };

        Self {
            mode,
            starting_level: starting_level.clamp(1, 15),
            target_lines,
            time_limit_ticks,
        }
    }

    /// Calculates the current Marathon level based on lines cleared and starting level
    pub fn get_current_level(&self, total_lines: u32) -> u32 {
        match self.mode {
            GameMode::Marathon => {
                let calculated = self.starting_level + (total_lines / 10);
                calculated.min(20)
            }
            GameMode::Sprint | GameMode::Ultra => 1,
        }
    }

    /// Returns gravity interval in ticks per 1 cell drop.
    /// If 0, represents 20G (instant floor drop).
    pub fn get_gravity_interval_ticks(&self, level: u32) -> u32 {
        match self.mode {
            GameMode::Sprint | GameMode::Ultra => 60,
            GameMode::Marathon => match level {
                1 => 60,
                2 => 50,
                3 => 42,
                4 => 34,
                5 => 28,
                6 => 22,
                7 => 17,
                8 => 12,
                9 => 9,
                10 => 7,
                11 => 5,
                12 => 4,
                13 => 3,
                14 => 2,
                15..=19 => 1,
                _ => 0, // 20G
            },
        }
    }

    /// Checks if the win/completion condition of the mode has been fulfilled
    pub fn is_completed(&self, total_lines: u32, elapsed_ticks: u64) -> bool {
        match self.mode {
            GameMode::Marathon => false, // Ends on Top-out
            GameMode::Sprint => total_lines >= self.target_lines,
            GameMode::Ultra => elapsed_ticks >= self.time_limit_ticks as u64,
        }
    }

    /// Remaining time in ms (for Ultra mode)
    pub fn remaining_time_ms(&self, elapsed_ticks: u64) -> Option<u64> {
        if self.mode == GameMode::Ultra {
            let total_ticks = self.time_limit_ticks as u64;
            let remaining_ticks = total_ticks.saturating_sub(elapsed_ticks);
            Some(remaining_ticks * 1000 / 60)
        } else {
            None
        }
    }
}
