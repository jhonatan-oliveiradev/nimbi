use crate::window::{
    centered_top_geometry, evaluate_pointer, hit_test, IslandRect, MonitorGeometry, Point, PANEL_H,
    PANEL_W, STRIP_H, STRIP_W,
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
