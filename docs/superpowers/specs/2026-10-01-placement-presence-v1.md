# Nimbi Placement & Presence v1 — Design Spec

**Date:** 2026-10-01  
**Status:** Approved direction  
**Branch:** `feat/placement-presence-v1`

## Goal

Let Nimbi live where the user wants instead of being permanently fixed to the top center.

The placement system must feel physical and adaptive:
- drag Nimbi directly;
- detach into a compact floating form while moving;
- magnetically dock to top/right/bottom/left edges;
- adapt layout orientation to the edge;
- remain floating when released away from an edge;
- expand only toward available screen space;
- persist placement across restarts;
- expose configurable passive opacity without making important content unreadable.

## Product rule

Nimbi is not a freely resizable utility window.

The cloud is the draggable anchor. During relocation the island collapses toward the cloud, moves as a compact object, then grows into the orientation appropriate to the destination.

```text
island
  ↓
cloud
  ↓ drag
cloud
  ↓ snap / release
adaptive island
```

## Placement model

```ts
type DockEdge = "top" | "right" | "bottom" | "left";

type NimbiPlacement =
  | {
      mode: "docked";
      monitorId: string;
      edge: DockEdge;
      offset: number; // normalized 0..1 along that edge
    }
  | {
      mode: "floating";
      monitorId: string;
      x: number; // normalized 0..1
      y: number; // normalized 0..1
    };
```

Normalized coordinates are required so placement survives DPI, resolution and monitor-size changes.

If the saved monitor is unavailable, migrate Nimbi to the primary monitor using the nearest valid normalized placement.

## Orientation

```ts
type NimbiOrientation = "horizontal" | "vertical";
```

Rules:
- top → horizontal;
- bottom → horizontal;
- left → vertical;
- right → vertical;
- floating → adaptive from available space, but the compact floating form remains visually horizontal unless the available safe area makes vertical clearly preferable.

The UI must reflow, not rotate.

## Expansion direction

Nimbi never opens content beyond the screen bounds.

```ts
type ExpansionDirection = "down" | "up" | "left" | "right";
```

Default mapping:
- top dock → down;
- bottom dock → up;
- left dock → right;
- right dock → left;
- floating → direction with the largest available safe area.

Attention/action surfaces later must consume this same placement output rather than reinventing geometry.

## Drag interaction

Drag starts by pressing and moving the cloud character.

A small movement threshold distinguishes click from drag. No permanent drag handle.

During drag:
- island content collapses;
- cloud becomes the dominant object;
- cursor becomes grabbing;
- shell follows pointer;
- docking candidates near screen edges receive a restrained visual hint;
- crossing an edge threshold previews the resulting orientation.

On release:
- inside a docking threshold → magnetic dock;
- outside threshold → floating placement.

No uncontrolled spring overshoot. Motion should feel soft and deliberate.

## Dock snapping

Use edge zones derived from the current monitor work area, not hard-coded desktop pixels.

Initial logical threshold: **56 px** from an eligible edge.

Corner resolution:
- choose the edge with the shortest pointer-to-edge distance;
- exact ties prefer the previous dock edge if still valid;
- otherwise prefer horizontal edges (top/bottom) to keep the default island language stable.

Dock offset must be clamped so the full visible Nimbi surface remains inside the monitor work area.

## Floating mode

Floating Nimbi:
- may live anywhere inside the monitor safe area;
- persists normalized coordinates;
- clamps itself back onscreen after resolution/DPI changes;
- decides expansion direction from free space;
- never covers the Windows taskbar by restoring into the monitor work area rather than raw monitor bounds.

## Multi-monitor behavior

For v1:
- dragging may cross monitors;
- the monitor underneath the cloud becomes the active monitor;
- save a stable monitor identifier when available plus normalized placement;
- if that monitor disappears, restore onto primary;
- do not add a multi-monitor settings screen yet.

## Presence / opacity

Expose a passive presence value:

```ts
interface NimbiPresence {
  passiveOpacity: number; // clamped 0.2..1.0
}
```

Default: **0.72**.

This setting controls passive Nimbi presence, not critical content opacity.

Minimum semantic opacity policy:

```text
idle          configured value
thinking      max(configured, 0.55)
working       max(configured, 0.65)
complete      max(configured, 0.75)
needs-input   1.00
error         max(configured, 0.90)
hover/drag    1.00
```

When the pointer leaves, opacity returns smoothly over roughly 500–700 ms.

Character and content opacity are separate. Text/action surfaces remain fully legible.

## Persistence

Persist placement and presence locally on the Rust side.

Suggested path:
```text
%APPDATA%\nimbi\preferences.json
```

Schema:

```json
{
  "version": 1,
  "placement": {
    "mode": "docked",
    "monitorId": "primary",
    "edge": "top",
    "offset": 0.5
  },
  "presence": {
    "passiveOpacity": 0.72
  }
}
```

Requirements:
- atomic write;
- invalid/corrupt file → safe defaults;
- clamp invalid values;
- unknown future fields ignored;
- no telemetry or credentials stored here.

## Settings surface

Do not build a full Settings window.

For v1, the expanded Nimbi surface gains a tiny Presence control:
- opacity slider;
- reset placement action.

Dragging itself is the placement UI.

A later settings surface may expose more detail.

## Browser preview

The browser preview must emulate a desktop work area and support:
- dragging Nimbi;
- all four dock edges;
- floating placement;
- orientation reflow;
- expansion-direction visualization;
- opacity slider;
- reset placement;
- state fixtures 1–7.

It must use production placement/layout logic, not a separate mock implementation.

## Windows shell integration

The existing fixed top-center geometry is replaced by a placement-aware shell.

Rust owns:
- monitor/work-area discovery;
- native window position;
- placement persistence;
- DPI conversion;
- clamp/snap geometry.

React owns:
- drag intent;
- island visual morph;
- orientation layout;
- semantic content.

During drag, React emits pointer/placement intent and Rust moves the native window.

The transparent host should remain only as large as necessary for the current orientation/state. Avoid a permanent full-screen transparent window.

## Security and platform constraints

- no change to the RunOptic privacy boundary;
- no new provider credentials;
- no shell execution from React;
- preferences stay local;
- do not weaken Windows Application Control;
- browser preview remains the local visual-development path;
- Windows CI remains the authoritative native compilation gate until signing is solved.

## Acceptance criteria

1. Nimbi can be dragged by the cloud.
2. Top/bottom docks render horizontally.
3. Left/right docks render vertically without rotating text.
4. Releasing away from an edge leaves Nimbi floating.
5. Edge snapping feels magnetic and uses a 56 px logical threshold.
6. Floating Nimbi stays inside work area after resize/DPI changes.
7. Expansion always chooses an onscreen direction.
8. Placement survives restart.
9. Missing monitor restores safely on primary.
10. Passive opacity is configurable from 20% to 100%.
11. needs-input remains 100% visible regardless of passive opacity.
12. hover/drag temporarily raises Nimbi to 100% opacity.
13. content text never inherits reduced passive character opacity.
14. reduced-motion still preserves all placement functionality.
15. browser preview exercises the same placement/orientation logic.
16. existing RunOptic state behavior and click-through behavior do not regress.

## Deferred

- edge-specific user presets;
- multiple saved placements;
- animated travel between monitors;
- auto-placement based on foreground app;
- exclusion zones around arbitrary windows;
- per-state opacity customization;
- multi-monitor settings UI.
