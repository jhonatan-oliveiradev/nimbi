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

use crate::nx_agent::NxAgentClient;
use crate::preferences::{
    default_preferences_path, load_preferences_from, PreferencesV1,
};
use crate::window::WindowGate;

pub struct RuntimeState {
    pub nx_agent: NxAgentClient,
    pub snapshot: Mutex<NimbiSnapshot>,
    pub hidden: AtomicBool,
    pub interactive: AtomicBool,
    pub dragging: AtomicBool,
    pub window_gate: Arc<WindowGate>,
    pub preferences: Mutex<PreferencesV1>,
    pub preferences_path: PathBuf,
}

impl RuntimeState {
    pub fn new() -> Self {
        let preferences_path = default_preferences_path();
        let preferences = load_preferences_from(&preferences_path);
        Self {
            nx_agent: NxAgentClient::default(),
            snapshot: Mutex::new(NimbiSnapshot::offline()),
            hidden: AtomicBool::new(false),
            interactive: AtomicBool::new(false),
            dragging: AtomicBool::new(false),
            window_gate: Arc::new(WindowGate::new()),
            preferences: Mutex::new(preferences),
            preferences_path,
        }
    }
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self::new()
    }
}
