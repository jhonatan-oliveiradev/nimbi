use std::time::Duration;

use crate::nx_agent::{
    ActionErrorCode, NimbiActionRequest, NxAgentClient, ACTION_TIMEOUT_MS, MAX_ACTION_TEXT_LENGTH,
};

async fn fixture_server(
    status: &str,
    body: &str,
    delay: Option<Duration>,
) -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let status = status.to_string();
    let body = body.to_string();

    tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = vec![0_u8; 8192];
        let _ = tokio::io::AsyncReadExt::read(&mut stream, &mut request).await;
        if let Some(delay) = delay {
            tokio::time::sleep(delay).await;
        }
        let response = format!(
            "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        tokio::io::AsyncWriteExt::write_all(&mut stream, response.as_bytes())
            .await
            .unwrap();
    });

    format!("http://{addr}")
}

#[test]
fn accepts_only_loopback_base_urls() {
    assert!(NxAgentClient::with_endpoint("http://127.0.0.1:48667", "/v1/actions").is_ok());
    assert!(NxAgentClient::with_endpoint("http://localhost:48667", "/v1/actions").is_ok());
    assert!(NxAgentClient::with_endpoint("http://[::1]:48667", "/v1/actions").is_ok());

    for invalid in [
        "http://example.com",
        "https://192.168.1.20:48667",
        "http://10.0.0.3:48667",
        "http://user@localhost:48667",
    ] {
        assert!(NxAgentClient::with_endpoint(invalid, "/v1/actions").is_err());
    }
}

#[tokio::test]
async fn trims_prompt_text_before_transport() {
    let base = fixture_server(
        "200 OK",
        r#"{"accepted":true,"response":"Started","sessionId":"session-a"}"#,
        None,
    )
    .await;
    let client = NxAgentClient::with_endpoint(base, "/v1/actions").unwrap();

    let result = client
        .submit(&NimbiActionRequest::Prompt {
            text: "  check build  ".into(),
        })
        .await
        .unwrap();

    assert!(result.accepted);
    assert_eq!(result.response.as_deref(), Some("Started"));
    assert_eq!(result.session_id.as_deref(), Some("session-a"));
}

#[tokio::test]
async fn rejects_empty_and_overlong_text_before_transport() {
    let client = NxAgentClient::with_endpoint("http://127.0.0.1:9", "/v1/actions").unwrap();

    let empty = client
        .submit(&NimbiActionRequest::Prompt { text: "   ".into() })
        .await
        .unwrap_err();
    assert_eq!(empty.code, ActionErrorCode::InvalidRequest);

    let overlong = client
        .submit(&NimbiActionRequest::Prompt {
            text: "a".repeat(MAX_ACTION_TEXT_LENGTH + 1),
        })
        .await
        .unwrap_err();
    assert_eq!(overlong.code, ActionErrorCode::InvalidRequest);
}

#[tokio::test]
async fn reply_requires_non_empty_session_id() {
    let client = NxAgentClient::with_endpoint("http://127.0.0.1:9", "/v1/actions").unwrap();
    let error = client
        .submit(&NimbiActionRequest::Reply {
            session_id: "  ".into(),
            text: "yes".into(),
        })
        .await
        .unwrap_err();

    assert_eq!(error.code, ActionErrorCode::InvalidRequest);
}

#[tokio::test]
async fn connection_failure_is_unavailable() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    drop(listener);

    let client =
        NxAgentClient::with_endpoint(format!("http://{addr}"), "/v1/actions").unwrap();
    let error = client
        .submit(&NimbiActionRequest::Prompt { text: "hello".into() })
        .await
        .unwrap_err();

    assert_eq!(error.code, ActionErrorCode::Unavailable);
}

#[tokio::test]
async fn non_success_response_is_rejected() {
    let base = fixture_server(
        "403 Forbidden",
        r#"{"error":"Capability denied"}"#,
        None,
    )
    .await;
    let client = NxAgentClient::with_endpoint(base, "/v1/actions").unwrap();
    let error = client
        .submit(&NimbiActionRequest::Prompt { text: "hello".into() })
        .await
        .unwrap_err();

    assert_eq!(error.code, ActionErrorCode::Rejected);
    assert_eq!(error.message, "Capability denied");
}

#[tokio::test]
async fn malformed_json_is_invalid_response() {
    let base = fixture_server("200 OK", "not-json", None).await;
    let client = NxAgentClient::with_endpoint(base, "/v1/actions").unwrap();
    let error = client
        .submit(&NimbiActionRequest::Prompt { text: "hello".into() })
        .await
        .unwrap_err();

    assert_eq!(error.code, ActionErrorCode::InvalidResponse);
}

#[tokio::test]
async fn slow_response_times_out_at_configured_limit() {
    assert_eq!(ACTION_TIMEOUT_MS, 5_000);

    let base = fixture_server(
        "200 OK",
        r#"{"accepted":true}"#,
        Some(Duration::from_millis(ACTION_TIMEOUT_MS + 250)),
    )
    .await;
    let client = NxAgentClient::with_endpoint(base, "/v1/actions").unwrap();
    let error = client
        .submit(&NimbiActionRequest::Prompt { text: "hello".into() })
        .await
        .unwrap_err();

    assert_eq!(error.code, ActionErrorCode::Timeout);
}
