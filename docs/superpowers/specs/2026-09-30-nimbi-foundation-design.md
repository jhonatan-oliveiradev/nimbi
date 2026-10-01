# Nimbi — Foundation Design Spec

**Date:** 2026-09-30  
**Status:** Proposed for implementation  
**Repository:** `jhonatan-oliveiradev/nimbi`  
**Primary platform:** Windows 11  
**Product role:** Ambient AI companion / interaction surface

## 1. Product thesis

Nimbi is a small ambient companion that lives at the top-center edge of the desktop.

It should feel closer to a MacBook Dynamic Island than to a dashboard, widget, or floating assistant window. Its personality comes from a minimal cloud character that subtly reacts to real system activity. The island expands only when useful and otherwise stays quiet.

Product separation:

```text
RunOptic = eyes / observability
NX Agent / JARVIS = brain / orchestration and actions
Nimbi = face + hands / ambient interaction
```

Nimbi does not duplicate provider collectors, read provider credentials, or infer telemetry that RunOptic does not know.

## 2. Design principles

### 2.1 Minimal, elegant, cute

Nimbi is not a sci-fi blob, glass sculpture, or full mascot.

The approved character is a small cloud:
- compact, soft silhouette;
- two tiny eyes;
- no mouth by default;
- no arms or legs in the base state;
- restrained lilac/blue shading;
- micro-expressions through eye shape, squash/stretch, tilt, and position;
- no constant attention-seeking animation.

The island itself stays nearly neutral:
- black / near-black shell;
- white primary text;
- muted gray secondary text;
- Nimbi carries most of the color;
- provider/system colors are small semantic accents only.

### 2.2 Nimbi and the island are one interaction

The cloud is the persistent character anchor. The rest of the interface behaves like a Dynamic Island growing around or beneath it.

Content should expand from the top-center anchor rather than appear as an unrelated modal.

Preferred motion order:
1. horizontal expansion;
2. content fade/slide;
3. vertical expansion only when required;
4. reverse in the opposite order when collapsing.

### 2.3 Present, not insistent

Idle motion should be barely perceptible.

Nimbi becomes expressive only when the system changes state, the pointer approaches, or the user intentionally interacts.

### 2.4 Real state, not simulated personality

Production behavior must be driven by actual telemetry or explicit interaction state.

Unknown stays unknown. Nimbi must not pretend an agent is working, waiting, successful, or errored without evidence.

## 3. MVP surface

The first vertical slice contains one top-edge Tauri window and no full dashboard.

### Collapsed / hidden

A tiny wake region remains at the top center. The visible cloud may fully retract when configured to hide while idle.

### Idle

A small black capsule with Nimbi centered inside it.

Target visual footprint: approximately 140–170 px wide and 34–42 px tall.

### Working / thinking

The capsule widens to show one concise line, for example:

```text
☁  Codex is working…
```

No large metrics, token counts, or dashboard treatment.

### Needs attention

The island expands into a compact action surface.

MVP attention data may be demonstrated by development fixtures until the command/attention channel is implemented. Production must not fabricate permission details from RunOptic telemetry.

### Complete / error

Show a short transient state, then collapse.

### Offline

Nimbi becomes visually muted. No warning toast by default. The user should only see an explicit message after opening the island or if a requested action requires RunOptic.

## 4. Two independent state machines

Do not overload one state enum with both visual shell and agent activity.

### 4.1 Shell state

```ts
type IslandMode =
  | "hidden"
  | "idle"
  | "compact"
  | "attention"
  | "expanded";
```

This controls geometry and interaction.

### 4.2 Semantic activity state

```ts
type NimbiActivity =
  | "offline"
  | "idle"
  | "thinking"
  | "working"
  | "needs-input"
  | "complete"
  | "error";
```

This controls the cloud pose, micro-motion, status copy, and semantic accent.

Keeping the two independent allows examples such as:
- compact + working;
- attention + needs-input;
- expanded + idle;
- hidden + offline.

## 5. Character system

### 5.1 Renderer

Use a custom SVG cloud rendered inside React.

Do not copy the Mochi character geometry, eye system, motion constants, expressions, sounds, or animation choreography.

Initial cloud construction:
- 3–4 rounded lobes;
- slightly flatter base;
- two small dark eyes;
- subtle internal highlight;
- optional soft outer glow at very low opacity;
- no mouth;
- no image assets required.

SVG is preferred for the MVP because it is:
- lightweight;
- easy to morph and scale;
- compatible with browser-only visual iteration;
- accessible to reduced-motion handling;
- easier to keep original than adapting a pre-existing mascot renderer.

### 5.2 Motion parameters

Nimbi should expose continuous visual parameters rather than only canned animations:

```ts
interface NimbiMotion {
  energy: number;
  focus: number;
  urgency: number;
  stretchX: number;
  stretchY: number;
  tilt: number;
  gazeX: number;
  gazeY: number;
  opacity: number;
}
```

Semantic states map to parameter targets. Transitions interpolate smoothly.

Examples:
- idle: low energy, neutral focus;
- thinking: moderate focus, subtle vertical float;
- working: slightly higher energy, small directional lean;
- needs-input: high focus, slight rise;
- complete: one brief squash/rebound;
- error: small drop and reduced energy;
- offline: low opacity, no continuous motion.

### 5.3 Pointer response

When visible, the eyes may follow the pointer within a tightly clamped range. The body may lean by 1–2 px toward the pointer.

Pointer response must stop when:
- reduced motion is enabled;
- the app is hidden;
- the page/document is not active;
- Nimbi is in a state where focus should remain fixed.

## 6. 000h usage

000h's Agent State is useful as a semantic and accessibility reference. Its documented states are `idle`, `thinking`, `working`, `needs-input`, `complete`, and `error`; it also explicitly supports reduced-motion behavior and recommends pausing continuous field motion when hidden/offscreen.

Nimbi will reuse that vocabulary where it matches our domain, but not the visual treatment.

Before copying any 000h component implementation into the repository, verify its current license. For the foundation slice, no 000h source-code dependency is required.

## 7. RunOptic integration

RunOptic is the source of truth for observation.

Current local endpoint:

```text
GET http://127.0.0.1:48666/v1/telemetry/state
```

Expected protocol:

```text
runoptic.telemetry.v1
```

### 7.1 Boundary

The React frontend does not fetch RunOptic directly.

```text
RunOptic loopback HTTP
        ↓
Rust RunOpticClient
        ↓
validate + normalize
        ↓
NimbiSnapshot
        ↓
Tauri event
        ↓
React state
        ↓
Island + cloud
```

Benefits:
- browser/WebView CORS is irrelevant;
- no provider-specific types leak into UI components;
- the localhost endpoint can be changed later without rewriting presentation;
- network errors remain on the Rust side;
- frontend remains testable with fixtures.

### 7.2 Polling

MVP polling:
- roughly 2 seconds while visible/active;
- slower while hidden or completely idle;
- immediate refresh when opening the island.

A future RunOptic push/SSE channel is allowed but is not required for MVP.

### 7.3 Nimbi snapshot

The Rust adapter should emit a minimal product-specific shape, not the full RunOptic payload.

```ts
interface NimbiSnapshot {
  connected: boolean;
  protocol?: "runoptic.telemetry.v1";
  activity: NimbiActivity;
  agent?: string;
  provider?: string;
  model?: string;
  project?: string;
  environment?: string;
  summary?: string;
  observedAt?: number;
}
```

Fields remain optional when RunOptic has no evidence.

### 7.4 Initial derivation rules

Use explicit normalized evidence only.

- RunOptic unreachable → `offline`.
- Working agent session → `working`.
- Idle session with no active work → `idle`.
- Explicit attention/error evidence → `needs-input` or `error` as appropriate.
- Completion should be a transient reaction triggered by a real state transition/event, not by a timer pretending work completed.
- Provider/model/project labels are shown only when present.

The exact mapping will be covered by unit tests before UI integration.

## 8. Windows/Tauri shell

Use Tauri 2 with a transparent, frameless, always-on-top WebView2 window.

The island should:
- sit at the top center of the selected monitor;
- stay out of Alt-Tab;
- avoid taking focus during passive use;
- capture pointer events only where the island is visible;
- become focusable only when an actual text/control interaction needs it;
- reposition if monitor topology or DPI changes;
- support primary-monitor first, with cursor-monitor support deferred if needed.

### Geometry strategy

Reuse the proven architectural pattern from Coucou Windows:
- full transparent panel while the island is visible;
- tiny top-center wake strip while fully hidden;
- DOM animation occurs inside the stable full panel instead of resizing the native window every animation frame.

Suggested logical bounds:
- full transparent host: ~640 × 300 px;
- hidden wake strip: ~220 × 6 px.

These are starting values, not visual requirements.

## 9. Coucou reuse strategy

Coucou is an architectural reference and a permitted MIT code source, but Nimbi remains an independent product.

### 9.1 Patterns worth adapting

From Coucou Windows:
- top-center transparent Tauri window;
- `WS_EX_NOACTIVATE` / tool-window behavior;
- monitor/DPI-aware geometry;
- wake-strip optimization;
- cursor polling while visible and parking the poller while hidden;
- click-through outside the actual island shape;
- browser-only development preview;
- explicit finite-state machine for hidden/compact/expanded behavior;
- fail-open command/approval handshake concept for future action flows;
- future named-pipe local IPC pattern where appropriate.

### 9.2 Do not reuse

Do not copy or adapt:
- Coucou/Mochi names;
- Mochi body design;
- Mochi eye/expression system as a character;
- Mochi animation timings/choreography;
- app/tray icons;
- sounds;
- media, screenshots, GIFs, videos, or design assets;
- visual branding.

### 9.3 Licensing

Coucou source code is MIT. Its separate asset license reserves the Coucou/Mochi brand, character, animations as a character, icons, sounds, and media.

Nimbi's repository is currently public, so "personal use" does not remove the need to respect those terms.

If substantial Coucou source code is copied or closely adapted, Nimbi must preserve the applicable MIT copyright/license notice. The implementation phase should add a `THIRD_PARTY_NOTICES.md` (or equivalent) identifying Coucou-derived code.

Where practical, prefer adapting the architectural idea in original Nimbi code rather than copying large files wholesale.

## 10. Frontend stack

Foundation stack:

```text
Tauri 2
Rust
React
TypeScript
Vite
Motion
SVG
CSS custom properties
```

Why React:
- 000h is React-friendly;
- component/state boundaries are clearer for future chat, attention, file, and command surfaces;
- test fixtures can drive the island without Tauri;
- still lightweight at Nimbi's scale.

Do not add a general-purpose component library in the first slice.

## 11. Proposed project structure

```text
nimbi/
├─ docs/
│  └─ superpowers/specs/
├─ src/
│  ├─ app/
│  │  └─ NimbiApp.tsx
│  ├─ island/
│  │  ├─ DynamicIsland.tsx
│  │  ├─ island-machine.ts
│  │  └─ island.css
│  ├─ nimbi/
│  │  ├─ NimbiCloud.tsx
│  │  ├─ nimbi-motion.ts
│  │  └─ nimbi.css
│  ├─ telemetry/
│  │  ├─ contract.ts
│  │  ├─ derive-nimbi-state.ts
│  │  └─ fixtures.ts
│  └─ main.tsx
├─ src-tauri/
│  └─ src/
│     ├─ runoptic.rs
│     ├─ window.rs
│     ├─ state.rs
│     └─ main.rs
└─ dev/
   └─ island-preview.html
```

Exact file names may change during implementation, but the module boundaries should remain.

## 12. Development workflow

Because unsigned local executables may be blocked by Windows Application Control, visual development must not depend on launching a newly built `.exe` for every iteration.

Provide a browser-only fixture mode that can render:
- hidden;
- idle;
- thinking;
- working;
- needs-input;
- complete;
- error;
- offline.

The browser harness must use the same React/SVG components as the Tauri app, not a separate visual mock.

Native integration is verified in CI/package checks and in a signed/allowed runtime when available.

## 13. Security boundary

Nimbi is not an orchestrator and is not a credential store.

MVP:
- reads normalized RunOptic telemetry only over loopback;
- no provider API keys;
- no prompt/response body storage;
- no direct Claude/Codex collectors;
- no shell execution from the frontend;
- no action channel yet.

Future action/approval flow:
- JARVIS/NX Agent owns execution;
- capability-scoped requests;
- default-deny;
- explicit user action for side effects unless already covered by a trusted policy;
- opaque request IDs;
- authenticated loopback or local IPC;
- fail open for the underlying agent: Nimbi being closed/crashed must never deadlock agent execution.

## 14. First vertical slice

The first implementation milestone is intentionally narrow.

It is complete when:

1. Nimbi launches as a top-center transparent Tauri window on Windows.
2. The cloud character is recognizably Nimbi: minimal, original, cute, and not Mochi-derived.
3. Idle island is visually close to a restrained Dynamic Island.
4. Browser fixture mode can switch every semantic state.
5. Rust polls RunOptic's normalized state endpoint.
6. RunOptic offline/online transitions update Nimbi without restarting.
7. A real active agent session drives `working`.
8. Known provider/model/project information can appear in compact copy without exposing unknown values as zero/default.
9. Complete/error state transitions produce one short character reaction.
10. The window is click-through outside the visible island.
11. The island does not steal focus in passive mode.
12. Reduced-motion mode removes continuous motion while preserving semantic state.
13. No Coucou protected assets are present in the repository.
14. Tests cover state derivation and shell-state transitions.

## 15. Explicitly deferred

Not part of the first vertical slice:
- built-in chat;
- file drop;
- approval/deny execution;
- direct Claude Code hooks;
- direct provider credentials;
- GitHub/Vercel/Notion integrations;
- sounds;
- settings UI beyond what is required to run;
- updater/installer/signing;
- multi-monitor preference UI;
- NX Alive integration;
- WebGL shader rendering;
- RunOptic history/trend UI.

These can be added after the core character + island + real telemetry loop feels correct.

## 16. Success criterion

The first build succeeds if Nimbi feels like a native, living extension of system activity rather than an app window with a mascot attached.

A user should be able to leave it running during normal development and understand, at a glance, whether an agent is quiet, thinking, working, needs attention, completed, errored, or disconnected—without leaving the current task.
