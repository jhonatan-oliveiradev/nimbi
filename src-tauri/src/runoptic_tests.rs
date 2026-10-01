use serde_json::{json, Value};

use crate::runoptic::{derive_snapshot, RunOpticClient, RunOpticTelemetrySnapshot};
use crate::state::{NimbiActivity, NimbiSnapshot};

fn provenance(ts: u64) -> Value {
    json!({
        "kind": "official",
        "collector": "test",
        "observed_at_ms": ts
    })
}

fn session(
    id: &str,
    agent: &str,
    state: &str,
    ts: u64,
    attention: Option<&str>,
) -> Value {
    json!({
        "session_id": id,
        "agent": agent,
        "provider": if agent == "Codex" { Some("openai") } else { None },
        "environment_id": "windows-native",
        "project_id": if id == "work" { Some("nimbi") } else { None },
        "model": if agent == "Codex" { Some("gpt-5.6") } else { None },
        "state": state,
        "state_since_ms": ts,
        "attention_reason": attention,
        "provenance": provenance(ts)
    })
}

fn activity(
    id: &str,
    kind: &str,
    session_id: &str,
    agent: &str,
    ts: u64,
    error: Option<&str>,
) -> Value {
    json!({
        "id": id,
        "kind": kind,
        "session_id": session_id,
        "agent": agent,
        "environment_id": "windows-native",
        "project_id": null,
        "provider": null,
        "model": null,
        "error": error,
        "provenance": provenance(ts)
    })
}

fn raw(sessions: Vec<Value>, activity: Vec<Value>) -> RunOpticTelemetrySnapshot {
    serde_json::from_value(json!({
        "protocol": "runoptic.telemetry.v1",
        "sessions": sessions,
        "activity": activity,
        "updated_at_ms": 100
    }))
    .unwrap()
}

#[test]
fn wrong_protocol_is_offline() {
    let mut current = raw(vec![], vec![]);
    current.protocol = "other.v1".into();

    let derived = derive_snapshot(&current, None);
    assert!(!derived.connected);
    assert_eq!(derived.activity, NimbiActivity::Offline);
}

#[test]
fn no_sessions_is_idle() {
    let derived = derive_snapshot(&raw(vec![], vec![]), None);
    assert!(derived.connected);
    assert_eq!(derived.activity, NimbiActivity::Idle);
}

#[test]
fn waiting_with_attention_reason_needs_input() {
    let derived = derive_snapshot(
        &raw(
            vec![session("wait", "Claude", "waiting", 20, Some("Approval required"))],
            vec![],
        ),
        None,
    );

    assert_eq!(derived.activity, NimbiActivity::NeedsInput);
    assert_eq!(derived.agent.as_deref(), Some("Claude"));
    assert_eq!(derived.summary.as_deref(), Some("Approval required"));
}

#[test]
fn latest_explicit_error_becomes_error() {
    let derived = derive_snapshot(
        &raw(
            vec![session("work", "Codex", "working", 10, None)],
            vec![activity(
                "error-1",
                "tool_completed",
                "work",
                "Codex",
                30,
                Some("Tool failed"),
            )],
        ),
        None,
    );

    assert_eq!(derived.activity, NimbiActivity::Error);
    assert_eq!(derived.summary.as_deref(), Some("Tool failed"));
}

#[test]
fn latest_query_start_marks_working_session_as_thinking() {
    let derived = derive_snapshot(
        &raw(
            vec![session("work", "Codex", "working", 10, None)],
            vec![
                activity("tool", "tool_completed", "work", "Codex", 15, None),
                activity("query", "query_started", "work", "Codex", 20, None),
            ],
        ),
        None,
    );

    assert_eq!(derived.activity, NimbiActivity::Thinking);
}

#[test]
fn latest_tool_completion_keeps_working_session_working() {
    let derived = derive_snapshot(
        &raw(
            vec![session("work", "Codex", "working", 10, None)],
            vec![
                activity("query", "query_started", "work", "Codex", 20, None),
                activity("tool", "tool_completed", "work", "Codex", 30, None),
            ],
        ),
        None,
    );

    assert_eq!(derived.activity, NimbiActivity::Working);
}

#[test]
fn previous_active_session_becoming_done_reacts_complete() {
    let previous = NimbiSnapshot {
        connected: true,
        protocol: Some("runoptic.telemetry.v1".into()),
        activity: NimbiActivity::Working,
        session_id: Some("work".into()),
        agent: Some("Codex".into()),
        provider: None,
        model: None,
        project: None,
        environment: None,
        summary: None,
        observed_at: Some(10),
    };

    let derived = derive_snapshot(
        &raw(vec![session("work", "Codex", "done", 40, None)], vec![]),
        Some(&previous),
    );

    assert_eq!(derived.activity, NimbiActivity::Complete);
    assert_eq!(derived.session_id.as_deref(), Some("work"));
}

#[test]
fn priorities_and_ties_are_deterministic() {
    let attention_wins = derive_snapshot(
        &raw(
            vec![
                session("z-attention", "Claude", "waiting", 10, Some("Needs approval")),
                session("work", "Codex", "working", 50, None),
            ],
            vec![activity(
                "err",
                "tool_completed",
                "work",
                "Codex",
                60,
                Some("Newer error"),
            )],
        ),
        None,
    );
    assert_eq!(attention_wins.activity, NimbiActivity::NeedsInput);
    assert_eq!(attention_wins.session_id.as_deref(), Some("z-attention"));

    let error_wins = derive_snapshot(
        &raw(
            vec![
                session("b", "Codex", "working", 40, None),
                session("a", "Codex", "working", 40, None),
            ],
            vec![activity(
                "err",
                "tool_completed",
                "b",
                "Codex",
                41,
                Some("Failed"),
            )],
        ),
        None,
    );
    assert_eq!(error_wins.activity, NimbiActivity::Error);

    let tie = derive_snapshot(
        &raw(
            vec![
                session("b", "Codex", "working", 50, None),
                session("a", "Codex", "working", 50, None),
            ],
            vec![],
        ),
        None,
    );
    assert_eq!(tie.session_id.as_deref(), Some("a"));
}

#[test]
fn unknown_attribution_is_omitted_when_serialized() {
    let derived = derive_snapshot(
        &raw(vec![session("wait", "Claude", "waiting", 20, Some("Needs you"))], vec![]),
        None,
    );
    let value = serde_json::to_value(derived).unwrap();
    let object = value.as_object().unwrap();

    assert!(!object.contains_key("provider"));
    assert!(!object.contains_key("model"));
    assert!(!object.contains_key("project"));
}

#[tokio::test]
async fn unreachable_transport_is_offline() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    drop(listener);

    let client = RunOpticClient::with_base_url(format!("http://{addr}")).unwrap();
    let derived = client.fetch(None).await;

    assert!(!derived.connected);
    assert_eq!(derived.activity, NimbiActivity::Offline);
}

#[test]
fn rejects_non_loopback_base_urls() {
    assert!(RunOpticClient::with_base_url("http://example.com").is_err());
}
