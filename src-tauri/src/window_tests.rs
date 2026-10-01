use crate::preferences::{NimbiEdge, NimbiPlacement};
use crate::window::{
    adaptive_geometry, centered_top_geometry, evaluate_pointer, hit_test,
    placement_from_physical_point, IslandRect, MonitorGeometry, Point, ShellOrientation,
    WorkAreaGeometry, PANEL_H, PANEL_W, STRIP_H, STRIP_W,
};

#[test]
fn panel_geometry_is_centered_at_monitor_top_across_scales() {
    for scale in [1.0, 1.25, 1.5, 2.0] {
        let monitor = MonitorGeometry {
            x: 100,
            y: 40,
            width: (1920.0 * scale) as u32,
            height: (1080.0 * scale) as u32,
            scale,
        };
        let geometry = centered_top_geometry(monitor, false);
        assert_eq!(geometry.width, (PANEL_W * scale).round() as u32);
        assert_eq!(geometry.height, (PANEL_H * scale).round() as u32);
        assert_eq!(geometry.y, 40);
        assert_eq!(
            geometry.x,
            100 + (monitor.width as i32 - geometry.width as i32) / 2
        );
    }
}

#[test]
fn collapsed_geometry_uses_centered_wake_strip() {
    let monitor = MonitorGeometry {
        x: -1920,
        y: 0,
        width: 1920,
        height: 1080,
        scale: 1.0,
    };
    let geometry = centered_top_geometry(monitor, true);
    assert_eq!(geometry.width, STRIP_W as u32);
    assert_eq!(geometry.height, STRIP_H as u32);
    assert_eq!(geometry.x, -1920 + (1920 - STRIP_W as i32) / 2);
    assert_eq!(geometry.y, 0);
}

#[test]
fn hit_test_accepts_only_island_plus_entry_margin() {
    let rect = IslandRect {
        x: 220.0,
        y: 0.0,
        w: 200.0,
        h: 48.0,
    };
    assert!(hit_test(rect, Point { x: 215.0, y: 20.0 }, 12.0));
    assert!(hit_test(rect, Point { x: 430.0, y: 20.0 }, 12.0));
    assert!(!hit_test(rect, Point { x: 180.0, y: 20.0 }, 12.0));
    assert!(!hit_test(rect, Point { x: 500.0, y: 100.0 }, 12.0));
}

#[test]
fn pointer_inside_transparent_host_but_outside_island_passes_through() {
    let rect = IslandRect {
        x: 242.0,
        y: 0.0,
        w: 156.0,
        h: 40.0,
    };
    let pointer = Point { x: 80.0, y: 120.0 };
    assert!(!hit_test(rect, pointer, 12.0));
}

#[test]
fn stationary_pointer_rechecks_hit_state_after_island_geometry_changes() {
    let point = Point { x: 400.0, y: 20.0 };
    let previous = Point { x: 400.0, y: 20.0 };

    let small = IslandRect {
        x: 242.0,
        y: 0.0,
        w: 120.0,
        h: 40.0,
    };
    let expanded = IslandRect {
        x: 180.0,
        y: 0.0,
        w: 260.0,
        h: 48.0,
    };

    let before = evaluate_pointer(small, point, previous, 12.0);
    let after = evaluate_pointer(expanded, point, previous, 12.0);

    assert!(!before.moved);
    assert!(before.should_ignore);
    assert!(!after.moved);
    assert!(!after.should_ignore);
}


#[test]
fn adaptive_top_dock_preserves_normalized_anchor() {
    let work = WorkAreaGeometry {
        x: 0,
        y: 0,
        width: 1920,
        height: 1040,
        scale: 1.0,
    };
    let layout = adaptive_geometry(
        work,
        &NimbiPlacement::Docked {
            edge: NimbiEdge::Top,
            offset: 0.8,
            monitor_id: None,
        },
        false,
    );

    assert_eq!(layout.orientation, ShellOrientation::Horizontal);
    assert_eq!(layout.window.y, 0);
    let global_anchor_x = layout.window.x as f64 + layout.anchor_x;
    assert!((global_anchor_x - 1536.0).abs() < 0.5);
}

#[test]
fn adaptive_right_dock_uses_vertical_host_at_scaled_dpi() {
    let work = WorkAreaGeometry {
        x: 0,
        y: 0,
        width: 2560,
        height: 1400,
        scale: 1.5,
    };
    let layout = adaptive_geometry(
        work,
        &NimbiPlacement::Docked {
            edge: NimbiEdge::Right,
            offset: 0.4,
            monitor_id: None,
        },
        false,
    );

    assert_eq!(layout.orientation, ShellOrientation::Vertical);
    assert_eq!(layout.window.width, 450);
    assert_eq!(layout.window.height, 960);
    assert_eq!(layout.window.x, 2560 - 450);
    let global_anchor_y = layout.window.y as f64 + layout.anchor_y;
    assert!((global_anchor_y - 560.0).abs() < 0.5);
}

#[test]
fn adaptive_floating_near_left_prefers_vertical_and_stays_in_work_area() {
    let work = WorkAreaGeometry {
        x: -1920,
        y: 20,
        width: 1920,
        height: 1040,
        scale: 1.0,
    };
    let layout = adaptive_geometry(
        work,
        &NimbiPlacement::Floating {
            x: 0.08,
            y: 0.95,
            monitor_id: None,
        },
        false,
    );

    assert_eq!(layout.orientation, ShellOrientation::Vertical);
    assert!(layout.window.x >= work.x);
    assert!(layout.window.y >= work.y);
    assert!(layout.window.x + layout.window.width as i32 <= work.x + work.width as i32);
    assert!(layout.window.y + layout.window.height as i32 <= work.y + work.height as i32);

    let global_x = layout.window.x as f64 + layout.anchor_x;
    let global_y = layout.window.y as f64 + layout.anchor_y;
    assert!((global_x - (-1920.0 + 1920.0 * 0.08)).abs() < 0.5);
    assert!((global_y - (20.0 + 1040.0 * 0.95)).abs() < 0.5);
}

#[test]
fn collapsed_left_dock_uses_vertical_wake_strip() {
    let work = WorkAreaGeometry {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        scale: 1.0,
    };
    let layout = adaptive_geometry(
        work,
        &NimbiPlacement::Docked {
            edge: NimbiEdge::Left,
            offset: 0.5,
            monitor_id: None,
        },
        true,
    );

    assert_eq!(layout.window.width, STRIP_H as u32);
    assert_eq!(layout.window.height, STRIP_W as u32);
    assert_eq!(layout.window.x, 0);
}


#[test]
fn physical_drop_near_right_edge_resolves_to_docked_placement() {
    let work = WorkAreaGeometry {
        x: 100,
        y: 50,
        width: 1600,
        height: 900,
        scale: 1.25,
    };
    let placement = placement_from_physical_point(
        Point { x: 1685.0, y: 500.0 },
        work,
        "DISPLAY-A".into(),
        64.0,
    );

    assert_eq!(
        placement,
        NimbiPlacement::Docked {
            edge: NimbiEdge::Right,
            offset: 0.5,
            monitor_id: Some("DISPLAY-A".into()),
        }
    );
}

#[test]
fn physical_drop_away_from_edges_resolves_to_normalized_floating_placement() {
    let work = WorkAreaGeometry {
        x: -1600,
        y: 0,
        width: 1600,
        height: 900,
        scale: 1.0,
    };
    let placement = placement_from_physical_point(
        Point { x: -800.0, y: 450.0 },
        work,
        "DISPLAY-B".into(),
        64.0,
    );

    assert_eq!(
        placement,
        NimbiPlacement::Floating {
            x: 0.5,
            y: 0.5,
            monitor_id: Some("DISPLAY-B".into()),
        }
    );
}
