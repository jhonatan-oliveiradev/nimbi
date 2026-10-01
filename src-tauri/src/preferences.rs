use std::fs;
use std::io;
use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NimbiEdge {
    Top,
    Right,
    Bottom,
    Left,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "mode", rename_all = "lowercase")]
pub enum NimbiPlacement {
    Docked {
        edge: NimbiEdge,
        offset: f64,
        #[serde(rename = "monitorId", skip_serializing_if = "Option::is_none")]
        monitor_id: Option<String>,
    },
    Floating {
        x: f64,
        y: f64,
        #[serde(rename = "monitorId", skip_serializing_if = "Option::is_none")]
        monitor_id: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NimbiPresence {
    pub idle_opacity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NimbiPreferences {
    pub placement: NimbiPlacement,
    pub presence: NimbiPresence,
}

impl Default for NimbiPreferences {
    fn default() -> Self {
        Self {
            placement: NimbiPlacement::Docked {
                edge: NimbiEdge::Top,
                offset: 0.5,
                monitor_id: None,
            },
            presence: NimbiPresence { idle_opacity: 0.72 },
        }
    }
}

fn clamp01(value: f64) -> f64 {
    if !value.is_finite() {
        return 0.5;
    }
    value.clamp(0.0, 1.0)
}

fn normalize_monitor_id(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let value = value.trim();
        (!value.is_empty()).then(|| value.to_string())
    })
}

impl NimbiPreferences {
    pub fn normalized(mut self) -> Self {
        self.placement = match self.placement {
            NimbiPlacement::Docked {
                edge,
                offset,
                monitor_id,
            } => NimbiPlacement::Docked {
                edge,
                offset: clamp01(offset),
                monitor_id: normalize_monitor_id(monitor_id),
            },
            NimbiPlacement::Floating { x, y, monitor_id } => {
                NimbiPlacement::Floating {
                    x: clamp01(x),
                    y: clamp01(y),
                    monitor_id: normalize_monitor_id(monitor_id),
                }
            }
        };

        let opacity = if self.presence.idle_opacity.is_finite() {
            self.presence.idle_opacity
        } else {
            0.72
        };
        self.presence.idle_opacity = opacity.clamp(0.25, 1.0);
        self
    }
}

pub fn load_or_default(path: &Path) -> NimbiPreferences {
    let Ok(raw) = fs::read_to_string(path) else {
        return NimbiPreferences::default();
    };
    serde_json::from_str::<NimbiPreferences>(&raw)
        .map(NimbiPreferences::normalized)
        .unwrap_or_default()
}

pub fn save(path: &Path, preferences: &NimbiPreferences) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let normalized = preferences.clone().normalized();
    let json = serde_json::to_string_pretty(&normalized)
        .map_err(io::Error::other)?;
    fs::write(path, json)
}
