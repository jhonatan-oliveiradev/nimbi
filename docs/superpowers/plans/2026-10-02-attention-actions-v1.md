# Nimbi Attention & Actions v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Nimbi accept general prompts and contextual replies through one compact Cloudee-anchored interaction surface, while NX Agent owns execution and RunOptic remains the source of long-running status.

**Architecture:** Add a frontend action controller that routes `needs-input + sessionId` to reply and all other valid submissions to prompt. React calls one Tauri command; Rust validates the request and sends it only to a configured loopback NX Agent endpoint. DynamicIsland renders composing/sending/response/error states around Cloudee and yields to higher-priority RunOptic attention state.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Motion, Tauri 2, Rust, reqwest, serde, tokio.

**Spec:** `docs/superpowers/specs/2026-10-02-attention-actions-v1-design.md`

## Global Constraints

- RunOptic remains observation-only; do not add action endpoints to RunOptic.
- NX Agent/JARVIS owns execution, capability checks, and side effects.
- Nimbi never executes shell commands or provider calls directly.
- Frontend never receives provider credentials and never controls the NX Agent URL.
- Only loopback HTTP(S) targets are valid: `127.0.0.1`, `localhost`, `::1`.
- Action text is trimmed and limited to 8,000 UTF-8 characters.
- Native action requests time out after 5,000 ms.
- `reply` requires a non-empty `sessionId`.
- No prompt/response history persistence.
- No fallback executor when NX Agent is unavailable.
- Existing placement, docking, tray, Store packaging, telemetry, Cloudee fallback, and reduced-motion behavior must remain intact.
- The production NX Agent action route is an external dependency. Until it exists, native runtime must surface `unavailable`; tests may use an injected local fixture endpoint.
- Cloudee remains the visual anchor. Interaction UI grows/contracts around the avatar rather than swapping to a conventional panel.

## Review Focus

1. **Attention session changes while a draft exists:** the draft must never be silently sent to a different session; controller tests in Task 1 pin the original routing context.
2. **NX Agent offline/rejected/malformed response:** draft remains available and Retry does not fall back to shell or RunOptic; Rust and controller tests in Tasks 2 and 3 cover this.
3. **Keyboard semantics in a multiline composer:** Enter submits, Shift+Enter inserts a newline, Escape closes only when permitted; component tests in Task 4 cover this.
4. **Docked side layouts:** composing/attention UI must remain usable in vertical orientation and not detach visually from Cloudee; DynamicIsland tests in Task 4 cover right-edge and top-edge layouts.
5. **Native focus/click-through restoration:** interactive mode turns on while composing and returns to passive behavior after collapse; NimbiApp tests and existing Rust runtime tests in Task 5 cover the transition.

---

### Task 1: Define the action contract and pure interaction controller

**Files:**
- Create: `src/actions/contract.ts`
- Create: `src/actions/action-controller.ts`
- Create: `src/actions/action-controller.test.ts`

**Interfaces:**
- Consumes: `NimbiSnapshot` from `src/telemetry/contract.ts`.
- Produces:
  - `NimbiActionRequest`
  - `NimbiActionResult`
  - `ActionUiState`
  - `ActionRouteContext`
  - `routeAction(snapshot: NimbiSnapshot, text: string): RouteActionResult`
  - `ActionController` methods for compose, updateDraft, submitStarted, submitSucceeded, submitFailed, retryContext, dismissResponse, and telemetryChanged.

- [ ] **Step 1: Write routing and state-machine tests**

Cover:
- idle + text → `{ type: "prompt", text }`;
- `needs-input + sessionId` → `{ type: "reply", sessionId, text }`;
- `needs-input` without sessionId → prompt only when the user explicitly opened general compose, never fabricated reply;
- whitespace-only text is rejected;
- text over 8,000 characters is rejected;
- failure preserves draft;
- success may expose short response;
- changed `needs-input` session invalidates an old reply context until explicit resubmission;
- meaningful RunOptic work clears an ephemeral response;
- transport error outranks response state.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm run test:run -- src/actions/action-controller.test.ts`  
Expected: FAIL because the action contract/controller does not exist.

- [ ] **Step 3: Implement the minimal action contract and pure controller**

Keep the controller independent of React, Tauri, Cloudee, timers, and network transport. Store the reply target used at submission time so a later telemetry change cannot retarget an in-flight or retry action.

- [ ] **Step 4: Run the focused tests**

Run: `npm run test:run -- src/actions/action-controller.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/actions
git commit -m "feat: add Nimbi action controller"
```

### Task 2: Add the loopback-only NX Agent Rust client

**Files:**
- Create: `src-tauri/src/nx_agent.rs`
- Create: `src-tauri/src/nx_agent_tests.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/state.rs`

**Interfaces:**
- Consumes: serialized frontend `NimbiActionRequest`.
- Produces:
  - Rust `NimbiActionRequest` / `NimbiActionResult` serde types matching TypeScript.
  - `NxAgentClient::with_endpoint(base_url, action_path) -> Result<Self, ActionError>`.
  - `NxAgentClient::submit(&self, request: &NimbiActionRequest) -> Result<NimbiActionResult, ActionError>`.
  - `RuntimeState.nx_agent: NxAgentClient` or equivalent immutable native client state.
- Native configuration:
  - `NIMBI_NX_AGENT_BASE_URL` supplies the base URL.
  - `NIMBI_NX_AGENT_ACTION_PATH` supplies the internal action route.
  - If either production value is absent, default client state is `Unavailable`, not a guessed route.

- [ ] **Step 1: Write Rust tests for validation and transport**

Cover:
- accepts `http://127.0.0.1:PORT`, `http://localhost:PORT`, and `http://[::1]:PORT`;
- rejects public/private LAN/non-loopback hosts and URLs containing userinfo;
- trims text and rejects empty text;
- rejects text above 8,000 characters;
- rejects reply with empty session id;
- 5,000 ms request timeout maps to typed `timeout`;
- connection failure maps to typed `unavailable`;
- non-2xx/rejected response maps to typed `rejected`;
- malformed JSON maps to typed `invalid-response`;
- valid fixture response deserializes `accepted`, optional `response`, and optional `sessionId`.

Use a tiny local Tokio TCP fixture server; do not add a production mock dependency.

- [ ] **Step 2: Run Rust tests and verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml nx_agent`  
Expected: FAIL because the module/client does not exist.

- [ ] **Step 3: Implement the native client and typed errors**

Reuse the loopback validation style from `src-tauri/src/runoptic.rs` but keep action transport in its own module. Build reqwest with a 5,000 ms request timeout. Do not infer or hard-code a production NX Agent route.

- [ ] **Step 4: Run Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml nx_agent`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/nx_agent.rs src-tauri/src/nx_agent_tests.rs src-tauri/src/lib.rs src-tauri/src/state.rs
git commit -m "feat: add loopback NX Agent client"
```

### Task 3: Expose one Tauri action command and frontend action client

**Files:**
- Create: `src/actions/client.ts`
- Create: `src/actions/client.test.ts`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/nx_agent.rs`

**Interfaces:**
- Consumes: `NimbiActionRequest` from Task 1 and `NxAgentClient` from Task 2.
- Produces:
  - Tauri command `submit_nimbi_action(request: NimbiActionRequest, state: State<RuntimeState>) -> Result<NimbiActionResult, ActionErrorPayload>`.
  - Frontend `submitNimbiAction(request: NimbiActionRequest): Promise<NimbiActionResult>`.

- [ ] **Step 1: Write frontend client tests**

Mock `@tauri-apps/api/core` and assert:
- exactly one invoke command is used: `submit_nimbi_action`;
- request payload shape is preserved;
- typed native errors become frontend `NimbiActionClientError`;
- no direct `fetch` is used by the action client.

- [ ] **Step 2: Add Rust command-level tests**

Test validation before transport and serialization of typed errors. Missing/unconfigured NX Agent endpoint must return `unavailable`.

- [ ] **Step 3: Run focused tests and verify failure**

Run:
- `npm run test:run -- src/actions/client.test.ts`
- `cargo test --manifest-path src-tauri/Cargo.toml nx_agent`

Expected: FAIL until command/client wiring exists.

- [ ] **Step 4: Implement the Tauri bridge**

Register `submit_nimbi_action` in `tauri::generate_handler!`. Keep URL/path native-only; React passes only the action request.

- [ ] **Step 5: Run focused tests**

Run:
- `npm run test:run -- src/actions/client.test.ts`
- `cargo test --manifest-path src-tauri/Cargo.toml nx_agent`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/actions/client.ts src/actions/client.test.ts src-tauri/src/lib.rs src-tauri/src/nx_agent.rs
git commit -m "feat: bridge Nimbi actions through Tauri"
```

### Task 4: Build the Cloudee-anchored composer and action presentation

**Files:**
- Create: `src/actions/use-nimbi-actions.ts`
- Create: `src/actions/use-nimbi-actions.test.tsx`
- Modify: `src/island/DynamicIsland.tsx`
- Modify: `src/island/DynamicIsland.test.tsx`
- Modify: `src/island/island.css`
- Modify: `src/behavior/use-nimbi-behavior.ts`
- Modify: `src/behavior/nimbi-behavior-controller.ts`
- Modify: relevant behavior tests already colocated with those modules.

**Interfaces:**
- Consumes: controller/contract from Task 1 and `submitNimbiAction` from Task 3.
- Produces:
  - `useNimbiActions({ snapshot, enabled, submit? })` returning presentation state and handlers.
  - New `DynamicIsland` props for action state/handlers without importing Tauri into the component.
  - Behavior mapping: composing → listening; sending → thinking; success → short complete/tap reaction; action error → error/attention.

- [ ] **Step 1: Write hook tests**

Cover:
- opening compose initializes an empty draft;
- submit selects prompt vs contextual reply correctly;
- sending state prevents duplicate submit;
- failure preserves draft and exposes retry;
- retry keeps the original reply context unless telemetry invalidated it;
- new real `needs-input` outranks short response;
- general prompt remains available when RunOptic is offline.

- [ ] **Step 2: Write DynamicIsland interaction tests**

Add tests for:
- idle click reveals `Ask Nimbi…` composer anchored to Cloudee;
- `needs-input` renders agent/summary and reply field;
- Enter submits;
- Shift+Enter does not submit and keeps newline;
- Escape collapses idle compose;
- sending disables duplicate submit and presents compact progress;
- response renders as ephemeral companion copy, not message history;
- error renders Retry and keeps draft;
- top-docked and right-docked composing/attention layouts remain in horizontal/vertical orientation respectively;
- reduced motion exposes the same semantic content without delayed decorative transitions;
- Cloudee remains mounted through idle → composing → sending → response transitions.

- [ ] **Step 3: Run focused frontend tests and verify failure**

Run:
```bash
npm run test:run -- src/actions/use-nimbi-actions.test.tsx src/island/DynamicIsland.test.tsx
```
Expected: FAIL until hook/UI changes exist.

- [ ] **Step 4: Implement the hook and semantic UI**

Keep the composer compact:
- one multiline input;
- no history list;
- no markdown renderer;
- Retry only on actionable error;
- contextual label derived from current snapshot;
- action copy extends from the avatar rather than centering a detached card.

Do not add a new character runtime. Reuse current Cloudee behavior primitives.

- [ ] **Step 5: Implement motion/layout CSS**

Extend current island variables for composing/sending/response/error states. Preserve edge-specific geometry and vertical side docking. Use existing spring/easing language, subtle blur/glow, and reduced-motion selectors; avoid abrupt panel replacement.

- [ ] **Step 6: Run focused tests**

Run:
```bash
npm run test:run -- src/actions/use-nimbi-actions.test.tsx src/island/DynamicIsland.test.tsx
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/actions/use-nimbi-actions.ts src/actions/use-nimbi-actions.test.tsx src/island src/behavior
git commit -m "feat: add ambient Nimbi action composer"
```

### Task 5: Integrate action state into NimbiApp and native focus lifecycle

**Files:**
- Modify: `src/app/NimbiApp.tsx`
- Modify: `src/app/NimbiApp.test.tsx`
- Modify: `src/island/island-machine.ts`
- Modify: `src/island/island-machine.test.ts`
- Modify: `src-tauri/src/lib.rs` only if focus/click-through behavior needs a narrow correction.

**Interfaces:**
- Consumes: `useNimbiActions` from Task 4 and existing `IslandMachine`.
- Produces:
  - app-level decision for when action interaction forces expanded/interacting state;
  - native `set_interactive(true)` while composing/sending/error-retry requires keyboard/pointer interaction;
  - restoration to passive click-through after collapse.

- [ ] **Step 1: Write NimbiApp lifecycle tests**

Mock native invoke/listen as needed and assert:
- idle compose makes native shell interactive;
- closing composer restores passive interactivity;
- `needs-input` opens attention presentation without losing session context;
- action response does not override a newer real attention state;
- placement callbacks and drag handlers remain wired.

- [ ] **Step 2: Extend island-machine tests only for state transitions it actually owns**

Do not move action transport state into `IslandMachine`. Add only the minimum transitions needed to keep composing visible and to collapse after dismissal without breaking hidden/compact/attention behavior.

- [ ] **Step 3: Run focused tests and verify failure**

Run:
```bash
npm run test:run -- src/app/NimbiApp.test.tsx src/island/island-machine.test.ts
```
Expected: FAIL until app integration exists.

- [ ] **Step 4: Wire `useNimbiActions` into `NimbiApp`**

Native runtime uses `submitNimbiAction`. Browser/fixture preview injects a deterministic fixture submitter so interaction can be developed without a production NX Agent endpoint.

- [ ] **Step 5: Restore native focus/click-through correctly**

Reuse existing `set_interactive` command. Do not introduce a second window. Confirm dragging still starts only from Cloudee and that composing does not mutate placement.

- [ ] **Step 6: Run focused tests**

Run:
```bash
npm run test:run -- src/app/NimbiApp.test.tsx src/island/island-machine.test.ts
cargo test --manifest-path src-tauri/Cargo.toml runtime_tests
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app src/island/island-machine.ts src/island/island-machine.test.ts src-tauri/src/lib.rs
git commit -m "feat: integrate Nimbi attention actions"
```

### Task 6: Add browser preview fixtures and run full regression

**Files:**
- Modify: existing dev preview entry/components that render `/dev/island-preview.html`.
- Modify: `src/telemetry/fixtures.ts` only if additional action-focused fixture data is necessary.
- Modify: `README.md` or `docs/` only to document the NX Agent environment variables and unavailable behavior.
- Do not change Store manifest identity/version in this task.

**Interfaces:**
- Consumes: completed action flow.
- Produces: deterministic preview controls for idle compose, needs-input, sending, response, error, top dock, side dock, and reduced motion.

- [ ] **Step 1: Add preview coverage**

Make the browser preview able to demonstrate the full visual sequence without Tauri or the real NX Agent:
- idle → compose → sending → response;
- needs-input → reply;
- transport error → retry;
- horizontal and vertical docking;
- reduced motion.

The fixture submitter must be clearly dev-only and never imported by native production wiring.

- [ ] **Step 2: Run the complete frontend suite**

Run:
```bash
npm run test:run
npm run build
```
Expected: PASS.

- [ ] **Step 3: Run the complete Rust suite and lint-quality gate**

Run:
```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```
Expected: PASS with no warnings.

- [ ] **Step 4: Verify Store/native regression constraints**

Confirm:
- `src-tauri/store/AppxManifest.template.xml` is unchanged unless technically required;
- tray commands remain Show / Hide / Quit;
- Store packaging workflow still references the current package identity;
- no provider keys, prompts, responses, or action history are written to preferences.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "test: complete attention actions v1 regression"
```

### Task 7: Windows CI validation and pull request

**Files:**
- No product changes expected unless CI finds a platform-specific defect.
- Reuse existing Windows and Store workflows.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a reviewable PR stacked on the current Store/lifecycle work with green Windows validation.

- [ ] **Step 1: Push `feat/attention-actions-v1` and let existing CI run**

Required checks:
- TypeScript/Vite build;
- Vitest;
- Rust tests;
- Clippy;
- native Windows build.

- [ ] **Step 2: Fix only defects revealed by CI, with focused regression tests**

Do not broaden scope into NX Agent implementation, voice, attachments, history, or permission UI.

- [ ] **Step 3: Open a draft pull request**

Target the branch that currently owns the stacked Store/lifecycle changes unless those PRs have been merged before execution. Summarize:
- contextual prompt/reply routing;
- loopback-only native action client;
- current external NX Agent endpoint dependency;
- Cloudee-anchored composer;
- failure/retry and draft preservation;
- regression status.

- [ ] **Step 4: Do not merge automatically**

Wait for manual validation of the browser preview and Windows CI artifact before merge.
