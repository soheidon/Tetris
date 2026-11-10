use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Direction {
    Left,
    Right,
}

#[derive(Clone, Debug)]
pub struct MovementConfig {
    pub das_ticks: u32,       // e.g. 10 ticks for ~167ms at 60Hz
    pub arr_ticks: u32,       // e.g. 2 ticks for ~33ms at 60Hz
    pub soft_drop_factor: u32,// 20x gravity
}

impl Default for MovementConfig {
    fn default() -> Self {
        Self {
            das_ticks: 10,
            arr_ticks: 2,
            soft_drop_factor: 20,
        }
    }
}

impl MovementConfig {
    pub fn from_ms(das_ms: u32, arr_ms: u32, soft_drop_multiplier: u32) -> Self {
        // 60Hz: 1 tick = 16.666667ms
        let das_ticks = ((das_ms as f32) / 16.666667).round().max(1.0) as u32;
        let arr_ticks = if arr_ms == 0 {
            0
        } else {
            ((arr_ms as f32) / 16.666667).round().max(1.0) as u32
        };

        Self {
            das_ticks,
            arr_ticks,
            soft_drop_factor: soft_drop_multiplier.max(1),
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct InputState {
    pub left_pressed: bool,
    pub right_pressed: bool,
    pub soft_drop_pressed: bool,
    pub active_direction: Option<Direction>,
    pub das_timer: u32,
    pub arr_timer: u32,
}

impl InputState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Updates direction key press state with SOCD Last-Win logic
    pub fn set_key_direction(&mut self, dir: Direction, pressed: bool) {
        match dir {
            Direction::Left => {
                self.left_pressed = pressed;
                if pressed {
                    self.active_direction = Some(Direction::Left);
                    self.das_timer = 0;
                    self.arr_timer = 0;
                } else if self.right_pressed {
                    self.active_direction = Some(Direction::Right);
                    self.das_timer = 0;
                    self.arr_timer = 0;
                } else {
                    self.active_direction = None;
                }
            }
            Direction::Right => {
                self.right_pressed = pressed;
                if pressed {
                    self.active_direction = Some(Direction::Right);
                    self.das_timer = 0;
                    self.arr_timer = 0;
                } else if self.left_pressed {
                    self.active_direction = Some(Direction::Left);
                    self.das_timer = 0;
                    self.arr_timer = 0;
                } else {
                    self.active_direction = None;
                }
            }
        }
    }

    pub fn set_soft_drop(&mut self, pressed: bool) {
        self.soft_drop_pressed = pressed;
    }

    /// Steps DAS/ARR timers for 1 tick.
    /// Returns the number of columns to shift and the direction (e.g. 1 shift, or multiple if ARR == 0).
    pub fn update_das_arr(&mut self, config: &MovementConfig) -> Option<(Direction, u32)> {
        let dir = self.active_direction?;

        self.das_timer += 1;

        if self.das_timer > config.das_ticks {
            if config.arr_ticks == 0 {
                // Instant shift to wall
                return Some((dir, 10));
            }

            self.arr_timer += 1;
            if self.arr_timer >= config.arr_ticks {
                self.arr_timer = 0;
                return Some((dir, 1));
            }
        }

        None
    }
}
