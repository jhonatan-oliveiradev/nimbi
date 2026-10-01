use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::preferences::{
    load_preferences_from, save_preferences_to, DockEdge, NimbiPlacement, NimbiPresence,
    PreferencesV1,
};

fn temp_path(name: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    std::env::temp_dir()
        .join(format!("nimbi-preferences-{}-{nonce}", std::process::id()))
        .join(name)
}

#[test]
fn missing_preferences_use_safe_defaults() {
    let path = temp_path("preferences.json");
    let prefs = load_preferences_from(&path);
    assert_eq!(prefs, PreferencesV1::default());
}

#[test]
fn corrupt_preferences_use_safe_defaults() {
    let path = temp_path("preferences.json");
    fs::create_dir_all(path.parent().expect("parent")).expect("create temp dir");
    fs::write(&path, "{not-json").expect("write corrupt file");

    assert_eq!(load_preferences_from(&path), PreferencesV1::default());

    let _ = fs::remove_dir_all(path.parent().expect("parent"));
}

#[test]
fn future_versions_use_safe_defaults_and_unknown_fields_are_ignored() {
    let path = temp_path("preferences.json");
    fs::create_dir_all(path.parent().expect("parent")).expect("create temp dir");
    fs::write(
        &path,
        r#"{
          "version": 2,
          "futureThing": true,
          "placement": {
            "mode": "docked",
            "monitorId": "m2",
            "edge": "left",
            "offset": 0.2
          },
          "presence": { "passiveOpacity": 0.5 }
        }"#,
    )
    .expect("write future file");

    assert_eq!(load_preferences_from(&path), PreferencesV1::default());

    let _ = fs::remove_dir_all(path.parent().expect("parent"));
}

#[test]
fn loaded_values_are_clamped_and_empty_monitor_ids_are_repaired() {
    let path = temp_path("preferences.json");
    fs::create_dir_all(path.parent().expect("parent")).expect("create temp dir");
    fs::write(
        &path,
        r#"{
          "version": 1,
          "placement": {
            "mode": "floating",
            "monitorId": "",
            "x": -0.4,
            "y": 1.8
          },
          "presence": { "passiveOpacity": 0.02 }
        }"#,
    )
    .expect("write preferences");

    let prefs = load_preferences_from(&path);
    assert_eq!(
        prefs.placement,
        NimbiPlacement::Floating {
            monitor_id: "primary".into(),
            x: 0.0,
            y: 1.0,
        }
    );
    assert_eq!(prefs.presence.passive_opacity, 0.2);

    let _ = fs::remove_dir_all(path.parent().expect("parent"));
}

#[test]
fn preferences_round_trip_without_leaving_a_temp_file() {
    let path = temp_path("preferences.json");
    let prefs = PreferencesV1 {
        version: 1,
        placement: NimbiPlacement::Docked {
            monitor_id: "display-2".into(),
            edge: DockEdge::Right,
            offset: 0.42,
        },
        presence: NimbiPresence {
            passive_opacity: 0.61,
        },
    };

    save_preferences_to(&path, &prefs).expect("save preferences");
    assert_eq!(load_preferences_from(&path), prefs);
    assert!(!path.with_extension("json.tmp").exists());

    let _ = fs::remove_dir_all(path.parent().expect("parent"));
}
