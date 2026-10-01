pub mod runoptic;
pub mod state;
pub mod window;

#[cfg(test)]
mod runoptic_tests;
#[cfg(test)]
mod window_tests;

use std::sync::atomic::Ordering;
use std::time::Duration;

use state::{NimbiActivity, NimbiSnapshot, RuntimeState};
use tauri::{AppHandle, Emitter, Manager, State};

#[tauri::command]
fn get_nimbi_snapshot(state: State<'_, RuntimeState>) -> NimbiSnapshot {
    state
        .snapshot
        .lock()
        .expect("Nimbi snapshot lock poisoned")
        .clone()
}

#[tauri::command]
fn set_visibility_hint(hidden: bool, state: State<'_, RuntimeState>) {
    state.hidden.store(hidden, Ordering::Relaxed);
    state.window_gate.set_active(!hidden);
    if hidden {
        state.window_gate.forget_ignore_state();
    }
}

#[tauri::command]
fn set_collapsed(collapsed: bool, app: AppHandle, state: State<'_, RuntimeState>) {
    state.window_gate.collapsed.store(collapsed, Ordering::Relaxed);
    window::apply_geometry(&app, collapsed);
    let interactive = state.interactive.load(Ordering::Relaxed);
    state
        .window_gate
        .set_active(cursor_poll_should_run(collapsed, interactive));
    if collapsed {
        window::set_ignore_cursor(&app, false);
    }
}

#[tauri::command]
fn set_island_rect(
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    state: State<'_, RuntimeState>,
) {
    state.window_gate.set_rect(window::IslandRect {
        x,
        y,
        w: width,
        h: height,
    });
}

#[tauri::command]
fn set_interactive(interactive: bool, app: AppHandle, state: State<'_, RuntimeState>) {
    let Some(win) = window::window(&app) else {
        return;
    };

    state.interactive.store(interactive, Ordering::Relaxed);
    window::set_activating(&win, interactive);
    let collapsed = state.window_gate.collapsed.load(Ordering::Relaxed);
    state
        .window_gate
        .set_active(cursor_poll_should_run(collapsed, interactive));
    if interactive {
        let _ = win.set_ignore_cursor_events(false);
        let _ = win.set_focus();
    } else if !collapsed {
        state.window_gate.forget_ignore_state();
    }
}

#[tauri::command]
fn reposition(app: AppHandle, state: State<'_, RuntimeState>) {
    window::apply_geometry(
        &app,
        state.window_gate.collapsed.load(Ordering::Relaxed),
    );
}

fn cursor_poll_should_run(collapsed: bool, interactive: bool) -> bool {
    !collapsed && !interactive
}

fn polling_delay(hidden: bool, activity: &NimbiActivity) -> Duration {
    if hidden && matches!(activity, NimbiActivity::Idle | NimbiActivity::Offline) {
        Duration::from_secs(10)
    } else {
        Duration::from_secs(2)
    }
}

fn start_runoptic_poll(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let client = runoptic::RunOpticClient::default();

        loop {
            let previous = {
                let state = app.state::<RuntimeState>();
                state
                    .snapshot
                    .lock()
                    .expect("Nimbi snapshot lock poisoned")
                    .clone()
            };

            let next = client.fetch(Some(&previous)).await;
            if next != previous {
                {
                    let state = app.state::<RuntimeState>();
                    *state
                        .snapshot
                        .lock()
                        .expect("Nimbi snapshot lock poisoned") = next.clone();
                }
                let _ = app.emit("nimbi://snapshot", &next);
            }

            let delay = {
                let state = app.state::<RuntimeState>();
                polling_delay(
                    state.hidden.load(Ordering::Relaxed),
                    &next.activity,
                )
            };
            tokio::time::sleep(delay).await;
        }
    });
}

pub fn run() {
    tauri::Builder::default()
        .manage(RuntimeState::new())
        .invoke_handler(tauri::generate_handler![
            get_nimbi_snapshot,
            set_visibility_hint,
            set_collapsed,
            set_island_rect,
            set_interactive,
            reposition
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let state = app.state::<RuntimeState>();
            if let Some(win) = window::window(&handle) {
                window::make_non_activating(&win);
            }
            window::apply_geometry(&handle, false);
            state.window_gate.set_active(true);
            window::spawn_cursor_poll(handle.clone(), state.window_gate.clone());
            start_runoptic_poll(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Nimbi");
}

#[cfg(test)]
mod runtime_tests {
    use super::*;

    #[test]
    fn cursor_poll_parks_when_collapsed_or_interactive() {
        assert!(cursor_poll_should_run(false, false));
        assert!(!cursor_poll_should_run(true, false));
        assert!(!cursor_poll_should_run(false, true));
        assert!(!cursor_poll_should_run(true, true));
    }

    #[test]
    fn hidden_idle_polling_is_slow() {
        assert_eq!(
            polling_delay(true, &NimbiActivity::Idle),
            Duration::from_secs(10)
        );
        assert_eq!(
            polling_delay(true, &NimbiActivity::Offline),
            Duration::from_secs(10)
        );
    }

    #[test]
    fn visible_or_active_polling_is_fast() {
        assert_eq!(
            polling_delay(false, &NimbiActivity::Idle),
            Duration::from_secs(2)
        );
        assert_eq!(
            polling_delay(true, &NimbiActivity::Working),
            Duration::from_secs(2)
        );
    }
}
