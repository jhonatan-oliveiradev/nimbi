# Nimbi Attention & Actions v1 Design

**Date:** 2026-10-02  
**Status:** Approved design  
**Branch:** `feat/attention-actions-v1`

## 1. Goal

Add the first real interaction loop to Nimbi without turning it into a dashboard or chat client.

A user should be able to:
- click Nimbi while idle and send a general prompt to NX Agent;
- reply directly when a RunOptic session enters `needs-input`;
- see a short immediate response inside the island;
- hand longer-running work back to RunOptic as the source of progress.

The interaction must preserve Nimbi's role as the ambient face + hands of the system:

```text
RunOptic = observation / eyes
NX Agent / JARVIS = orchestration + execution / brain
Nimbi = ambient interaction / face + hands
```

## 2. Product behavior

### 2.1 Contextual input

Nimbi exposes one input surface with automatic routing.

If the current snapshot is:

```text
activity === "needs-input"
&& sessionId is present
```

the submitted text is a reply to that session.

Otherwise, the submitted text is a general prompt to NX Agent.

The user does not manually choose an agent, project, or session in v1.

### 2.2 Idle prompt flow

Clicking Nimbi from idle expands a compact input surface anchored to Cloudee.

The field receives focus immediately.

Keyboard behavior:
- `Enter` submits;
- `Shift+Enter` inserts a line break;
- `Escape` closes the composing state;
- clicking outside collapses the surface when no blocking attention state exists.

On submit:
- the draft is preserved until acceptance;
- Cloudee enters a temporary thinking/sending behavior;
- NX Agent may return a short acknowledgement;
- if work continues, RunOptic becomes the source of truth for `thinking`, `working`, `complete`, `needs-input`, or `error`.

### 2.3 needs-input flow

When RunOptic produces `needs-input`, Nimbi enters attention mode and surfaces:
- agent name when available;
- the normalized attention summary;
- a contextual reply field.

Submitting sends:

```ts
{
  type: "reply",
  sessionId,
  text
}
```

If accepted:
- show a brief confirmation/response if provided;
- allow Cloudee to react;
- return control of long-running status to RunOptic.

### 2.4 Short response behavior

NX Agent may return short display text suitable for the island.

Short responses are ephemeral presentation state, not chat history.

They:
- remain visible for a short period;
- may remain while the user is actively hovering/interacting;
- yield immediately to higher-priority attention or error states;
- disappear when RunOptic produces meaningful follow-up work.

Nimbi does not persist prompt or response history in v1.

## 3. Visual and motion direction

The supplied interaction reference establishes the desired interface behavior.

Nimbi must not feel like an avatar next to a panel. The interface should appear to grow from the companion itself.

Required visual principles:
- Cloudee remains the visual anchor during interaction;
- UI expands and contracts around the avatar rather than replacing it;
- compact chips/cards may extend laterally from the companion;
- state changes use continuity: morphing, spring motion, scale, blur, opacity, and subtle glow;
- transitions must not read as abrupt panel swaps;
- passive Nimbi remains very small and low-distraction;
- details appear only when useful;
- attention states may grow enough to communicate context but must remain companion-like, not window-like.

A representative progression:

```text
[ Cloudee ]

[ Cloudee ]  Ask Nimbi…

[ Cloudee ]  > check the PING build

[ Cloudee ]  Build started. I'll keep an eye on it.

[ Cloudee ]  [ Working · PING ]

[ Cloudee ]  Codex needs you
             Apply this migration?
             [ Reply… ]
```

Reduced-motion mode must preserve state clarity without continuous or decorative motion.

## 4. Architecture

Observation and action remain separate channels.

```text
RunOptic                         NX Agent
   │                               ▲
   │ GET telemetry                 │ local action requests
   ▼                               │
Rust RunOpticClient        Rust NimbiActionClient
   │                               ▲
   ▼                               │
NimbiSnapshot ──────► AttentionController
                           │
                           ▼
                     Dynamic Island
```

### 4.1 Responsibility boundaries

**RunOptic**
- remains the source of truth for observed agent state;
- is not turned into an execution gateway;
- continues to expose normalized local telemetry only.

**NX Agent / JARVIS**
- owns command routing and execution;
- owns capability checks and side effects;
- owns session reply semantics;
- may return a short acknowledgement plus a session id for continued work.

**Nimbi**
- selects `reply` vs `prompt` from current context;
- presents interaction state;
- never directly executes shell commands or provider calls;
- never stores provider credentials;
- never invents a fallback executor when NX Agent is unavailable.

## 5. Action contract

Frontend-facing TypeScript contract:

```ts
export type NimbiActionRequest =
  | {
      type: "reply";
      sessionId: string;
      text: string;
    }
  | {
      type: "prompt";
      text: string;
    };

export interface NimbiActionResult {
  accepted: boolean;
  response?: string;
  sessionId?: string;
  error?: string;
}
```

The React layer calls a Tauri command. It does not fetch the NX Agent endpoint directly.

The Rust action client is responsible for transport, validation, timeout, and loopback-only enforcement.

## 6. Action UI state

The interaction layer should use a small explicit state model:

```ts
export type ActionUiState =
  | { status: "idle" }
  | { status: "composing"; draft: string }
  | { status: "sending"; text: string }
  | { status: "response"; text: string }
  | { status: "error"; message: string; draft: string };
```

Draft text must survive transport failure.

Retry reuses the preserved draft and the current routing context unless that context is no longer valid.

## 7. Priority rules

Visual priority, highest first:

```text
action transport error
    >
real needs-input
    >
short NX Agent response
    >
RunOptic working / thinking / complete
    >
idle
```

A cosmetic acknowledgement must never hide a real attention request.

If the current `needs-input` session changes while a draft exists, Nimbi must not silently send that draft to the new session. The draft remains visible but requires explicit resubmission against the new context.

## 8. Local transport and security

The action transport must preserve the current local-first security posture.

Requirements:
- only loopback HTTP(S) endpoints are accepted: `127.0.0.1`, `localhost`, or `::1`;
- no arbitrary frontend-supplied URL;
- no shell fallback;
- no provider API keys in Nimbi;
- no direct provider calls;
- `reply` requires a non-empty `sessionId`;
- request text must be trimmed and bounded to a fixed maximum length;
- transport uses a short timeout;
- malformed or rejected responses become typed action errors;
- NX Agent remains responsible for capability-scoped execution and side-effect authorization;
- Nimbi remains default-deny for any capability it does not explicitly understand.

The exact local NX Agent route may be configurable internally, but the browser layer must not control it.

## 9. Interaction controller

Add a focused controller between telemetry and presentation.

Responsibilities:
- determine whether submission becomes `reply` or `prompt`;
- retain the session id used for a reply submission;
- manage composing/sending/response/error state;
- clear ephemeral response state when RunOptic produces higher-priority activity;
- preserve draft on action failure;
- expose presentation-ready state to the island.

This logic should remain independent from Cloudee rendering and from HTTP transport so it can be unit tested without the native runtime.

## 10. Cloudee behavior mapping

Existing semantic behavior remains authoritative.

Additional interaction behavior:
- composing: attentive/listening posture;
- sending: thinking posture;
- response accepted: brief positive reaction, then semantic baseline;
- action error: error/attention reaction;
- needs-input while composing: attention takes precedence without discarding the draft.

No new character system should be introduced for this slice.

## 11. Native shell behavior

When the text input is active:
- the Tauri window must become interactive/focusable enough to accept keyboard input;
- passive click-through behavior must resume after interaction collapses;
- opening the input should not permanently alter placement or docking;
- tray show/hide behavior remains unchanged;
- hidden state continues to pause or slow background work as already implemented.

## 12. Error handling

If NX Agent cannot be reached:
- show a compact connection/action error;
- preserve the draft;
- expose Retry;
- do not route the command elsewhere.

If NX Agent rejects a request:
- show the returned safe error message when available;
- preserve the draft when retry could be meaningful.

If RunOptic is offline:
- general prompt may still be sent to NX Agent if the action channel itself is available;
- contextual reply is unavailable unless a valid `needs-input` session id is already present.

## 13. Scope exclusions

Not included in v1:
- persistent chat history;
- conversation threads;
- token streaming;
- markdown-rich assistant messages;
- file attachments;
- voice;
- agent picker;
- project picker;
- multiple simultaneous action composers;
- tool-call visualization;
- direct shell execution;
- provider-specific controls;
- granular side-effect approval UI;
- cloud account sync;
- analytics or telemetry owned by Nimbi.

## 14. Testing requirements

### 14.1 Routing
Tests must prove:
- `needs-input + sessionId` routes to `reply`;
- idle routes to `prompt`;
- `needs-input` without session id does not fabricate a reply target.

### 14.2 Interaction state
Tests must prove:
- Enter submits;
- Shift+Enter inserts a newline;
- Escape closes composing when permitted;
- draft survives failure;
- Retry reuses the draft;
- a changed attention session cannot silently receive a draft intended for the prior session.

### 14.3 Priority
Tests must prove:
- transport error outranks presentation response;
- real `needs-input` outranks short response;
- RunOptic activity replaces an ephemeral acknowledgement when appropriate.

### 14.4 Rust transport
Tests must prove:
- loopback endpoints are accepted;
- non-loopback endpoints are rejected;
- reply requires session id;
- timeout becomes a typed failure;
- malformed response becomes a typed failure.

### 14.5 Visual behavior
Browser/component tests should cover:
- idle;
- composing;
- sending;
- response;
- action error;
- needs-input;
- docked horizontal and vertical layouts;
- reduced motion.

## 15. Success criteria

The slice is complete when all of the following are true:

1. From idle, the user can click Nimbi, type a prompt, and submit it to NX Agent.
2. In `needs-input`, the same input replies to the observed session automatically.
3. NX Agent can return a short acknowledgement rendered in the island.
4. Long-running work is represented by RunOptic rather than duplicated action state.
5. Failed actions keep the draft and offer Retry.
6. The UI visually grows from Cloudee and never reads as a conventional chat window.
7. No provider credentials, prompt history, response history, or direct shell execution are added to Nimbi.
8. Native Windows focus/click-through behavior still works correctly.
9. Reduced-motion behavior remains supported.
10. Existing placement, tray, Store packaging, and telemetry behavior remain intact.
