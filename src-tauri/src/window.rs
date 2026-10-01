use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Monitor, PhysicalPosition, PhysicalSize, WebviewWindow};

use crate::preferences::{DockEdge, NimbiPlacement};

#[cfg(windows)]
use windows::Win32::Foundation::{HWND, POINT};
#[cfg(windows)]
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
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

#[derive(Clone, Debug, PartialEq)]
pub struct MonitorWorkArea {
    pub id: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
    pub primary: bool,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct LogicalSize {
    pub width: f64,
    pub height: f64,
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

    pub fn rect(&self) -> IslandRect {
        *self.rect.lock().expect("island rect lock poisoned")
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

pub fn placement_window_geometry(
    monitor: &MonitorWorkArea,
    placement: &NimbiPlacement,
    logical_size: LogicalSize,
    collapsed: bool,
) -> WindowGeometry {
    let vertical = matches!(
        placement,
        NimbiPlacement::Docked {
            edge: DockEdge::Left | DockEdge::Right,
            ..
        }
    );

    let (logical_w, logical_h) = if collapsed {
        if vertical {
            (STRIP_H, STRIP_W)
        } else {
            (STRIP_W, STRIP_H)
        }
    } else {
        (logical_size.width.max(1.0), logical_size.height.max(1.0))
    };

    let width = (logical_w * monitor.scale).round().max(1.0) as u32;
    let height = (logical_h * monitor.scale).round().max(1.0) as u32;
    let max_x = monitor.x + monitor.width as i32 - width as i32;
    let max_y = monitor.y + monitor.height as i32 - height as i32;

    let (x, y) = match placement {
        NimbiPlacement::Docked { edge, offset, .. } => {
            let offset = offset.clamp(0.0, 1.0);
            match edge {
                DockEdge::Top => (
                    monitor.x
                        + ((monitor.width as f64 * offset) - width as f64 / 2.0).round()
                            as i32,
                    monitor.y,
                ),
                DockEdge::Bottom => (
                    monitor.x
                        + ((monitor.width as f64 * offset) - width as f64 / 2.0).round()
                            as i32,
                    max_y,
                ),
                DockEdge::Left => (
                    monitor.x,
                    monitor.y
                        + ((monitor.height as f64 * offset) - height as f64 / 2.0).round()
                            as i32,
                ),
                DockEdge::Right => (
                    max_x,
                    monitor.y
                        + ((monitor.height as f64 * offset) - height as f64 / 2.0).round()
                            as i32,
                ),
            }
        }
        NimbiPlacement::Floating { x, y, .. } => (
            monitor.x
                + ((monitor.width as f64 * x.clamp(0.0, 1.0)) - width as f64 / 2.0).round()
                    as i32,
            monitor.y
                + ((monitor.height as f64 * y.clamp(0.0, 1.0)) - height as f64 / 2.0).round()
                    as i32,
        ),
    };

    WindowGeometry {
        x: x.clamp(monitor.x, max_x.max(monitor.x)),
        y: y.clamp(monitor.y, max_y.max(monitor.y)),
        width,
        height,
    }
}

pub fn resolve_monitor<'a>(
    monitors: &'a [MonitorWorkArea],
    requested_id: &str,
) -> Option<&'a MonitorWorkArea> {
    monitors
        .iter()
        .find(|monitor| monitor.id == requested_id)
        .or_else(|| monitors.iter().find(|monitor| monitor.primary))
        .or_else(|| monitors.first())
}

pub fn monitor_for_point(
    monitors: &[MonitorWorkArea],
    point: Point,
) -> Option<&MonitorWorkArea> {
    monitors
        .iter()
        .find(|monitor| {
            point.x >= monitor.x as f64
                && point.x < (monitor.x + monitor.width as i32) as f64
                && point.y >= monitor.y as f64
                && point.y < (monitor.y + monitor.height as i32) as f64
        })
        .or_else(|| {
            monitors.iter().min_by(|a, b| {
                distance_to_monitor(a, point)
                    .partial_cmp(&distance_to_monitor(b, point))
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
        })
}

pub fn placement_for_point(
    monitor: &MonitorWorkArea,
    point: Point,
    previous: Option<&NimbiPlacement>,
    threshold_logical: f64,
) -> NimbiPlacement {
    let threshold = threshold_logical.max(0.0) * monitor.scale;
    let distances = [
        (DockEdge::Top, (point.y - monitor.y as f64).abs()),
        (
            DockEdge::Right,
            ((monitor.x + monitor.width as i32) as f64 - point.x).abs(),
        ),
        (
            DockEdge::Bottom,
            ((monitor.y + monitor.height as i32) as f64 - point.y).abs(),
        ),
        (DockEdge::Left, (point.x - monitor.x as f64).abs()),
    ];

    let nearest = distances
        .iter()
        .map(|(_, distance)| *distance)
        .filter(|distance| *distance <= threshold)
        .fold(f64::INFINITY, f64::min);

    if nearest.is_finite() {
        let mut tied: Vec<DockEdge> = distances
            .iter()
            .filter(|(_, distance)| (*distance - nearest).abs() < 0.0001)
            .map(|(edge, _)| *edge)
            .collect();

        let previous_edge = match previous {
            Some(NimbiPlacement::Docked { edge, .. }) => Some(*edge),
            _ => None,
        };
        let edge = previous_edge
            .filter(|edge| tied.contains(edge))
            .or_else(|| {
                tied.iter()
                    .copied()
                    .find(|edge| matches!(edge, DockEdge::Top | DockEdge::Bottom))
            })
            .unwrap_or_else(|| tied.remove(0));

        let offset = match edge {
            DockEdge::Top | DockEdge::Bottom => {
                ((point.x - monitor.x as f64) / monitor.width as f64).clamp(0.0, 1.0)
            }
            DockEdge::Left | DockEdge::Right => {
                ((point.y - monitor.y as f64) / monitor.height as f64).clamp(0.0, 1.0)
            }
        };

        return NimbiPlacement::Docked {
            monitor_id: monitor.id.clone(),
            edge,
            offset,
        };
    }

    NimbiPlacement::Floating {
        monitor_id: monitor.id.clone(),
        x: ((point.x - monitor.x as f64) / monitor.width as f64).clamp(0.0, 1.0),
        y: ((point.y - monitor.y as f64) / monitor.height as f64).clamp(0.0, 1.0),
    }
}

fn distance_to_monitor(monitor: &MonitorWorkArea, point: Point) -> f64 {
    let left = monitor.x as f64;
    let right = (monitor.x + monitor.width as i32) as f64;
    let top = monitor.y as f64;
    let bottom = (monitor.y + monitor.height as i32) as f64;
    let dx = if point.x < left {
        left - point.x
    } else if point.x > right {
        point.x - right
    } else {
        0.0
    };
    let dy = if point.y < top {
        top - point.y
    } else if point.y > bottom {
        point.y - bottom
    } else {
        0.0
    };
    dx.hypot(dy)
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

fn monitor_id(monitor: &Monitor, index: usize) -> String {
    monitor
        .name()
        .filter(|name| !name.trim().is_empty())
        .map(|name| name.to_string())
        .unwrap_or_else(|| {
            let pos = monitor.position();
            format!("monitor-{index}-{}-{}", pos.x, pos.y)
        })
}

#[cfg(windows)]
fn work_area_for_monitor(monitor: &Monitor) -> Option<(i32, i32, u32, u32)> {
    let position = monitor.position();
    let point = POINT {
        x: position.x + 1,
        y: position.y + 1,
    };
    let handle = unsafe { MonitorFromPoint(point, MONITOR_DEFAULTTONEAREST) };
    if handle.0.is_null() {
        return None;
    }

    let mut info = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    let ok = unsafe { GetMonitorInfoW(handle, &mut info) }.as_bool();
    if !ok {
        return None;
    }

    let rect = info.rcWork;
    Some((
        rect.left,
        rect.top,
        (rect.right - rect.left).max(0) as u32,
        (rect.bottom - rect.top).max(0) as u32,
    ))
}

#[cfg(not(windows))]
fn work_area_for_monitor(monitor: &Monitor) -> Option<(i32, i32, u32, u32)> {
    let pos = monitor.position();
    let size = monitor.size();
    Some((pos.x, pos.y, size.width, size.height))
}

pub fn monitor_work_areas(app: &AppHandle) -> Vec<MonitorWorkArea> {
    let primary = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|monitor| (monitor.position().x, monitor.position().y));

    app.available_monitors()
        .unwrap_or_default()
        .into_iter()
        .enumerate()
        .map(|(index, monitor)| {
            let pos = monitor.position();
            let size = monitor.size();
            let (x, y, width, height) =
                work_area_for_monitor(&monitor).unwrap_or((pos.x, pos.y, size.width, size.height));
            MonitorWorkArea {
                id: monitor_id(&monitor, index),
                x,
                y,
                width,
                height,
                scale: monitor.scale_factor(),
                primary: primary == Some((pos.x, pos.y)),
            }
        })
        .collect()
}

pub fn apply_placement_geometry(
    app: &AppHandle,
    placement: &NimbiPlacement,
    logical_size: LogicalSize,
    collapsed: bool,
) {
    let Some(win) = window(app) else { return };
    let monitors = monitor_work_areas(app);
    let requested = match placement {
        NimbiPlacement::Docked { monitor_id, .. }
        | NimbiPlacement::Floating { monitor_id, .. } => monitor_id,
    };
    let Some(monitor) = resolve_monitor(&monitors, requested) else {
        return;
    };
    let geometry = placement_window_geometry(monitor, placement, logical_size, collapsed);

    let _ = win.set_size(PhysicalSize::new(geometry.width, geometry.height));
    let _ = win.set_position(PhysicalPosition::new(geometry.x, geometry.y));
    let _ = win.set_always_on_top(true);
}

pub fn apply_geometry(app: &AppHandle, collapsed: bool) {
    let Some(monitor) = target_monitor(app) else { return };
    let geometry = centered_top_geometry(monitor_geometry(&monitor), collapsed);
    let Some(win) = window(app) else { return };

    let _ = win.set_size(PhysicalSize::new(geometry.width, geometry.height));
    let _ = win.set_position(PhysicalPosition::new(geometry.x, geometry.y));
    let _ = win.set_always_on_top(true);
}

fn current_monitor_key(app: &AppHandle) -> Option<Vec<(String, i32, i32, u32, u32, u64)>> {
    let mut monitors = monitor_work_areas(app);
    monitors.sort_by(|a, b| a.id.cmp(&b.id));
    Some(
        monitors
            .into_iter()
            .map(|monitor| {
                (
                    monitor.id,
                    monitor.x,
                    monitor.y,
                    monitor.width,
                    monitor.height,
                    monitor.scale.to_bits(),
                )
            })
            .collect(),
    )
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
pub fn cursor_screen_point() -> Option<Point> {
    let mut point = POINT::default();
    unsafe { GetCursorPos(&mut point).ok()? };
    Some(Point {
        x: point.x as f64,
        y: point.y as f64,
    })
}

#[cfg(not(windows))]
pub fn cursor_screen_point() -> Option<Point> {
    None
}

pub fn move_window_centered_at(app: &AppHandle, point: Point) {
    let Some(win) = window(app) else { return };
    let Ok(size) = win.outer_size() else { return };
    let x = (point.x - size.width as f64 / 2.0).round() as i32;
    let y = (point.y - size.height as f64 / 2.0).round() as i32;
    let _ = win.set_position(PhysicalPosition::new(x, y));
}

pub fn placement_at_screen_point(
    app: &AppHandle,
    point: Point,
    previous: Option<&NimbiPlacement>,
) -> Option<NimbiPlacement> {
    let monitors = monitor_work_areas(app);
    let monitor = monitor_for_point(&monitors, point)?;
    Some(placement_for_point(monitor, point, previous, 56.0))
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
                    }
                }

                let Some(win) = window(&app) else { continue };
                let Ok(origin) = win.outer_position() else { continue };
                let scale = win.scale_factor().unwrap_or(1.0);
                let Some(cursor) = cursor_screen_point() else { continue };
                let point = Point {
                    x: (cursor.x - origin.x as f64) / scale,
                    y: (cursor.y - origin.y as f64) / scale,
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
