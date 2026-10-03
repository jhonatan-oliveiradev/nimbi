use std::time::Duration;

use serde::{Deserialize, Serialize};

pub const MAX_ACTION_TEXT_LENGTH: usize = 8_000;
pub const ACTION_TIMEOUT_MS: u64 = 5_000;
pub const DEFAULT_NX_AGENT_BASE_URL: &str = "http://127.0.0.1:4317";
pub const DEFAULT_NX_AGENT_ACTION_PATH: &str = "/v1/actions";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum NimbiActionRequest {
    Prompt {
        text: String,
    },
    Reply {
        #[serde(rename = "sessionId")]
        session_id: String,
        text: String,
    },
}

impl NimbiActionRequest {
    fn normalized(&self) -> Result<Self, ActionError> {
        let validate_text = |text: &str| -> Result<String, ActionError> {
            let text = text.trim();
            if text.is_empty() {
                return Err(ActionError::invalid_request("Action text is required"));
            }
            if text.chars().count() > MAX_ACTION_TEXT_LENGTH {
                return Err(ActionError::invalid_request(
                    "Action text exceeds the 8000 character limit",
                ));
            }
            Ok(text.to_string())
        };

        match self {
            Self::Prompt { text } => Ok(Self::Prompt {
                text: validate_text(text)?,
            }),
            Self::Reply { session_id, text } => {
                let session_id = session_id.trim();
                if session_id.is_empty() {
                    return Err(ActionError::invalid_request(
                        "Reply requires a sessionId",
                    ));
                }
                Ok(Self::Reply {
                    session_id: session_id.to_string(),
                    text: validate_text(text)?,
                })
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NimbiActionResult {
    pub accepted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ActionErrorCode {
    InvalidRequest,
    Unavailable,
    Timeout,
    Rejected,
    InvalidResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActionError {
    pub code: ActionErrorCode,
    pub message: String,
}

impl ActionError {
    fn new(code: ActionErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    fn invalid_request(message: impl Into<String>) -> Self {
        Self::new(ActionErrorCode::InvalidRequest, message)
    }

    pub fn unavailable(message: impl Into<String>) -> Self {
        Self::new(ActionErrorCode::Unavailable, message)
    }
}

#[derive(Clone)]
pub struct NxAgentClient {
    client: reqwest::Client,
    endpoint: Option<String>,
    token: Option<String>,
}

impl Default for NxAgentClient {
    fn default() -> Self {
        let base_url = std::env::var("NIMBI_NX_AGENT_BASE_URL")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_NX_AGENT_BASE_URL.into());
        let action_path = std::env::var("NIMBI_NX_AGENT_ACTION_PATH")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_NX_AGENT_ACTION_PATH.into());
        let token = std::env::var("NIMBI_NX_AGENT_TOKEN")
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());

        Self::with_endpoint_and_token(base_url, action_path, token)
            .unwrap_or_else(|_| Self::unavailable())
    }
}

impl NxAgentClient {
    pub fn unavailable() -> Self {
        Self {
            client: build_client(),
            endpoint: None,
            token: None,
        }
    }

    pub fn with_endpoint(
        base_url: impl Into<String>,
        action_path: impl AsRef<str>,
    ) -> Result<Self, ActionError> {
        Self::with_endpoint_and_token(base_url, action_path, None)
    }

    pub fn with_endpoint_and_token(
        base_url: impl Into<String>,
        action_path: impl AsRef<str>,
        token: Option<String>,
    ) -> Result<Self, ActionError> {
        let base_url = base_url.into();
        let base_url = base_url.trim_end_matches('/');
        if !is_loopback_url(base_url) {
            return Err(ActionError::invalid_request(
                "NX Agent base URL must be loopback HTTP(S)",
            ));
        }

        let action_path = action_path.as_ref().trim();
        if !action_path.starts_with('/') || action_path.starts_with("//") {
            return Err(ActionError::invalid_request(
                "NX Agent action path must be an absolute path",
            ));
        }

        Ok(Self {
            client: build_client(),
            endpoint: Some(format!("{base_url}{action_path}")),
            token: token
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty()),
        })
    }

    pub async fn submit(
        &self,
        request: &NimbiActionRequest,
    ) -> Result<NimbiActionResult, ActionError> {
        let request = request.normalized()?;
        let endpoint = self
            .endpoint
            .as_ref()
            .ok_or_else(|| ActionError::unavailable("NX Agent is not configured"))?;

        let mut pending = self.client.post(endpoint).json(&request);
        if let Some(token) = self.token.as_deref() {
            pending = pending.bearer_auth(token);
        }

        let response = pending.send().await.map_err(|error| {
            if error.is_connect() {
                ActionError::unavailable("NX Agent is unavailable")
            } else if error.is_timeout() {
                ActionError::new(ActionErrorCode::Timeout, "NX Agent request timed out")
            } else {
                ActionError::unavailable("NX Agent is unavailable")
            }
        })?;

        let status = response.status();
        if !status.is_success() {
            let message = response
                .json::<serde_json::Value>()
                .await
                .ok()
                .and_then(|value| {
                    value
                        .get("error")
                        .and_then(serde_json::Value::as_str)
                        .map(str::to_string)
                })
                .unwrap_or_else(|| format!("NX Agent rejected the request ({status})"));
            return Err(ActionError::new(ActionErrorCode::Rejected, message));
        }

        let result = response
            .json::<NimbiActionResult>()
            .await
            .map_err(|_| {
                ActionError::new(
                    ActionErrorCode::InvalidResponse,
                    "NX Agent returned an invalid response",
                )
            })?;

        if !result.accepted {
            return Err(ActionError::new(
                ActionErrorCode::Rejected,
                result
                    .error
                    .clone()
                    .unwrap_or_else(|| "NX Agent rejected the request".into()),
            ));
        }

        Ok(result)
    }
}

fn build_client() -> reqwest::Client {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_millis(1_200))
        .timeout(Duration::from_millis(ACTION_TIMEOUT_MS))
        .build()
        .expect("reqwest client configuration must be valid")
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
        let Some((host, suffix)) = stripped.split_once(']') else {
            return false;
        };
        if !suffix.is_empty() && !suffix.starts_with(':') {
            return false;
        }
        host
    } else {
        authority.split(':').next().unwrap_or_default()
    };

    matches!(
        host.to_ascii_lowercase().as_str(),
        "127.0.0.1" | "localhost" | "::1"
    )
}