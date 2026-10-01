use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub const PREFERENCES_VERSION: u8 = 1;
pub const DEFAULT_PASSIVE_OPACITY: f64 = 0.72;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DockEdge {
    Top,
    Right,
    Bottom,
    Left,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "mode", rename_all = "lowercase")]
pub enum NimbiPlacement {
    Docked {
        #[serde(rename = "monitorId")]
        monitor_id: String,
        edge: DockEdge,
        offset: f64,
    },
    Floating {
        #[serde(rename = "monitorId")]
        monitor_id: String,
        x: f64,
        y: f64,
    },
}

impl Default for NimbiPlacement {
    fn default() -> Self {
        Self::Docked {
            monitor_id: "primary".into(),
            edge: DockEdge::Top,
            offset: 0.5,
        }
    }
}

impl NimbiPlacement {
    fn sanitized(self) -> Self {
        match self {
            Self::Docked {
                monitor_id,
                edge,
                offset,
            } => Self::Docked {
                monitor_id: repaired_monitor_id(monitor_id),
                edge,
                offset: clamp_unit(offset, 0.5),
            },
            Self::Floating {
                monitor_id,
                x,
                y,
            } => Self::Floating {
                monitor_id: repaired_monitor_id(monitor_id),
                x: clamp_unit(x, 0.5),
                y: clamp_unit(y, 0.5),
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NimbiPresence {
    pub passive_opacity: f64,
}

impl Default for NimbiPresence {
    fn default() -> Self {
        Self {
            passive_opacity: DEFAULT_PASSIVE_OPACITY,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PreferencesV1 {
    pub version: u8,
    pub placement: NimbiPlacement,
    pub presence: NimbiPresence,
}

impl Default for PreferencesV1 {
    fn default() -> Self {
        Self {
            version: PREFERENCES_VERSION,
            placement: NimbiPlacement::default(),
            presence: NimbiPresence::default(),
        }
    }
}

impl PreferencesV1 {
    pub fn sanitized(self) -> Self {
        if self.version != PREFERENCES_VERSION {
            return Self::default();
        }

        Self {
            version: PREFERENCES_VERSION,
            placement: self.placement.sanitized(),
            presence: NimbiPresence {
                passive_opacity: clamp_opacity(self.presence.passive_opacity),
            },
        }
    }
}

fn repaired_monitor_id(value: String) -> String {
    if value.trim().is_empty() {
        "primary".into()
    } else {
        value
    }
}

fn clamp_unit(value: f64, fallback: f64) -> f64 {
    if value.is_finite() {
        value.clamp(0.0, 1.0)
    } else {
        fallback
    }
}

pub fn clamp_opacity(value: f64) -> f64 {
    if value.is_finite() {
        value.clamp(0.2, 1.0)
    } else {
        DEFAULT_PASSIVE_OPACITY
    }
}

pub fn default_preferences_path() -> PathBuf {
    if let Some(appdata) = std::env::var_os("APPDATA") {
        return PathBuf::from(appdata)
            .join("nimbi")
            .join("preferences.json");
    }

    std::env::temp_dir()
        .join("nimbi")
        .join("preferences.json")
}

pub fn load_preferences_from(path: &Path) -> PreferencesV1 {
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<PreferencesV1>(&raw).ok())
        .map(PreferencesV1::sanitized)
        .unwrap_or_default()
}

pub fn save_preferences_to(path: &Path, preferences: &PreferencesV1) -> Result<(), String> {
    let preferences = preferences.clone().sanitized();
    let parent = path
        .parent()
        .ok_or_else(|| "preferences path has no parent".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;

    let temp = path.with_extension("json.tmp");
    let payload = serde_json::to_vec_pretty(&preferences).map_err(|error| error.to_string())?;

    {
        let mut file = File::create(&temp).map_err(|error| error.to_string())?;
        file.write_all(&payload).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
    }

    replace_atomically(&temp, path)
}

#[cfg(windows)]
fn replace_atomically(source: &Path, destination: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;

    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let source_wide: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let destination_wide: Vec<u16> = destination.as_os_str().encode_wide().chain(Some(0)).collect();

    unsafe {
        MoveFileExW(
            PCWSTR(source_wide.as_ptr()),
            PCWSTR(destination_wide.as_ptr()),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
        .map_err(|error| error.to_string())
    }
}

#[cfg(not(windows))]
fn replace_atomically(source: &Path, destination: &Path) -> Result<(), String> {
    fs::rename(source, destination).map_err(|error| error.to_string())
}
