use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum NimbiActivity {
    Offline,
    Idle,
    Thinking,
    Working,
    NeedsInput,
    Complete,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NimbiSnapshot {
    pub connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol: Option<String>,
    pub activity: NimbiActivity,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub observed_at: Option<u64>,
}

impl NimbiSnapshot {
    pub fn offline() -> Self {
        Self {
            connected: false,
            protocol: None,
            activity: NimbiActivity::Offline,
            session_id: None,
            agent: None,
            provider: None,
            model: None,
            project: None,
            environment: None,
            summary: None,
            observed_at: None,
        }
    }

    pub fn idle(observed_at: Option<u64>) -> Self {
        Self {
            connected: true,
            protocol: Some("runoptic.telemetry.v1".into()),
            activity: NimbiActivity::Idle,
            session_id: None,
            agent: None,
            provider: None,
            model: None,
            project: None,
            environment: None,
            summary: None,
            observed_at,
        }
    }
}

use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use crate::preferences::NimbiPreferences;
use crate::window::WindowGate;

pub struct RuntimeState {
    pub snapshot: Mutex<NimbiSnapshot>,
    pub hidden: AtomicBool,
    pub interactive: AtomicBool,
    pub window_gate: Arc<WindowGate>,
    pub preferences: Mutex<NimbiPreferences>,
    pub preferences_path: Mutex<Option<PathBuf>>,
}

impl RuntimeState {
    pub fn new() -> Self {
        Self {
            snapshot: Mutex::new(NimbiSnapshot::offline()),
            hidden: AtomicBool::new(false),
            interactive: AtomicBool::new(false),
            window_gate: Arc::new(WindowGate::new()),
            preferences: Mutex::new(NimbiPreferences::default()),
            preferences_path: Mutex::new(None),
        }
    }
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self::new()
    }
}
