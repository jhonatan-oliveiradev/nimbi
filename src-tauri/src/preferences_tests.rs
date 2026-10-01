use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::preferences::{
    load_or_default, save, NimbiEdge, NimbiPlacement, NimbiPreferences, NimbiPresence,
};

fn temp_file(name: &str) -> std::path::PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    std::env::temp_dir().join(format!("nimbi-{name}-{}-{stamp}.json", std::process::id()))
}

#[test]
fn preferences_default_to_top_center_and_seventy_two_percent_presence() {
    let prefs = NimbiPreferences::default();
    assert_eq!(
        prefs.placement,
        NimbiPlacement::Docked {
            edge: NimbiEdge::Top,
            offset: 0.5,
            monitor_id: None,
        }
    );
    assert_eq!(prefs.presence.idle_opacity, 0.72);
}

#[test]
fn preferences_normalize_untrusted_numbers() {
    let prefs = NimbiPreferences {
        placement: NimbiPlacement::Floating {
            x: -3.0,
            y: 4.0,
            monitor_id: Some("display-1".into()),
        },
        presence: NimbiPresence { idle_opacity: 4.0 },
    }
    .normalized();

    assert_eq!(
        prefs.placement,
        NimbiPlacement::Floating {
            x: 0.0,
            y: 1.0,
            monitor_id: Some("display-1".into()),
        }
    );
    assert_eq!(prefs.presence.idle_opacity, 1.0);
}

#[test]
fn preference_json_uses_the_frontend_contract_shape() {
    let prefs = NimbiPreferences {
        placement: NimbiPlacement::Docked {
            edge: NimbiEdge::Right,
            offset: 0.32,
            monitor_id: Some("display-2".into()),
        },
        presence: NimbiPresence { idle_opacity: 0.55 },
    };

    let json = serde_json::to_value(prefs).expect("serialize");
    assert_eq!(json["placement"]["mode"], "docked");
    assert_eq!(json["placement"]["edge"], "right");
    assert_eq!(json["placement"]["offset"], 0.32);
    assert_eq!(json["placement"]["monitorId"], "display-2");
    assert_eq!(json["presence"]["idleOpacity"], 0.55);
}

#[test]
fn preferences_round_trip_to_local_json() {
    let path = temp_file("roundtrip");
    let prefs = NimbiPreferences {
        placement: NimbiPlacement::Docked {
            edge: NimbiEdge::Left,
            offset: 0.25,
            monitor_id: None,
        },
        presence: NimbiPresence { idle_opacity: 0.48 },
    };

    save(&path, &prefs).expect("save preferences");
    let loaded = load_or_default(&path);
    assert_eq!(loaded, prefs.normalized());

    let _ = fs::remove_file(path);
}

#[test]
fn malformed_preferences_fail_safe_to_defaults() {
    let path = temp_file("malformed");
    fs::write(&path, "{not-json").expect("write malformed preferences");

    assert_eq!(load_or_default(&path), NimbiPreferences::default());

    let _ = fs::remove_file(path);
}
