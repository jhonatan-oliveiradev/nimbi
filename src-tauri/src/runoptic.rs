use std::time::Duration;

use serde::Deserialize;

use crate::state::{NimbiActivity, NimbiSnapshot};

const PROTOCOL: &str = "runoptic.telemetry.v1";
const DEFAULT_BASE_URL: &str = "http://127.0.0.1:48666";

#[derive(Debug, Clone, Deserialize)]
pub struct Provenance {
    pub observed_at_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AgentSessionObservation {
    pub session_id: String,
    pub agent: String,
    pub provider: Option<String>,
    pub environment_id: String,
    pub project_id: Option<String>,
    pub model: Option<String>,
    pub state: String,
    pub state_since_ms: Option<u64>,
    pub attention_reason: Option<String>,
    pub provenance: Provenance,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ActivityObservation {
    pub id: String,
    pub kind: String,
    pub session_id: String,
    pub agent: String,
    pub environment_id: String,
    pub project_id: Option<String>,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub error: Option<String>,
    pub provenance: Provenance,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RunOpticTelemetrySnapshot {
    pub protocol: String,
    #[serde(default)]
    pub sessions: Vec<AgentSessionObservation>,
    #[serde(default)]
    pub activity: Vec<ActivityObservation>,
    pub updated_at_ms: u64,
}

#[derive(Clone)]
pub struct RunOpticClient {
    client: reqwest::Client,
    base_url: String,
}

impl Default for RunOpticClient {
    fn default() -> Self {
        let base_url = std::env::var("NIMBI_RUNOPTIC_BASE_URL")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_BASE_URL.into());

        Self::with_base_url(base_url).unwrap_or_else(|_| {
            Self::with_base_url(DEFAULT_BASE_URL)
                .expect("hard-coded RunOptic loopback URL must be valid")
        })
    }
}

impl RunOpticClient {
    pub fn with_base_url(base_url: impl Into<String>) -> Result<Self, String> {
        let base_url = base_url.into().trim_end_matches('/').to_string();
        if !is_loopback_url(&base_url) {
            return Err("RunOptic base URL must be loopback HTTP(S)".into());
        }

        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_millis(700))
            .timeout(Duration::from_millis(1200))
            .build()
            .map_err(|error| error.to_string())?;

        Ok(Self { client, base_url })
    }

    pub async fn fetch(&self, previous: Option<&NimbiSnapshot>) -> NimbiSnapshot {
        let url = format!("{}/v1/telemetry/state", self.base_url);
        let response = match self.client.get(url).send().await {
            Ok(response) => response,
            Err(_) => return NimbiSnapshot::offline(),
        };

        if !response.status().is_success() {
            return NimbiSnapshot::offline();
        }

        let raw = match response.json::<RunOpticTelemetrySnapshot>().await {
            Ok(raw) => raw,
            Err(_) => return NimbiSnapshot::offline(),
        };

        derive_snapshot(&raw, previous)
    }
}

fn is_loopback_url(value: &str) -> bool {
    let Some((scheme, rest)) = value.split_once("://") else {
        return false;
    };
    if !matches!(scheme.to_ascii_lowercase().as_str(), "http" | "https") {
        return false;
    }

    let authority = rest.split('/').next().unwrap_or_default();
    if authority.is_empty() || authority.contains('@') {
        return false;
    }

    let host = if let Some(stripped) = authority.strip_prefix('[') {
        stripped.split(']').next().unwrap_or_default()
    } else {
        authority.split(':').next().unwrap_or_default()
    };

    matches!(host.to_ascii_lowercase().as_str(), "127.0.0.1" | "localhost" | "::1")
}

pub fn derive_snapshot(
    raw: &RunOpticTelemetrySnapshot,
    previous: Option<&NimbiSnapshot>,
) -> NimbiSnapshot {
    if raw.protocol != PROTOCOL {
        return NimbiSnapshot::offline();
    }

    if let Some(session) = newest_session(
        raw.sessions
            .iter()
            .filter(|session| session.state == "waiting")
            .filter(|session| nonempty(session.attention_reason.as_deref()).is_some()),
    ) {
        return snapshot_from_session(
            session,
            NimbiActivity::NeedsInput,
            nonempty(session.attention_reason.as_deref()).map(str::to_string),
            raw.updated_at_ms,
        );
    }

    if let Some(error_activity) = newest_activity(
        raw.activity
            .iter()
            .filter(|activity| nonempty(activity.error.as_deref()).is_some()),
    ) {
        let session = raw
            .sessions
            .iter()
            .find(|session| session.session_id == error_activity.session_id);

        return snapshot_from_activity_error(
            error_activity,
            session,
            raw.updated_at_ms,
        );
    }

    let active = newest_session(raw.sessions.iter().filter(|session| session.state == "working"));
    if let Some(session) = active {
        let latest = newest_activity(
            raw.activity
                .iter()
                .filter(|activity| activity.session_id == session.session_id),
        );
        let activity = if latest.map(|item| item.kind.as_str()) == Some("query_started") {
            NimbiActivity::Thinking
        } else {
            NimbiActivity::Working
        };

        return snapshot_from_session(session, activity, None, raw.updated_at_ms);
    }

    if let Some(previous) = previous.filter(|previous| {
        matches!(
            previous.activity,
            NimbiActivity::Working | NimbiActivity::Thinking
        )
    }) {
        if let Some(previous_id) = previous.session_id.as_deref() {
            if let Some(done) = raw
                .sessions
                .iter()
                .find(|session| session.session_id == previous_id && session.state == "done")
            {
                return snapshot_from_session(
                    done,
                    NimbiActivity::Complete,
                    None,
                    raw.updated_at_ms,
                );
            }
        }
    }

    NimbiSnapshot::idle(Some(raw.updated_at_ms))
}

fn newest_session<'a>(
    iter: impl Iterator<Item = &'a AgentSessionObservation>,
) -> Option<&'a AgentSessionObservation> {
    let mut items: Vec<_> = iter.collect();
    items.sort_by(|a, b| {
        let a_time = a.provenance.observed_at_ms.max(a.state_since_ms.unwrap_or(0));
        let b_time = b.provenance.observed_at_ms.max(b.state_since_ms.unwrap_or(0));
        b_time
            .cmp(&a_time)
            .then_with(|| a.session_id.cmp(&b.session_id))
    });
    items.into_iter().next()
}

fn newest_activity<'a>(
    iter: impl Iterator<Item = &'a ActivityObservation>,
) -> Option<&'a ActivityObservation> {
    let mut items: Vec<_> = iter.collect();
    items.sort_by(|a, b| {
        b.provenance
            .observed_at_ms
            .cmp(&a.provenance.observed_at_ms)
            .then_with(|| a.session_id.cmp(&b.session_id))
            .then_with(|| a.id.cmp(&b.id))
    });
    items.into_iter().next()
}

fn snapshot_from_session(
    session: &AgentSessionObservation,
    activity: NimbiActivity,
    summary: Option<String>,
    updated_at_ms: u64,
) -> NimbiSnapshot {
    NimbiSnapshot {
        connected: true,
        protocol: Some(PROTOCOL.into()),
        activity,
        session_id: Some(session.session_id.clone()),
        agent: some_nonempty(&session.agent),
        provider: session.provider.as_deref().and_then(nonempty).map(str::to_string),
        model: session.model.as_deref().and_then(nonempty).map(str::to_string),
        project: session
            .project_id
            .as_deref()
            .and_then(nonempty)
            .map(str::to_string),
        environment: nonempty(&session.environment_id).map(str::to_string),
        summary,
        observed_at: Some(updated_at_ms),
    }
}

fn snapshot_from_activity_error(
    observation: &ActivityObservation,
    session: Option<&AgentSessionObservation>,
    updated_at_ms: u64,
) -> NimbiSnapshot {
    NimbiSnapshot {
        connected: true,
        protocol: Some(PROTOCOL.into()),
        activity: NimbiActivity::Error,
        session_id: Some(observation.session_id.clone()),
        agent: session
            .and_then(|value| some_nonempty(&value.agent))
            .or_else(|| some_nonempty(&observation.agent)),
        provider: session
            .and_then(|value| value.provider.as_deref())
            .and_then(nonempty)
            .or_else(|| observation.provider.as_deref().and_then(nonempty))
            .map(str::to_string),
        model: session
            .and_then(|value| value.model.as_deref())
            .and_then(nonempty)
            .or_else(|| observation.model.as_deref().and_then(nonempty))
            .map(str::to_string),
        project: session
            .and_then(|value| value.project_id.as_deref())
            .and_then(nonempty)
            .or_else(|| observation.project_id.as_deref().and_then(nonempty))
            .map(str::to_string),
        environment: session
            .map(|value| value.environment_id.as_str())
            .and_then(nonempty)
            .or_else(|| nonempty(&observation.environment_id))
            .map(str::to_string),
        summary: observation
            .error
            .as_deref()
            .and_then(nonempty)
            .map(str::to_string),
        observed_at: Some(updated_at_ms),
    }
}

fn nonempty(value: &str) -> Option<&str> {
    let value = value.trim();
    (!value.is_empty()).then_some(value)
}

fn some_nonempty(value: &str) -> Option<String> {
    nonempty(value).map(str::to_string)
}
