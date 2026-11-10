use crate::engine::game::GameEngine;
use crate::engine::state::GameStatus;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub fn spawn_game_loop(app: AppHandle, engine_arc: Arc<Mutex<GameEngine>>) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_nanos(1_000_000_000 / 60)); // 60Hz fixed step
        let mut tick_counter: u64 = 0;
        let mut prev_status = GameStatus::Title;

        loop {
            interval.tick().await;

            let (snapshot, status_changed, sfx_events) = {
                let mut engine = match engine_arc.lock() {
                    Ok(e) => e,
                    Err(_) => continue,
                };

                let current_status = engine.status;

                if current_status == GameStatus::Ready || current_status == GameStatus::Playing {
                    engine.tick();
                }

                let sfx = engine.drain_sfx();

                let new_status = engine.status;
                let status_changed = new_status != prev_status;
                prev_status = new_status;

                let snapshot = engine.snapshot();
                (snapshot, status_changed, sfx)
            };

            for ev in sfx_events {
                let _ = app.emit("game_sfx", ev);
            }

            tick_counter += 1;

            // Emit at ~30Hz (every 2 ticks) or immediately when status changes
            if status_changed || tick_counter % 2 == 0 {
                let _ = app.emit("game_state_update", &snapshot);
            }
        }
    });
}
