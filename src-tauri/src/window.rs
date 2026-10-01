use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use serde::Serialize;

use crate::preferences::{NimbiEdge, NimbiPlacement};
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
pub const VERTICAL_PANEL_W: f64 = 300.0;
pub const VERTICAL_PANEL_H: f64 = 640.0;
pub const FLOATING_HORIZONTAL_W: f64 = 420.0;
pub const FLOATING_HORIZONTAL_H: f64 = 300.0;
pub const FLOATING_VERTICAL_W: f64 = 300.0;
pub const FLOATING_VERTICAL_H: f64 = 420.0;
pub const FLOATING_WAKE: f64 = 22.0;
const HIT_MARGIN: f64 = 12.0;

#[derive(Clone, Copy, Debug)]
pub struct MonitorGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
}

#[derive(Clone, Copy, Debug)]
pub struct WorkAreaGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ShellOrientation {
    Horizontal,
    Vertical,
}

#[derive(Clone, Copy, Debug)]
pub struct ShellGeometry {
    pub window: WindowGeometry,
    pub anchor_x: f64,
    pub anchor_y: f64,
    pub orientation: ShellOrientation,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellLayoutPayload {
    pub anchor_x: f64,
    pub anchor_y: f64,
    pub orientation: ShellOrientation,
    pub viewport_width: f64,
    pub viewport_height: f64,
    pub monitor_id: String,
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
    placement: Mutex<NimbiPlacement>,
}

impl WindowGate {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(false),
            wake: Condvar::new(),
            collapsed: AtomicBool::new(false),
            rect: Mutex::new(IslandRect::default()),
            ignoring: AtomicBool::new(false),
            placement: Mutex::new(NimbiPlacement::Docked {
                edge: NimbiEdge::Top,
                offset: 0.5,
                monitor_id: None,
            }),
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

    pub fn set_placement(&self, placement: NimbiPlacement) {
        *self
            .placement
            .lock()
            .expect("window placement lock poisoned") = placement;
    }

    pub fn placement(&self) -> NimbiPlacement {
        self.placement
            .lock()
            .expect("window placement lock poisoned")
            .clone()
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

fn placement_orientation(placement: &NimbiPlacement) -> ShellOrientation {
    match placement {
        NimbiPlacement::Docked { edge, .. } => match edge {
            NimbiEdge::Left | NimbiEdge::Right => ShellOrientation::Vertical,
            NimbiEdge::Top | NimbiEdge::Bottom => ShellOrientation::Horizontal,
        },
        NimbiPlacement::Floating { x, .. } => {
            if *x <= 0.22 || *x >= 0.78 {
                ShellOrientation::Vertical
            } else {
                ShellOrientation::Horizontal
            }
        }
    }
}

fn normalized(value: f64) -> f64 {
    if value.is_finite() {
        value.clamp(0.0, 1.0)
    } else {
        0.5
    }
}

fn clamp_f64(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

pub fn adaptive_geometry(
    work: WorkAreaGeometry,
    placement: &NimbiPlacement,
    collapsed: bool,
) -> ShellGeometry {
    let orientation = placement_orientation(placement);

    let (logical_w, logical_h) = if collapsed {
        match placement {
            NimbiPlacement::Docked {
                edge: NimbiEdge::Left | NimbiEdge::Right,
                ..
            } => (STRIP_H, STRIP_W),
            NimbiPlacement::Docked { .. } => (STRIP_W, STRIP_H),
            NimbiPlacement::Floating { .. } => (FLOATING_WAKE, FLOATING_WAKE),
        }
    } else {
        match placement {
            NimbiPlacement::Floating { .. } => match orientation {
                ShellOrientation::Horizontal => {
                    (FLOATING_HORIZONTAL_W, FLOATING_HORIZONTAL_H)
                }
                ShellOrientation::Vertical => (FLOATING_VERTICAL_W, FLOATING_VERTICAL_H),
            },
            NimbiPlacement::Docked { .. } => match orientation {
                ShellOrientation::Horizontal => (PANEL_W, PANEL_H),
                ShellOrientation::Vertical => (VERTICAL_PANEL_W, VERTICAL_PANEL_H),
            },
        }
    };

    let width = ((logical_w * work.scale).round().max(1.0) as u32).min(work.width.max(1));
    let height = ((logical_h * work.scale).round().max(1.0) as u32).min(work.height.max(1));

    let work_right = work.x as f64 + work.width as f64;
    let work_bottom = work.y as f64 + work.height as f64;

    let (target_x, target_y) = match placement {
        NimbiPlacement::Docked {
            edge,
            offset,
            ..
        } => {
            let offset = normalized(*offset);
            match edge {
                NimbiEdge::Top => (
                    work.x as f64 + work.width as f64 * offset,
                    work.y as f64,
                ),
                NimbiEdge::Right => (
                    work_right,
                    work.y as f64 + work.height as f64 * offset,
                ),
                NimbiEdge::Bottom => (
                    work.x as f64 + work.width as f64 * offset,
                    work_bottom,
                ),
                NimbiEdge::Left => (
                    work.x as f64,
                    work.y as f64 + work.height as f64 * offset,
                ),
            }
        }
        NimbiPlacement::Floating { x, y, .. } => (
            work.x as f64 + work.width as f64 * normalized(*x),
            work.y as f64 + work.height as f64 * normalized(*y),
        ),
    };

    let max_x = work.x as f64 + (work.width.saturating_sub(width)) as f64;
    let max_y = work.y as f64 + (work.height.saturating_sub(height)) as f64;

    let x = match placement {
        NimbiPlacement::Docked {
            edge: NimbiEdge::Left,
            ..
        } => work.x as f64,
        NimbiPlacement::Docked {
            edge: NimbiEdge::Right,
            ..
        } => max_x,
        _ => clamp_f64(target_x - width as f64 / 2.0, work.x as f64, max_x),
    };

    let y = match placement {
        NimbiPlacement::Docked {
            edge: NimbiEdge::Top,
            ..
        } => work.y as f64,
        NimbiPlacement::Docked {
            edge: NimbiEdge::Bottom,
            ..
        } => max_y,
        _ => clamp_f64(target_y - height as f64 / 2.0, work.y as f64, max_y),
    };

    ShellGeometry {
        window: WindowGeometry {
            x: x.round() as i32,
            y: y.round() as i32,
            width,
            height,
        },
        anchor_x: clamp_f64(target_x - x, 0.0, width as f64),
        anchor_y: clamp_f64(target_y - y, 0.0, height as f64),
        orientation,
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

fn placement_monitor_id(placement: &NimbiPlacement) -> Option<&str> {
    match placement {
        NimbiPlacement::Docked { monitor_id, .. }
        | NimbiPlacement::Floating { monitor_id, .. } => monitor_id.as_deref(),
    }
}

pub fn monitor_identity(monitor: &Monitor) -> String {
    if let Some(name) = monitor.name().filter(|name| !name.trim().is_empty()) {
        return name.clone();
    }

    let pos = monitor.position();
    let size = monitor.size();
    format!(
        "display@{},{}:{}x{}",
        pos.x, pos.y, size.width, size.height
    )
}

fn target_monitor(app: &AppHandle, placement: &NimbiPlacement) -> Option<Monitor> {
    let monitors = app.available_monitors().ok()?;

    if let Some(requested) = placement_monitor_id(placement) {
        if let Some(found) = monitors
            .iter()
            .find(|monitor| monitor_identity(monitor) == requested)
        {
            return Some(found.clone());
        }
    }

    app.primary_monitor()
        .ok()
        .flatten()
        .or_else(|| monitors.into_iter().next())
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

fn work_area_geometry(monitor: &Monitor) -> WorkAreaGeometry {
    let work = monitor.work_area();
    WorkAreaGeometry {
        x: work.position.x,
        y: work.position.y,
        width: work.size.width,
        height: work.size.height,
        scale: monitor.scale_factor(),
    }
}

fn resolved_shell(
    app: &AppHandle,
    placement: &NimbiPlacement,
    collapsed: bool,
) -> Option<(ShellGeometry, ShellLayoutPayload)> {
    let monitor = target_monitor(app, placement)?;
    let work = work_area_geometry(&monitor);
    let geometry = adaptive_geometry(work, placement, collapsed);
    let scale = work.scale.max(f64::EPSILON);
    let payload = ShellLayoutPayload {
        anchor_x: geometry.anchor_x / scale,
        anchor_y: geometry.anchor_y / scale,
        orientation: geometry.orientation,
        viewport_width: work.width as f64 / scale,
        viewport_height: work.height as f64 / scale,
        monitor_id: monitor_identity(&monitor),
    };
    Some((geometry, payload))
}

pub fn shell_layout(
    app: &AppHandle,
    placement: &NimbiPlacement,
    collapsed: bool,
) -> Option<ShellLayoutPayload> {
    resolved_shell(app, placement, collapsed).map(|(_, payload)| payload)
}

pub fn apply_geometry(
    app: &AppHandle,
    placement: &NimbiPlacement,
    collapsed: bool,
) -> Option<ShellLayoutPayload> {
    let win = window(app)?;
    let (resolved, payload) = resolved_shell(app, placement, collapsed)?;
    let geometry = resolved.window;

    let _ = win.set_size(PhysicalSize::new(geometry.width, geometry.height));
    let _ = win.set_position(PhysicalPosition::new(geometry.x, geometry.y));
    let _ = win.set_size(PhysicalSize::new(geometry.width, geometry.height));
    let _ = win.set_always_on_top(true);
    let _ = win.emit("nimbi://shell-layout", &payload);
    Some(payload)
}

fn current_monitor_key(
    app: &AppHandle,
    placement: &NimbiPlacement,
) -> Option<(i32, i32, u32, u32, u64)> {
    let monitor = target_monitor(app, placement)?;
    let work = monitor.work_area();
    Some((
        work.position.x,
        work.position.y,
        work.size.width,
        work.size.height,
        monitor.scale_factor().to_bits(),
    ))
}

fn monitor_contains_point(monitor: &Monitor, x: f64, y: f64) -> bool {
    let pos = monitor.position();
    let size = monitor.size();
    x >= pos.x as f64
        && x <= pos.x as f64 + size.width as f64
        && y >= pos.y as f64
        && y <= pos.y as f64 + size.height as f64
}

fn monitor_for_point(app: &AppHandle, x: f64, y: f64) -> Option<Monitor> {
    let monitors = app.available_monitors().ok()?;
    monitors
        .iter()
        .find(|monitor| monitor_contains_point(monitor, x, y))
        .cloned()
        .or_else(|| app.primary_monitor().ok().flatten())
        .or_else(|| monitors.into_iter().next())
}

pub fn placement_from_physical_point(
    point: Point,
    work: WorkAreaGeometry,
    monitor_id: String,
    threshold_logical: f64,
) -> NimbiPlacement {
    let right = work.x as f64 + work.width as f64;
    let bottom = work.y as f64 + work.height as f64;
    let threshold = threshold_logical.max(0.0) * work.scale.max(f64::EPSILON);

    let distances = [
        (NimbiEdge::Top, (point.y - work.y as f64).abs()),
        (NimbiEdge::Right, (right - point.x).abs()),
        (NimbiEdge::Bottom, (bottom - point.y).abs()),
        (NimbiEdge::Left, (point.x - work.x as f64).abs()),
    ];

    let (edge, distance) = distances
        .into_iter()
        .min_by(|a, b| a.1.total_cmp(&b.1))
        .expect("edge candidates are never empty");

    if distance <= threshold {
        let offset = match edge {
            NimbiEdge::Top | NimbiEdge::Bottom => {
                normalized((point.x - work.x as f64) / work.width.max(1) as f64)
            }
            NimbiEdge::Left | NimbiEdge::Right => {
                normalized((point.y - work.y as f64) / work.height.max(1) as f64)
            }
        };
        NimbiPlacement::Docked {
            edge,
            offset,
            monitor_id: Some(monitor_id),
        }
    } else {
        NimbiPlacement::Floating {
            x: normalized((point.x - work.x as f64) / work.width.max(1) as f64),
            y: normalized((point.y - work.y as f64) / work.height.max(1) as f64),
            monitor_id: Some(monitor_id),
        }
    }
}

#[cfg(windows)]
pub fn resolve_placement_from_cursor(
    app: &AppHandle,
    threshold_logical: f64,
) -> Option<NimbiPlacement> {
    let (x, y) = cursor_physical()?;
    let monitor = monitor_for_point(app, x, y)?;
    let work = work_area_geometry(&monitor);
    Some(placement_from_physical_point(
        Point { x, y },
        work,
        monitor_identity(&monitor),
        threshold_logical,
    ))
}

#[cfg(not(windows))]
pub fn resolve_placement_from_cursor(
    _app: &AppHandle,
    _threshold_logical: f64,
) -> Option<NimbiPlacement> {
    None
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
        let mut last_monitor = current_monitor_key(&app, &gate.placement());
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
                    let placement = gate.placement();
                    let now = current_monitor_key(&app, &placement);
                    if now.is_some() && now != last_monitor {
                        last_monitor = now;
                        let _ = apply_geometry(
                            &app,
                            &placement,
                            gate.collapsed.load(Ordering::Relaxed),
                        );
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
