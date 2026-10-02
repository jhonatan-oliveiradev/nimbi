pub mod lifecycle;
pub mod nx_agent;
pub mod preferences;
pub mod runoptic;
pub mod state;
pub mod window;

#[cfg(test)]
mod nx_agent_tests;
#[cfg(test)]
mod preferences_tests;
#[cfg(test)]
mod runoptic_tests;
#[cfg(test)]
mod window_tests;

use std::sync::atomic::Ordering;
use std::time::Duration;

use lifecycle::TrayCommand;
use preferences::{
    save_preferences_to, NimbiPlacement, NimbiPresence, PreferencesV1,
};
use state::{NimbiActivity, NimbiSnapshot, RuntimeState};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};

#[tauri::command]
fn get_nimbi_snapshot(state: State<'_, RuntimeState>) -> NimbiSnapshot {
    state
        .snapshot
        .lock()
        .expect("Nimbi snapshot lock poisoned")
        .clone()
}

#[tauri::command]
fn get_preferences(state: State<'_, RuntimeState>) -> PreferencesV1 {
    state
        .preferences
        .lock()
        .expect("Nimbi preferences lock poisoned")
        .clone()
}

fn current_logical_size(state: &RuntimeState) -> window::LogicalSize {
    let rect = state.window_gate.rect();
    window::LogicalSize {
        width: if rect.w > 0.0 { rect.w } else { 144.0 },
        height: if rect.h > 0.0 { rect.h } else { 38.0 },
    }
}

fn apply_current_geometry(app: &AppHandle, state: &RuntimeState) {
    let preferences = state
        .preferences
        .lock()
        .expect("Nimbi preferences lock poisoned")
        .clone();
    window::apply_placement_geometry(
        app,
        &preferences.placement,
        current_logical_size(state),
        state.window_gate.collapsed.load(Ordering::Relaxed),
    );
}

fn commit_preferences(
    app: &AppHandle,
    state: &RuntimeState,
    next: PreferencesV1,
) -> Result<PreferencesV1, String> {
    let next = next.sanitized();
    save_preferences_to(&state.preferences_path, &next)?;
    *state
        .preferences
        .lock()
        .expect("Nimbi preferences lock poisoned") = next.clone();
    apply_current_geometry(app, state);
    let _ = app.emit("nimbi://preferences", &next);
    Ok(next)
}

#[tauri::command]
fn save_placement(
    placement: NimbiPlacement,
    app: AppHandle,
    state: State<'_, RuntimeState>,
) -> Result<PreferencesV1, String> {
    let mut next = get_preferences(state.clone());
    next.placement = placement;
    commit_preferences(&app, &state, next)
}

#[tauri::command]
fn save_presence(
    presence: NimbiPresence,
    app: AppHandle,
    state: State<'_, RuntimeState>,
) -> Result<PreferencesV1, String> {
    let mut next = get_preferences(state.clone());
    next.presence = presence;
    commit_preferences(&app, &state, next)
}

#[tauri::command]
fn reset_placement(
    app: AppHandle,
    state: State<'_, RuntimeState>,
) -> Result<PreferencesV1, String> {
    let mut next = get_preferences(state.clone());
    next.placement = NimbiPlacement::default();
    commit_preferences(&app, &state, next)
}

#[tauri::command]
fn set_visibility_hint(hidden: bool, state: State<'_, RuntimeState>) {
    state.hidden.store(hidden, Ordering::Relaxed);
}

#[tauri::command]
fn set_collapsed(collapsed: bool, app: AppHandle, state: State<'_, RuntimeState>) {
    state.window_gate.collapsed.store(collapsed, Ordering::Relaxed);
    apply_current_geometry(&app, &state);
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
    app: AppHandle,
    state: State<'_, RuntimeState>,
) {
    state.window_gate.set_rect(window::IslandRect {
        x,
        y,
        w: width,
        h: height,
    });
    if !state.dragging.load(Ordering::Relaxed) {
        apply_current_geometry(&app, &state);
    }
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
    apply_current_geometry(&app, &state);
}

#[tauri::command]
fn begin_drag(app: AppHandle, state: State<'_, RuntimeState>) {
    state.dragging.store(true, Ordering::Relaxed);
    window::set_ignore_cursor(&app, false);
    window::size_window_for_drag(&app);
}

#[tauri::command]
fn move_drag(app: AppHandle, state: State<'_, RuntimeState>) {
    if !state.dragging.load(Ordering::Relaxed) {
        return;
    }
    if let Some(point) = window::cursor_screen_point() {
        window::size_window_for_drag(&app);
        window::move_window_centered_at(&app, point);
    }
}

#[tauri::command]
fn commit_drag(
    app: AppHandle,
    state: State<'_, RuntimeState>,
) -> Result<PreferencesV1, String> {
    state.dragging.store(false, Ordering::Relaxed);
    let current = get_preferences(state.clone());
    let point = window::cursor_screen_point().ok_or_else(|| "cursor unavailable".to_string())?;
    let placement = window::placement_at_screen_point(&app, point, Some(&current.placement))
        .ok_or_else(|| "no monitor available".to_string())?;
    let mut next = current;
    next.placement = placement;
    commit_preferences(&app, &state, next)
}

#[tauri::command]
fn cancel_drag(app: AppHandle, state: State<'_, RuntimeState>) {
    state.dragging.store(false, Ordering::Relaxed);
    apply_current_geometry(&app, &state);
}

fn cursor_poll_should_run(collapsed: bool, _interactive: bool) -> bool {
    !collapsed
}

fn set_nimbi_window_visible(app: &AppHandle, visible: bool) {
    let state = app.state::<RuntimeState>();
    state.hidden.store(!visible, Ordering::Relaxed);

    if let Some(win) = window::window(app) {
        if visible {
            apply_current_geometry(app, &state);
            let _ = win.show();
            let collapsed = state.window_gate.collapsed.load(Ordering::Relaxed);
            let interactive = state.interactive.load(Ordering::Relaxed);
            state
                .window_gate
                .set_active(cursor_poll_should_run(collapsed, interactive));
        } else {
            state.window_gate.set_active(false);
            let _ = win.hide();
        }
    }
}

fn toggle_nimbi_window(app: &AppHandle) {
    let visible = window::window(app)
        .and_then(|win| win.is_visible().ok())
        .unwrap_or(false);
    set_nimbi_window_visible(app, !visible);
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "nimbi-show", "Show Nimbi", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "nimbi-hide", "Hide Nimbi", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "nimbi-quit", "Quit Nimbi", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    let mut tray = TrayIconBuilder::with_id("nimbi-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Nimbi");

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray
        .on_menu_event(|app, event| match lifecycle::tray_command(event.id().as_ref()) {
            Some(TrayCommand::Show) => set_nimbi_window_visible(app, true),
            Some(TrayCommand::Hide) => set_nimbi_window_visible(app, false),
            Some(TrayCommand::Quit) => app.exit(0),
            None => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_nimbi_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn polling_delay(hidden: bool, activity: &NimbiActivity) -> Duration {
    if hidden && matches!(activity, NimbiActivity::Idle | NimbiActivity::Offline) {
        Duration::from_secs(10)
    } else {
        Duration::from_secs(2)
    }
}

fn start_monitor_watch(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut previous = window::monitor_topology_key(&window::monitor_work_areas(&app));

        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;
            let next = window::monitor_topology_key(&window::monitor_work_areas(&app));
            if next == previous {
                continue;
            }
            previous = next;

            let state = app.state::<RuntimeState>();
            if !state.dragging.load(Ordering::Relaxed) {
                apply_current_geometry(&app, &state);
            }
        }
    });
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
            save_placement,
            save_presence,
            reset_placement,
            set_visibility_hint,
            set_collapsed,
            set_island_rect,
            set_interactive,
            reposition,
            begin_drag,
            move_drag,
            commit_drag,
            cancel_drag
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let state = app.state::<RuntimeState>();
            if let Some(win) = window::window(&handle) {
                window::make_non_activating(&win);
            }
            apply_current_geometry(&handle, &state);
            state.window_gate.set_active(true);
            window::spawn_cursor_poll(handle.clone(), state.window_gate.clone());
            start_monitor_watch(handle.clone());
            start_runoptic_poll(handle);
            setup_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != window::WINDOW_LABEL {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                set_nimbi_window_visible(window.app_handle(), false);
            }
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
