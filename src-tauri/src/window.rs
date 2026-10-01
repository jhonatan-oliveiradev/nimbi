use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Monitor, PhysicalPosition, PhysicalSize, WebviewWindow};

#[cfg(windows)]
use windows::Win32::Foundation::{HWND, POINT};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    GetCursorPos, GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_NOACTIVATE,
    WS_EX_TOOLWINDOW,
};

pub const WINDOW_LABEL: &str = "island";
pub const PANEL_W: f64 = 640.0;
pub const PANEL_H: f64 = 300.0;
pub const STRIP_W: f64 = 220.0;
pub const STRIP_H: f64 = 6.0;
const HIT_MARGIN: f64 = 12.0;

#[derive(Clone, Copy, Debug)]
pub struct MonitorGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct IslandRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Clone, Copy, Debug)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PointerEvaluation {
    pub moved: bool,
    pub should_ignore: bool,
}

pub fn evaluate_pointer(
    rect: IslandRect,
    point: Point,
    previous: Point,
    margin: f64,
) -> PointerEvaluation {
    PointerEvaluation {
        moved: (point.x - previous.x).abs() >= 1.0 || (point.y - previous.y).abs() >= 1.0,
        should_ignore: !hit_test(rect, point, margin),
    }
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
struct CursorPayload {
    x: f64,
    y: f64,
}

pub struct WindowGate {
    active: Mutex<bool>,
    wake: Condvar,
    pub collapsed: AtomicBool,
    rect: Mutex<IslandRect>,
    ignoring: AtomicBool,
}

impl WindowGate {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(false),
            wake: Condvar::new(),
            collapsed: AtomicBool::new(false),
            rect: Mutex::new(IslandRect::default()),
            ignoring: AtomicBool::new(false),
        }
    }

    pub fn set_active(&self, active: bool) {
        let mut guard = self.active.lock().expect("window activity lock poisoned");
        *guard = active;
        self.wake.notify_all();
    }

    pub fn set_rect(&self, rect: IslandRect) {
        *self.rect.lock().expect("island rect lock poisoned") = rect;
    }

    pub fn forget_ignore_state(&self) {
        self.ignoring.store(false, Ordering::Relaxed);
    }

    fn wait_until_active(&self) {
        let mut guard = self.active.lock().expect("window activity lock poisoned");
        while !*guard {
            guard = self.wake.wait(guard).expect("window activity lock poisoned");
        }
    }

    fn is_active(&self) -> bool {
        *self.active.lock().expect("window activity lock poisoned")
    }
}

impl Default for WindowGate {
    fn default() -> Self {
        Self::new()
    }
}

pub fn centered_top_geometry(monitor: MonitorGeometry, collapsed: bool) -> WindowGeometry {
    let (logical_w, logical_h) = if collapsed {
        (STRIP_W, STRIP_H)
    } else {
        (PANEL_W, PANEL_H)
    };
    let width = (logical_w * monitor.scale).round().max(1.0) as u32;
    let height = (logical_h * monitor.scale).round().max(1.0) as u32;
    WindowGeometry {
        x: monitor.x + (monitor.width as i32 - width as i32) / 2,
        y: monitor.y,
        width,
        height,
    }
}

pub fn hit_test(rect: IslandRect, point: Point, margin: f64) -> bool {
    rect.w > 0.0
        && rect.h > 0.0
        && point.x >= rect.x - margin
        && point.x <= rect.x + rect.w + margin
        && point.y >= rect.y - margin
        && point.y <= rect.y + rect.h + margin
}

pub fn window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(WINDOW_LABEL)
}

fn target_monitor(app: &AppHandle) -> Option<Monitor> {
    app.primary_monitor()
        .ok()
        .flatten()
        .or_else(|| app.available_monitors().ok()?.into_iter().next())
}

fn monitor_geometry(monitor: &Monitor) -> MonitorGeometry {
    let pos = monitor.position();
    let size = monitor.size();
    MonitorGeometry {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
        scale: monitor.scale_factor(),
    }
}

pub fn apply_geometry(app: &AppHandle, collapsed: bool) {
    let Some(win) = window(app) else { return };
    let Some(monitor) = target_monitor(app) else { return };
    let geometry = centered_top_geometry(monitor_geometry(&monitor), collapsed);

    let _ = win.set_size(PhysicalSize::new(geometry.width, geometry.height));
    let _ = win.set_position(PhysicalPosition::new(geometry.x, geometry.y));
    let _ = win.set_size(PhysicalSize::new(geometry.width, geometry.height));
    let _ = win.set_always_on_top(true);
}

fn current_monitor_key(app: &AppHandle) -> Option<(i32, i32, u32, u32, u64)> {
    let monitor = target_monitor(app)?;
    let pos = monitor.position();
    let size = monitor.size();
    Some((
        pos.x,
        pos.y,
        size.width,
        size.height,
        monitor.scale_factor().to_bits(),
    ))
}

#[cfg(windows)]
fn hwnd_of(win: &WebviewWindow) -> Option<HWND> {
    let raw = win.hwnd().ok()?.0 as isize;
    (raw != 0).then_some(HWND(raw as *mut _))
}

#[cfg(windows)]
pub fn make_non_activating(win: &WebviewWindow) {
    let Some(hwnd) = hwnd_of(win) else { return };
    unsafe {
        let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let desired =
            current | WS_EX_NOACTIVATE.0 as isize | WS_EX_TOOLWINDOW.0 as isize;
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, desired);
    }
}

#[cfg(not(windows))]
pub fn make_non_activating(_win: &WebviewWindow) {}

#[cfg(windows)]
pub fn set_activating(win: &WebviewWindow, activating: bool) {
    let Some(hwnd) = hwnd_of(win) else { return };
    unsafe {
        let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let desired = if activating {
            current & !(WS_EX_NOACTIVATE.0 as isize)
        } else {
            current | WS_EX_NOACTIVATE.0 as isize | WS_EX_TOOLWINDOW.0 as isize
        };
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, desired);
    }
}

#[cfg(not(windows))]
pub fn set_activating(_win: &WebviewWindow, _activating: bool) {}

#[cfg(windows)]
fn cursor_physical() -> Option<(f64, f64)> {
    let mut point = POINT::default();
    unsafe { GetCursorPos(&mut point).ok()? };
    Some((point.x as f64, point.y as f64))
}

pub fn set_ignore_cursor(app: &AppHandle, ignore: bool) {
    if let Some(win) = window(app) {
        let _ = win.set_ignore_cursor_events(ignore);
    }
}

#[cfg(windows)]
pub fn spawn_cursor_poll(app: AppHandle, gate: Arc<WindowGate>) {
    std::thread::spawn(move || {
        let mut last_monitor = current_monitor_key(&app);
        loop {
            gate.wait_until_active();
            let mut last = Point {
                x: f64::MIN,
                y: f64::MIN,
            };
            let mut ticks = 0_u32;

            while gate.is_active() {
                std::thread::sleep(Duration::from_millis(16));
                ticks = ticks.wrapping_add(1);

                if ticks.is_multiple_of(30) {
                    let now = current_monitor_key(&app);
                    if now.is_some() && now != last_monitor {
                        last_monitor = now;
                        apply_geometry(&app, gate.collapsed.load(Ordering::Relaxed));
                    }
                }

                let Some(win) = window(&app) else { continue };
                let Ok(origin) = win.outer_position() else { continue };
                let scale = win.scale_factor().unwrap_or(1.0);
                let Some((cx, cy)) = cursor_physical() else { continue };
                let point = Point {
                    x: (cx - origin.x as f64) / scale,
                    y: (cy - origin.y as f64) / scale,
                };

                let rect = *gate.rect.lock().expect("island rect lock poisoned");
                let evaluation = evaluate_pointer(rect, point, last, HIT_MARGIN);

                if gate.ignoring.load(Ordering::Relaxed) != evaluation.should_ignore {
                    gate.ignoring
                        .store(evaluation.should_ignore, Ordering::Relaxed);
                    let _ = win.set_ignore_cursor_events(evaluation.should_ignore);
                }

                if evaluation.moved {
                    last = point;
                    let _ = win.emit("nimbi://cursor", CursorPayload { x: point.x, y: point.y });
                }
            }
        }
    });
}

#[cfg(not(windows))]
pub fn spawn_cursor_poll(_app: AppHandle, _gate: Arc<WindowGate>) {}
