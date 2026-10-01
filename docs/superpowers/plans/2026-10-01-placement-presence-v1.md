# Nimbi Placement & Presence v1 — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-10-01-placement-presence-v1.md`

## 1. Pure placement model
- Add `src/placement/placement.ts` and unit tests.
- Normalize/clamp placement and presence values.
- Derive orientation and expansion direction.
- Derive dock candidate from pointer + viewport.
- Derive preview/native host rectangle from normalized placement.

## 2. Adaptive island presentation
- Pass placement/orientation/expansion/presence into `NimbiApp` and `DynamicIsland`.
- Add vertical layouts for right/left.
- Add bottom/left/right border-radius/attachment variants.
- Keep text upright and reflow content rather than rotating it.
- Add effective-presence calculation by activity/hover.

## 3. Browser drag laboratory
- Drag starts from the cloud only.
- Distance threshold prevents accidental click-vs-drag collisions.
- Show magnetic edge cues.
- Snap within threshold; otherwise persist floating normalized x/y.
- Add opacity slider and reset-to-top-center control.
- Persist preview preferences in localStorage.
- Keep 1–7 activity shortcuts.

## 4. Native preference model
- Add Rust placement/presence structs + validation.
- Persist to app config as local JSON.
- Expose get/set preference commands.
- No sensitive telemetry in preference storage.

## 5. Native adaptive geometry
- Replace top-only geometry with placement-aware host geometry.
- Support top/right/bottom/left/floating against monitor physical geometry and DPI.
- Clamp to work area and fallback safely when monitor identity is unavailable.
- Preserve click-through behavior.

## 6. Native drag bridge
- Permit Tauri `start_dragging` only.
- Start native drag from the cloud.
- Observe window move events.
- Debounce/end movement and ask Rust to resolve nearest dock/floating placement.
- Persist resolved placement and emit it back to React.

## 7. Verification
- Frontend placement/presence tests.
- Existing island/telemetry tests remain green.
- Rust geometry/persistence tests.
- Production npm audit.
- Clippy `-D warnings`.
- Native Windows CI compile/link.
- Browser visual pass for all four docks, floating, activity states and opacity range.
