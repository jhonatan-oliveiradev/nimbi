use crate::preferences::{DockEdge, NimbiPlacement};
use crate::window::{
    centered_top_geometry, evaluate_pointer, hit_test, monitor_for_point,
    drag_surface_physical_size, monitor_topology_key, placement_for_point,
    placement_window_geometry, resolve_monitor, IslandRect, LogicalSize, MonitorGeometry,
    MonitorWorkArea, Point, PANEL_H, PANEL_W, STRIP_H, STRIP_W,
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
fn docked_geometry_uses_work_area_and_monitor_scale() {
    let monitor = MonitorWorkArea {
        id: "m1".into(),
        x: 100,
        y: 50,
        width: 1800,
        height: 960,
        scale: 1.5,
        primary: true,
    };
    let size = LogicalSize {
        width: 300.0,
        height: 80.0,
    };

    let top = placement_window_geometry(
        &monitor,
        &NimbiPlacement::Docked {
            monitor_id: "m1".into(),
            edge: DockEdge::Top,
            offset: 0.5,
        },
        size,
        false,
    );
    assert_eq!(top.width, 450);
    assert_eq!(top.height, 120);
    assert_eq!(top.x, 100 + (1800 - 450) / 2);
    assert_eq!(top.y, 50);

    let bottom = placement_window_geometry(
        &monitor,
        &NimbiPlacement::Docked {
            monitor_id: "m1".into(),
            edge: DockEdge::Bottom,
            offset: 0.5,
        },
        size,
        false,
    );
    assert_eq!(bottom.y, 50 + 960 - 120);

    let left = placement_window_geometry(
        &monitor,
        &NimbiPlacement::Docked {
            monitor_id: "m1".into(),
            edge: DockEdge::Left,
            offset: 0.25,
        },
        size,
        false,
    );
    assert_eq!(left.x, 100);
    assert_eq!(left.y, 50 + 240 - 60);

    let right = placement_window_geometry(
        &monitor,
        &NimbiPlacement::Docked {
            monitor_id: "m1".into(),
            edge: DockEdge::Right,
            offset: 0.75,
        },
        size,
        false,
    );
    assert_eq!(right.x, 100 + 1800 - 450);
}

#[test]
fn floating_geometry_restores_normalized_center_and_clamps_onscreen() {
    let monitor = MonitorWorkArea {
        id: "m1".into(),
        x: -1600,
        y: 0,
        width: 1600,
        height: 860,
        scale: 1.0,
        primary: false,
    };
    let geometry = placement_window_geometry(
        &monitor,
        &NimbiPlacement::Floating {
            monitor_id: "m1".into(),
            x: 1.4,
            y: -0.3,
        },
        LogicalSize {
            width: 240.0,
            height: 120.0,
        },
        false,
    );

    assert_eq!(geometry.x, -240);
    assert_eq!(geometry.y, 0);
    assert_eq!(geometry.width, 240);
    assert_eq!(geometry.height, 120);
}

#[test]
fn collapsed_vertical_dock_rotates_the_wake_strip_geometry() {
    let monitor = MonitorWorkArea {
        id: "m1".into(),
        x: 0,
        y: 0,
        width: 1920,
        height: 1040,
        scale: 1.0,
        primary: true,
    };
    let geometry = placement_window_geometry(
        &monitor,
        &NimbiPlacement::Docked {
            monitor_id: "m1".into(),
            edge: DockEdge::Right,
            offset: 0.5,
        },
        LogicalSize {
            width: 190.0,
            height: 268.0,
        },
        true,
    );

    assert_eq!(geometry.width, STRIP_H as u32);
    assert_eq!(geometry.height, STRIP_W as u32);
    assert_eq!(geometry.x, 1920 - STRIP_H as i32);
}

#[test]
fn saved_missing_monitor_falls_back_to_primary() {
    let monitors = vec![
        MonitorWorkArea {
            id: "secondary".into(),
            x: -1920,
            y: 0,
            width: 1920,
            height: 1040,
            scale: 1.0,
            primary: false,
        },
        MonitorWorkArea {
            id: "primary".into(),
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
            scale: 1.0,
            primary: true,
        },
    ];

    let resolved = resolve_monitor(&monitors, "missing").expect("monitor");
    assert_eq!(resolved.id, "primary");
}

#[test]
fn pointer_crossing_monitors_selects_the_work_area_under_it() {
    let monitors = vec![
        MonitorWorkArea {
            id: "left".into(),
            x: -1280,
            y: 0,
            width: 1280,
            height: 720,
            scale: 1.0,
            primary: false,
        },
        MonitorWorkArea {
            id: "right".into(),
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
            scale: 1.25,
            primary: true,
        },
    ];

    assert_eq!(
        monitor_for_point(&monitors, Point { x: -400.0, y: 300.0 })
            .expect("left monitor")
            .id,
        "left"
    );
    assert_eq!(
        monitor_for_point(&monitors, Point { x: 700.0, y: 300.0 })
            .expect("right monitor")
            .id,
        "right"
    );
}

#[test]
fn placement_for_point_snaps_to_nearest_edge_and_preserves_monitor_identity() {
    let monitor = MonitorWorkArea {
        id: "right".into(),
        x: 0,
        y: 0,
        width: 1920,
        height: 1040,
        scale: 1.25,
        primary: true,
    };
    let previous = NimbiPlacement::Docked {
        monitor_id: "right".into(),
        edge: DockEdge::Top,
        offset: 0.5,
    };

    let snapped = placement_for_point(
        &monitor,
        Point { x: 1910.0, y: 500.0 },
        Some(&previous),
        56.0,
    );
    assert_eq!(
        snapped,
        NimbiPlacement::Docked {
            monitor_id: "right".into(),
            edge: DockEdge::Right,
            offset: 500.0 / 1040.0,
        }
    );

    let floating = placement_for_point(
        &monitor,
        Point { x: 960.0, y: 520.0 },
        Some(&previous),
        56.0,
    );
    assert_eq!(
        floating,
        NimbiPlacement::Floating {
            monitor_id: "right".into(),
            x: 0.5,
            y: 0.5,
        }
    );
}

#[test]
fn monitor_topology_key_is_stable_but_changes_for_dpi_or_work_area() {
    let monitors = vec![
        MonitorWorkArea {
            id: "b".into(),
            x: 1920,
            y: 0,
            width: 1600,
            height: 860,
            scale: 1.25,
            primary: false,
        },
        MonitorWorkArea {
            id: "a".into(),
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
            scale: 1.0,
            primary: true,
        },
    ];

    let key = monitor_topology_key(&monitors);
    let reversed = monitor_topology_key(&monitors.iter().cloned().rev().collect::<Vec<_>>());
    assert_eq!(key, reversed);

    let mut changed = monitors.clone();
    changed[0].scale = 1.5;
    assert_ne!(key, monitor_topology_key(&changed));

    changed[0].scale = 1.25;
    changed[0].height = 820;
    assert_ne!(key, monitor_topology_key(&changed));
}


#[test]
fn drag_surface_size_matches_the_compact_cloud_across_dpi_scales() {
    assert_eq!(drag_surface_physical_size(1.0), (76, 48));
    assert_eq!(drag_surface_physical_size(1.25), (95, 60));
    assert_eq!(drag_surface_physical_size(1.5), (114, 72));
}
