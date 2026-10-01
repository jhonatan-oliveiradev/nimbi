pub mod preferences;
pub mod runoptic;
pub mod state;
pub mod window;

#[cfg(test)]
mod preferences_tests;
#[cfg(test)]
mod runoptic_tests;
#[cfg(test)]
mod window_tests;

use std::sync::atomic::Ordering;
use std::time::Duration;

use preferences::NimbiPreferences;
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
fn get_preferences(state: State<'_, RuntimeState>) -> NimbiPreferences {
    state
        .preferences
        .lock()
        .expect("Nimbi preferences lock poisoned")
        .clone()
}

fn store_preferences(
    next: NimbiPreferences,
    app: &AppHandle,
    state: &RuntimeState,
) -> Result<NimbiPreferences, String> {
    let normalized = next.normalized();

    let path = state
        .preferences_path
        .lock()
        .map_err(|_| "Nimbi preferences path lock poisoned".to_string())?
        .clone();

    if let Some(path) = path {
        preferences::save(&path, &normalized).map_err(|error| error.to_string())?;
    }

    state
        .window_gate
        .set_placement(normalized.placement.clone());

    *state
        .preferences
        .lock()
        .map_err(|_| "Nimbi preferences lock poisoned".to_string())? =
        normalized.clone();

    let collapsed = state.window_gate.collapsed.load(Ordering::Relaxed);
    let _ = window::apply_geometry(app, &normalized.placement, collapsed);
    let _ = app.emit("nimbi://preferences", &normalized);
    Ok(normalized)
}

#[tauri::command]
fn set_preferences(
    preferences: NimbiPreferences,
    app: AppHandle,
    state: State<'_, RuntimeState>,
) -> Result<NimbiPreferences, String> {
    store_preferences(preferences, &app, &state)
}

#[tauri::command]
fn get_shell_layout(
    app: AppHandle,
    state: State<'_, RuntimeState>,
) -> Option<window::ShellLayoutPayload> {
    let placement = state.window_gate.placement();
    window::shell_layout(
        &app,
        &placement,
        state.window_gate.collapsed.load(Ordering::Relaxed),
    )
}

#[tauri::command]
fn resolve_placement_from_cursor(
    app: AppHandle,
    state: State<'_, RuntimeState>,
) -> Result<Option<NimbiPreferences>, String> {
    let Some(placement) = window::resolve_placement_from_cursor(&app, 64.0) else {
        return Ok(None);
    };

    let mut preferences = state
        .preferences
        .lock()
        .map_err(|_| "Nimbi preferences lock poisoned".to_string())?
        .clone();
    preferences.placement = placement;
    store_preferences(preferences, &app, &state).map(Some)
}


#[tauri::command]
fn set_visibility_hint(hidden: bool, state: State<'_, RuntimeState>) {
    state.hidden.store(hidden, Ordering::Relaxed);
}

#[tauri::command]
fn set_collapsed(collapsed: bool, app: AppHandle, state: State<'_, RuntimeState>) {
    state.window_gate.collapsed.store(collapsed, Ordering::Relaxed);
    let placement = state.window_gate.placement();
    let _ = window::apply_geometry(&app, &placement, collapsed);
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
    let placement = state.window_gate.placement();
    let _ = window::apply_geometry(
        &app,
        &placement,
        state.window_gate.collapsed.load(Ordering::Relaxed),
    );
}

fn cursor_poll_should_run(collapsed: bool, _interactive: bool) -> bool {
    !collapsed
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
                let snapshot = state
                    .snapshot
                    .lock()
                    .expect("Nimbi snapshot lock poisoned")
                    .clone();
                snapshot
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
            get_preferences,
            set_preferences,
            get_shell_layout,
            resolve_placement_from_cursor,
            set_visibility_hint,
            set_collapsed,
            set_island_rect,
            set_interactive,
            reposition
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let state = app.state::<RuntimeState>();

            if let Ok(config_dir) = app.path().app_config_dir() {
                let path = config_dir.join("preferences.json");
                let loaded = preferences::load_or_default(&path);
                state.window_gate.set_placement(loaded.placement.clone());
                *state
                    .preferences
                    .lock()
                    .expect("Nimbi preferences lock poisoned") = loaded;
                *state
                    .preferences_path
                    .lock()
                    .expect("Nimbi preferences path lock poisoned") = Some(path);
            } else {
                let placement = state
                    .preferences
                    .lock()
                    .expect("Nimbi preferences lock poisoned")
                    .placement
                    .clone();
                state.window_gate.set_placement(placement);
            }

            if let Some(win) = window::window(&handle) {
                window::make_non_activating(&win);
            }
            let placement = state.window_gate.placement();
            let _ = window::apply_geometry(&handle, &placement, false);
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
    fn cursor_poll_stays_active_for_visible_interactive_islands() {
        assert!(cursor_poll_should_run(false, false));
        assert!(cursor_poll_should_run(false, true));
        assert!(!cursor_poll_should_run(true, false));
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
