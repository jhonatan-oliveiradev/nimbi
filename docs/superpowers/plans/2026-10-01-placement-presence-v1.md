# Nimbi Placement & Presence v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Nimbi draggable, dockable, orientation-adaptive and opacity-configurable while preserving the existing RunOptic-driven companion behavior.

**Architecture:** Add a shared placement geometry domain in TypeScript for browser/UI decisions and a matching Rust placement domain for authoritative Windows monitor/work-area positioning and persistence. React owns drag intent and reflow; Rust owns native window position, monitor selection, clamping and persisted preferences.

**Tech Stack:** React 19, TypeScript, Motion, Vite, Tauri 2, Rust, Windows monitor APIs, serde, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-placement-presence-v1.md`

## Global Constraints

- Dock threshold: 56 logical px.
- Persist normalized coordinates, never raw desktop pixels.
- Passive opacity range: 0.20..1.00; default 0.72.
- needs-input opacity is always 1.00.
- hover/drag opacity is always 1.00.
- top/bottom are horizontal; left/right are vertical.
- floating expansion chooses available safe area.
- browser preview and native app share placement logic.
- no new provider/credential access.
- Windows Application Control remains enabled.

## Review Focus

- Corrupt or future-version preferences must restore safe defaults without crashing — Task 4.
- Dragging across monitors with different DPI must preserve pointer alignment and normalized placement — Task 5.
- Edge/corner snapping must be deterministic and never restore part of Nimbi offscreen — Tasks 1 and 5.
- Attention/error states must keep semantic minimum opacity even when passive opacity is low — Task 2.
- Existing click-through must still work after native window movement and orientation changes — Task 5.

---

### Task 1: Placement geometry domain

**Files:**
- Create: `src/placement/placement.ts`
- Create: `src/placement/placement.test.ts`

**Interfaces:**
- Produces `DockEdge`, `NimbiPlacement`, `NimbiOrientation`, `ExpansionDirection`, `WorkArea`, `Point`.
- Produces:
  - `orientationForPlacement(placement): NimbiOrientation`
  - `snapPlacement(point, area, previous?, threshold=56): NimbiPlacement`
  - `clampPlacement(placement, area, surfaceSize): NimbiPlacement`
  - `expansionDirection(placement, area, surfaceRect): ExpansionDirection`

- [ ] Write failing tests for four edges, corner tie-breaks, floating release, normalization/clamping and floating expansion.
- [ ] Run `npm run test:run -- src/placement/placement.test.ts` and confirm RED.
- [ ] Implement the pure placement functions.
- [ ] Re-run and confirm PASS.
- [ ] Commit `feat: add adaptive Nimbi placement geometry`.

---

### Task 2: Presence opacity policy

**Files:**
- Create: `src/presence/presence.ts`
- Create: `src/presence/presence.test.ts`
- Modify: `src/nimbi/NimbiCloud.tsx`
- Modify: `src/nimbi/nimbi.css`

**Interfaces:**
- Produces `effectiveOpacity(activity, passiveOpacity, interaction): number`.

- [ ] Test clamp 0.2..1.0 and every semantic minimum from the spec.
- [ ] Test hover/drag = 1.0 and needs-input = 1.0.
- [ ] Implement policy and apply it to character only, not content shell.
- [ ] Verify reduced-motion semantics remain intact.
- [ ] Commit `feat: add adaptive Nimbi presence opacity`.

---

### Task 3: Dragging and orientation-aware island layout

**Files:**
- Create: `src/placement/use-nimbi-drag.ts`
- Create: `src/placement/use-nimbi-drag.test.tsx`
- Modify: `src/island/DynamicIsland.tsx`
- Modify: `src/island/island.css`
- Modify: `src/app/NimbiApp.tsx`

**Interfaces:**
- Hook produces drag state, pointer position and placement preview.
- `DynamicIsland` consumes `placement`, `orientation`, `expansionDirection`, `passiveOpacity`.

- [ ] Test click vs drag threshold, drag start from cloud only, edge preview and release result.
- [ ] Implement cloud drag behavior and compact drag morph.
- [ ] Add true vertical reflow for left/right; never rotate text.
- [ ] Make expanded/attention layouts respect expansion direction.
- [ ] Confirm existing state-machine tests remain green.
- [ ] Commit `feat: make Nimbi island draggable and adaptive`.

---

### Task 4: Preferences persistence

**Files:**
- Create: `src-tauri/src/preferences.rs`
- Create: `src-tauri/src/preferences_tests.rs`
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Rust `PreferencesV1 { placement, presence }`.
- Commands:
  - `get_preferences() -> PreferencesV1`
  - `save_placement(placement)`
  - `save_presence(presence)`
  - `reset_placement()`

- [ ] Test defaults, corrupt JSON, clamping, unknown fields and round-trip.
- [ ] Implement atomic AppData persistence.
- [ ] Load preferences before initial window placement.
- [ ] Emit preference changes to React.
- [ ] Commit `feat: persist Nimbi placement and presence`.

---

### Task 5: Placement-aware Windows shell

**Files:**
- Modify: `src-tauri/src/window.rs`
- Modify: `src-tauri/src/window_tests.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Add monitor work-area + stable monitor identity model.
- Commands:
  - `begin_drag()`
  - `move_drag(screen_x, screen_y)`
  - `commit_placement(placement)`
  - `cancel_drag()`
  - `reposition_from_preferences()`

- [ ] Test top/bottom/left/right geometry, monitor fallback, normalized restore and DPI conversion.
- [ ] Test cross-monitor selection and offscreen clamping.
- [ ] Replace fixed top-center geometry with placement-aware geometry.
- [ ] Preserve `WS_EX_NOACTIVATE`, click-through and tool-window behavior while moving.
- [ ] Confirm hidden wake behavior is placement-aware.
- [ ] Commit `feat: move Nimbi shell across Windows work areas`.

---

### Task 6: Browser desktop preview and Presence controls

**Files:**
- Modify: `src/dev/PreviewApp.tsx`
- Modify: `src/island/island.css`
- Create: `src/placement/PlacementDebugOverlay.tsx`
- Add/modify tests under `src/dev` and `src/placement`.

**Interfaces:**
- Preview uses the same placement domain and drag hook.
- Expanded Nimbi gains a compact opacity slider + Reset position action.

- [ ] Add simulated work-area preview with all four edges and floating placement.
- [ ] Add edge snap hints only while dragging.
- [ ] Add opacity slider 20–100% and reset action.
- [ ] Preserve fixture shortcuts 1–7.
- [ ] Verify no preview-only layout implementation duplicates production geometry.
- [ ] Commit `dev: preview adaptive Nimbi placement`.

---

### Task 7: Regression and CI gate

**Files:**
- Modify: `.github/workflows/windows.yml`
- Modify: `docs/verification/foundation-checklist.md`
- Create: `docs/verification/placement-presence-checklist.md`

**Interfaces:** complete slice.

- [ ] Run full frontend suite and production build.
- [ ] Run Rust tests/clippy with lockfiles.
- [ ] Native Windows CI build must link and upload executable.
- [ ] Verify production npm audit remains clean.
- [ ] Checklist covers drag, all docks, floating, opacity, monitor fallback, reduced motion and click-through.
- [ ] Open PR from `feat/placement-presence-v1` only after all gates pass.
