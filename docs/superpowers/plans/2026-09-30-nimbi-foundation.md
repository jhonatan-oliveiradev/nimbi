# Nimbi Foundation Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Windows Nimbi vertical slice: an original cloud companion in a Dynamic-Island-style top-edge shell that reflects real `runoptic.telemetry.v1` state without duplicating provider collection.

**Architecture:** React renders the cloud and island from a small product-specific `NimbiSnapshot`; Rust owns RunOptic loopback I/O and the Windows window/click-through behavior. A browser-only fixture entry uses the exact same React components, so visual iteration does not depend on running an unsigned executable.

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript 5.6+, Vite 6, Motion, SVG, CSS custom properties, Vitest, Testing Library, npm.

**Spec:** `docs/superpowers/specs/2026-09-30-nimbi-foundation-design.md`

## Global Constraints

- Primary platform is Windows 11.
- Use npm, not pnpm.
- RunOptic is the only observation source for the MVP; use `GET http://127.0.0.1:48666/v1/telemetry/state`.
- Accept only protocol `runoptic.telemetry.v1` as connected production telemetry.
- No direct Claude/Codex collectors, provider API keys, prompt/response persistence, shell execution from the frontend, or action channel in this slice.
- Nimbi is an original minimal cloud character: 3–4 soft lobes, two tiny eyes, no mouth/arms/legs by default.
- Do not copy Coucou/Mochi character geometry, expressions, animation choreography, icons, sounds, or media.
- If Coucou source is copied or closely adapted, preserve its MIT notice in `THIRD_PARTY_NOTICES.md`.
- No general-purpose component library.
- Unknown telemetry remains absent; never convert missing provider/model/project/token data into fake defaults.
- Continuous motion must stop under `prefers-reduced-motion: reduce`.
- Browser fixture mode must render the same components used by the Tauri application.

## Review Focus

- RunOptic is unreachable or returns a non-`runoptic.telemetry.v1` payload → Nimbi must become `offline` without crashing or leaking stale labels; covered in Task 6.
- Multiple simultaneous sessions with different states/providers → deterministic priority must select attention > error > working/thinking > idle without inventing attribution; covered in Task 2.
- The pointer is outside the visible island but inside the transparent Tauri host → clicks must pass through to the desktop/app underneath; covered in Task 7.
- Windows DPI/monitor geometry changes after launch → the island must remain centered at the top of the active primary monitor; covered in Task 7.
- Reduced-motion or hidden document state → continuous cloud motion/pointer following must stop while semantic state remains readable; covered in Task 4.

---

### Task 1: Scaffold the Nimbi app and test harness

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/NimbiApp.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `src/test/setup.ts`
- Create: `src/app/NimbiApp.test.tsx`
- Create: `.gitignore`

**Interfaces:**
- Consumes: none.
- Produces: `NimbiApp(): JSX.Element`; npm scripts `dev`, `build`, `test`, `test:run`, `tauri`, `tauri:dev`, `tauri:build`.

- [ ] **Step 1: Write the failing app smoke test**

Create `src/app/NimbiApp.test.tsx` asserting that rendering `<NimbiApp />` produces an element with `data-testid="nimbi-island"` and accessible name `Nimbi`.

- [ ] **Step 2: Run the test and confirm the harness is not yet available**

Run: `npm test -- --run src/app/NimbiApp.test.tsx`  
Expected: FAIL because the project/test configuration and component do not yet exist.

- [ ] **Step 3: Scaffold React/Vite/Vitest with the minimal app**

Use React 19 + ReactDOM, Motion, Vite, TypeScript, Vitest, jsdom, `@testing-library/react`, and `@testing-library/jest-dom`. Configure `src/test/setup.ts` as the Vitest setup file.

`NimbiApp` should initially render only the semantic shell:

```tsx
<main data-testid="nimbi-island" aria-label="Nimbi" />
```

Set global page transparency and the initial token set:

```css
--nimbi-shell: #050507;
--nimbi-surface: #111116;
--nimbi-text: #ffffff;
--nimbi-muted: #9b9ba7;
--nimbi-lilac: #b9a8ff;
--nimbi-blue: #9fc7ff;
```

- [ ] **Step 4: Run frontend verification**

Run: `npm run test:run && npm run build`  
Expected: all tests PASS and Vite production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src .gitignore
git commit -m "chore: scaffold Nimbi frontend"
```

---

### Task 2: Define telemetry contracts and deterministic state derivation

**Files:**
- Create: `src/telemetry/contract.ts`
- Create: `src/telemetry/derive-nimbi-state.ts`
- Create: `src/telemetry/derive-nimbi-state.test.ts`
- Create: `src/telemetry/fixtures.ts`

**Interfaces:**
- Consumes: RunOptic field names from `runoptic.telemetry.v1`.
- Produces:
  - `type NimbiActivity = "offline" | "idle" | "thinking" | "working" | "needs-input" | "complete" | "error"`
  - `interface NimbiSnapshot`
  - `interface RunOpticTelemetrySnapshot`
  - `deriveNimbiSnapshot(current: RunOpticTelemetrySnapshot | null, previous?: NimbiSnapshot): NimbiSnapshot`

- [ ] **Step 1: Write state-derivation tests**

Cover these exact cases in `derive-nimbi-state.test.ts`:

1. `null` input → `connected=false`, `activity="offline"`.
2. wrong protocol → `connected=false`, `activity="offline"`.
3. valid snapshot with no sessions → `connected=true`, `activity="idle"`.
4. a `waiting` session with non-empty `attention_reason` → `needs-input`, and only known provider/model/project fields are copied.
5. any activity observation with non-empty `error` newer than competing observations → `error`.
6. a `working` session whose latest activity is `query_started` → `thinking`.
7. a `working` session whose latest activity is `tool_completed` or has no newer `query_started` → `working`.
8. previous snapshot is `working` and the same session is now `done` → transient `complete`.
9. two sessions compete: waiting-with-attention wins over error, error wins over working/thinking, and the selected labels come from the winning session only.
10. absent provider/model/project stay `undefined`.

- [ ] **Step 2: Run the tests to verify failure**

Run: `npm run test:run -- src/telemetry/derive-nimbi-state.test.ts`  
Expected: FAIL because the contract/deriver do not exist.

- [ ] **Step 3: Implement the contracts**

In `contract.ts`, model only the RunOptic fields Nimbi actually reads:
- snapshot: `protocol`, `sessions`, `activity`, `updated_at_ms`;
- session: `session_id`, `agent`, optional provider/project/model, `state`, optional `state_since_ms`, optional `attention_reason`, provenance observed time;
- activity: `id`, `kind`, `session_id`, agent/environment, optional project/provider/model/error, provenance observed time.

Do not copy usage/performance shapes into the frontend contract.

- [ ] **Step 4: Implement `deriveNimbiSnapshot`**

Use explicit priority:

```text
needs-input > error > working/thinking > complete transition > idle
```

For competing records at the same priority, select the newest `provenance.observed_at_ms`, then stable-sort by session ID for deterministic ties.

- [ ] **Step 5: Run derivation tests**

Run: `npm run test:run -- src/telemetry/derive-nimbi-state.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/telemetry
git commit -m "feat: derive Nimbi state from RunOptic telemetry"
```

---

### Task 3: Build the island shell state machine

**Files:**
- Create: `src/island/island-machine.ts`
- Create: `src/island/island-machine.test.ts`

**Interfaces:**
- Consumes: `NimbiActivity` from Task 2.
- Produces:
  - `type IslandMode = "hidden" | "idle" | "compact" | "attention" | "expanded"`
  - `class IslandMachine`
  - methods `setActivity(activity: NimbiActivity): void`, `pointerEnter(): void`, `pointerLeave(): void`, `toggleExpanded(): void`, `forceHidden(): void`
  - callback `onTransition?: (from: IslandMode, to: IslandMode) => void`

- [ ] **Step 1: Write state-machine tests**

Pin these transitions:
- constructor starts at `idle`;
- `working` or `thinking` → `compact`;
- `needs-input` or `error` → `attention`;
- `complete` → `compact`;
- `offline` does not force an attention panel;
- clicking/toggling idle/compact → `expanded`;
- toggling expanded → previous passive mode;
- pointer enter from `hidden` → `idle`;
- pointer leave from `idle` schedules hidden only after 60 s;
- `attention` never auto-hides.

Use fake timers for the hide delay.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test:run -- src/island/island-machine.test.ts`  
Expected: FAIL because `IslandMachine` does not exist.

- [ ] **Step 3: Implement `IslandMachine`**

Keep the class DOM-free. Use one private hide timer and preserve the pre-expanded passive mode so closing `expanded` returns correctly.

- [ ] **Step 4: Run tests**

Run: `npm run test:run -- src/island/island-machine.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/island
git commit -m "feat: add Nimbi island state machine"
```

---

### Task 4: Create the original Nimbi cloud character and motion grammar

**Files:**
- Create: `src/nimbi/nimbi-motion.ts`
- Create: `src/nimbi/nimbi-motion.test.ts`
- Create: `src/nimbi/NimbiCloud.tsx`
- Create: `src/nimbi/NimbiCloud.test.tsx`
- Create: `src/nimbi/nimbi.css`

**Interfaces:**
- Consumes: `NimbiActivity`.
- Produces:
  - `interface NimbiMotion { energy; focus; urgency; stretchX; stretchY; tilt; gazeX; gazeY; opacity }`
  - `motionForActivity(activity: NimbiActivity): NimbiMotion`
  - `clampGaze(pointerX: number, pointerY: number, bounds: DOMRectLike): { x: number; y: number }`
  - `NimbiCloud({ activity, pointer, reducedMotion, hidden }: Props): JSX.Element`

- [ ] **Step 1: Write motion mapping tests**

Assert:
- every semantic state maps all nine motion values;
- `offline.opacity < idle.opacity`;
- `needs-input.focus > working.focus`;
- `complete` has a one-shot reaction marker exposed by the component, not a looping high-energy animation;
- `clampGaze` never exceeds ±1 normalized unit.

- [ ] **Step 2: Write component behavior tests**

Assert:
- component renders one original cloud SVG and exactly two eye elements;
- no mouth element exists in the base renderer;
- `reducedMotion=true` sets `data-motion="reduced"`;
- `hidden=true` disables pointer gaze;
- offline still renders a readable/inspectable semantic state via `data-activity="offline"`.

- [ ] **Step 3: Run tests and verify failure**

Run: `npm run test:run -- src/nimbi`  
Expected: FAIL because the character files do not exist.

- [ ] **Step 4: Implement motion grammar**

Keep all state targets in `nimbi-motion.ts`. Use values, not Coucou/Mochi constants. Continuous idle motion must be extremely low amplitude.

- [ ] **Step 5: Implement `NimbiCloud`**

Build the silhouette from original SVG paths/ellipses:
- 3–4 rounded lobes;
- flatter base;
- two small eyes;
- subtle lilac/blue highlight;
- no mouth/arms/legs.

Use Motion only for transform/opacity interpolation and one-shot complete/error reactions. Respect both the explicit `reducedMotion` prop and CSS `prefers-reduced-motion`.

- [ ] **Step 6: Verify**

Run: `npm run test:run -- src/nimbi && npm run build`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/nimbi
git commit -m "feat: add original Nimbi cloud character"
```

---

### Task 5: Build the Dynamic Island UI and browser fixture mode

**Files:**
- Create: `src/island/DynamicIsland.tsx`
- Create: `src/island/DynamicIsland.test.tsx`
- Create: `src/island/island.css`
- Modify: `src/app/NimbiApp.tsx`
- Create: `src/dev/PreviewApp.tsx`
- Create: `src/dev/preview.tsx`
- Create: `dev/island-preview.html`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: `NimbiSnapshot`, `IslandMode`, `NimbiCloud`.
- Produces:
  - `DynamicIsland({ snapshot, mode, onToggle }: Props): JSX.Element`
  - browser route/page `/dev/island-preview.html` with fixture controls for every semantic activity.

- [ ] **Step 1: Write island component tests**

Assert:
- idle renders only Nimbi and no dashboard metrics;
- compact working renders one concise agent/status line;
- provider/model/project labels render only when present;
- attention fixture renders a compact message/action surface but is marked `data-fixture-only="true"` so it cannot be mistaken for a live permission channel;
- offline is visually muted and does not auto-open an alert;
- shell exposes `data-mode` for hidden/idle/compact/attention/expanded.

- [ ] **Step 2: Run component tests and verify failure**

Run: `npm run test:run -- src/island/DynamicIsland.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Implement the island visual system**

Use near-black capsule surfaces and the Task 1 tokens. Expansion order is horizontal → content reveal → vertical. Reverse on close.

Do not add token counters, charts, cards, sidebars, or provider dashboards.

- [ ] **Step 4: Implement the shared browser preview**

`PreviewApp` owns fixture state and passes it to the same `NimbiApp` / `DynamicIsland` components as production. Provide buttons/keyboard shortcuts for:

`idle`, `thinking`, `working`, `needs-input`, `complete`, `error`, `offline`.

- [ ] **Step 5: Configure Vite multi-page input**

Ensure both `index.html` and `dev/island-preview.html` build with `npm run build`.

- [ ] **Step 6: Verify browser-mode build and tests**

Run: `npm run test:run && npm run build`  
Expected: PASS and both HTML entries emitted.

- [ ] **Step 7: Commit**

```bash
git add src/island src/app/NimbiApp.tsx src/dev dev/island-preview.html vite.config.ts
git commit -m "feat: build Nimbi dynamic island preview"
```

---

### Task 6: Add the Rust RunOptic client and normalized Nimbi snapshot

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/state.rs`
- Create: `src-tauri/src/runoptic.rs`
- Create: `src-tauri/src/runoptic_tests.rs`

**Interfaces:**
- Consumes: RunOptic `GET /v1/telemetry/state`.
- Produces Rust equivalents:
  - `enum NimbiActivity`
  - `struct NimbiSnapshot`
  - `struct RunOpticClient { client: reqwest::Client, base_url: String }`
  - `async fn RunOpticClient::fetch(&self, previous: Option<&NimbiSnapshot>) -> NimbiSnapshot`
  - `fn derive_snapshot(raw: &RunOpticTelemetrySnapshot, previous: Option<&NimbiSnapshot>) -> NimbiSnapshot`

- [ ] **Step 1: Write Rust tests against serialized fixtures**

Cover:
- unreachable transport → offline snapshot;
- wrong protocol → offline snapshot;
- no sessions → idle;
- waiting + attention reason → needs-input;
- latest explicit error → error;
- working + latest query-started → thinking;
- working + tool-completed → working;
- previous working + same session now done → complete;
- unknown provider/model/project serialize as omitted/null according to the frontend contract, never placeholder strings.

Use an injectable test base URL or local test server; do not hit a real RunOptic process in unit tests.

- [ ] **Step 2: Run Rust tests and verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`  
Expected: FAIL until the crate/client is implemented.

- [ ] **Step 3: Implement the minimal Tauri crate and RunOptic models**

Dependencies: Tauri 2, serde, serde_json, tokio, reqwest with rustls/json. Parse only the fields Nimbi needs.

Set the production URL default to `http://127.0.0.1:48666`. Allow `NIMBI_RUNOPTIC_BASE_URL` only for explicit development/testing overrides, and reject non-loopback HTTP URLs.

- [ ] **Step 4: Implement `RunOpticClient::fetch` and `derive_snapshot`**

Keep the Rust priority/order identical to Task 2. Add a contract fixture shared conceptually with the TypeScript tests; field names must serialize in camelCase to match `NimbiSnapshot`.

- [ ] **Step 5: Verify Rust**

Run: `cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri
git commit -m "feat: add RunOptic telemetry client"
```

---

### Task 7: Implement the Windows top-edge Tauri shell

**Files:**
- Create: `src-tauri/src/window.rs`
- Create: `src-tauri/src/window_tests.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Create: `THIRD_PARTY_NOTICES.md`

**Interfaces:**
- Consumes: Tauri `AppHandle`, visible-island bounds from React.
- Produces:
  - constants `PANEL_W=640.0`, `PANEL_H=300.0`, `STRIP_W=220.0`, `STRIP_H=6.0`;
  - `struct IslandRect { x, y, w, h }`;
  - `struct WindowGate`;
  - commands `set_collapsed(collapsed: bool)`, `set_island_rect(x, y, width, height)`, `set_interactive(interactive: bool)`, `reposition()`;
  - `spawn_cursor_poll(app, gate)`.

- [ ] **Step 1: Write pure geometry and hit-test tests**

Extract/test pure functions:
- `centered_top_geometry(monitor, collapsed)` centers panel/strip at monitor top across scale factors 1.0, 1.25, 1.5, 2.0;
- `hit_test(rect, pointer, margin)` accepts only visible island + 12 px entry margin;
- a pointer inside the transparent host but outside the island returns false.

- [ ] **Step 2: Run Rust tests and verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml window`  
Expected: FAIL.

- [ ] **Step 3: Implement Windows shell behavior**

Adapt the architectural approach proven in Coucou Windows, but keep Nimbi names and code organization:
- transparent frameless top-center host;
- always-on-top;
- `WS_EX_NOACTIVATE` and `WS_EX_TOOLWINDOW`;
- full panel while visible, wake strip while hidden;
- click-through outside `IslandRect`;
- 16 ms cursor polling only while visible;
- poll thread parked while hidden;
- monitor/DPI key checked periodically and geometry reapplied when it changes.

Do not copy Coucou comments/branding or protected assets.

- [ ] **Step 4: Add Coucou MIT attribution**

`THIRD_PARTY_NOTICES.md` must identify `Louis-CFM/coucou`, copyright Louis Raillé (2026), MIT license, and state that Nimbi adapts Windows shell architecture while not using Coucou/Mochi protected brand/assets.

- [ ] **Step 5: Verify Rust**

Run: `cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri THIRD_PARTY_NOTICES.md
git commit -m "feat: add Windows top-edge island shell"
```

---

### Task 8: Connect live telemetry, shell state, and React

**Files:**
- Create: `src/telemetry/use-nimbi-snapshot.ts`
- Create: `src/telemetry/use-nimbi-snapshot.test.tsx`
- Modify: `src/app/NimbiApp.tsx`
- Modify: `src/island/DynamicIsland.tsx`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/runoptic.rs`

**Interfaces:**
- Consumes: Rust `NimbiSnapshot`, `IslandMachine`.
- Produces:
  - Tauri event `nimbi://snapshot`;
  - Tauri command `get_nimbi_snapshot() -> NimbiSnapshot`;
  - Tauri command `set_visibility_hint(hidden: bool)`;
  - React hook `useNimbiSnapshot(): NimbiSnapshot`.

- [ ] **Step 1: Write hook/integration tests**

Mock Tauri invoke/listen and verify:
- initial state comes from `get_nimbi_snapshot`;
- subsequent `nimbi://snapshot` replaces it;
- offline clears stale agent/provider/model/project labels;
- moving working → complete reaches the component once;
- listener cleanup runs on unmount.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test:run -- src/telemetry/use-nimbi-snapshot.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Implement Rust polling loop**

Poll immediately at startup, then:
- ~2 s while visible or activity is non-idle;
- ~10 s while hidden and idle/offline.

On change, emit `nimbi://snapshot`. Do not emit unchanged snapshots every tick.

- [ ] **Step 4: Implement the React hook and wire `NimbiApp`**

`NimbiApp` should:
- use real Tauri telemetry when running in Tauri;
- accept an injected fixture snapshot from `PreviewApp`;
- feed semantic activity to `IslandMachine`;
- send the rendered island bounds to `set_island_rect`;
- send hidden/visible hints to Rust;
- never directly call the RunOptic HTTP endpoint.

- [ ] **Step 5: Verify all frontend and Rust tests**

Run:

```bash
npm run test:run
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src src-tauri
git commit -m "feat: connect Nimbi to live RunOptic state"
```

---

### Task 9: Add CI, developer workflow, and first-slice acceptance checks

**Files:**
- Create: `.github/workflows/windows.yml`
- Create: `README.md`
- Create: `docs/verification/foundation-checklist.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: complete first vertical slice.
- Produces: reproducible CI and explicit manual acceptance checklist.

- [ ] **Step 1: Add Windows CI**

On push/PR:
1. checkout;
2. setup Node 20;
3. setup stable Rust;
4. `npm ci`;
5. `npm run test:run`;
6. `npm run build`;
7. `cargo test --manifest-path src-tauri/Cargo.toml`;
8. `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`;
9. `npm run tauri build -- --debug` or the smallest Tauri build command that proves native linking without requiring installer signing.

- [ ] **Step 2: Document browser-first development**

README commands:

```powershell
npm ci
npm run dev
# open /dev/island-preview.html
```

and native integration:

```powershell
npm run tauri:dev
```

Document that Windows Application Control may block unsigned local binaries and that CI/native build evidence is authoritative when this happens; do not recommend disabling Smart App Control.

- [ ] **Step 3: Add the acceptance checklist**

`foundation-checklist.md` must include:
- original Nimbi cloud visible;
- idle capsule approximately 140–170 × 34–42 logical px;
- all seven semantic fixture states render;
- reduced motion stops continuous movement;
- RunOptic stopped → offline;
- RunOptic started without restarting Nimbi → connected;
- real active session → working/thinking;
- unknown labels remain absent;
- click-through outside visible island;
- passive island does not steal focus;
- monitor/DPI reposition;
- no protected Coucou assets;
- `THIRD_PARTY_NOTICES.md` present.

- [ ] **Step 4: Run the complete local verification suite**

Run:

```bash
npm ci
npm run test:run
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add .github README.md docs/verification package.json package-lock.json
git commit -m "ci: verify Nimbi Windows foundation"
```

---

## Final branch verification

Before opening the implementation PR:

- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] Run `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`.
- [ ] Confirm `dev/island-preview.html` uses production components, not duplicated markup.
- [ ] Confirm no source file imports or embeds Coucou/Mochi assets, sounds, icons, screenshots, GIFs, or media.
- [ ] Confirm no frontend code contacts provider APIs or RunOptic directly.
- [ ] Confirm the implementation PR includes the design spec, this plan, and `THIRD_PARTY_NOTICES.md`.
