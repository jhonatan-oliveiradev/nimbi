# Nimbi — Placement & Presence v1

**Date:** 2026-10-01  
**Status:** Approved direction / implementation active  
**Branch:** `feature/placement-presence-v1`

## Goal

Turn Nimbi from a fixed top-center island into an adaptive desktop companion that can live where the user wants.

Nimbi must be draggable, magnetically dock to any screen edge, remain floating when intentionally released away from an edge, adapt its layout/orientation to its habitat, remember its placement, and let the user control how visually present it is while idle.

## Product rules

1. Nimbi is moved by dragging the cloud itself, not by a permanent drag handle.
2. Moving is fluid: the island contracts toward the cloud while dragging and expands again after placement settles.
3. Docking is magnetic near the four screen edges.
4. Top/bottom use a horizontal layout. Left/right use a vertical layout.
5. Floating placement may switch orientation based on where it sits in the viewport; near lateral zones it prefers vertical, elsewhere horizontal.
6. Nimbi never expands outside the visible work area.
7. Position is stored normalized to the monitor/work area, not as fragile absolute pixels.
8. If the stored monitor disappears, Nimbi falls back to the primary monitor and clamps to a valid position.
9. Opacity controls passive presence, not legibility of actionable content.
10. Hover, active work and attention states may raise effective opacity above the configured idle value.
11. `needs-input` must always render fully legibly.
12. The browser preview remains the primary local validation surface while Smart App Control blocks unsigned native development binaries.

## Placement contract

```ts
export type NimbiEdge = "top" | "right" | "bottom" | "left";
export type NimbiOrientation = "horizontal" | "vertical";

export type NimbiPlacement =
  | {
      mode: "docked";
      edge: NimbiEdge;
      offset: number; // normalized 0..1 along the edge
      monitorId?: string;
    }
  | {
      mode: "floating";
      x: number; // normalized 0..1
      y: number; // normalized 0..1
      monitorId?: string;
    };

export interface NimbiPresence {
  idleOpacity: number; // clamped, recommended UI range 0.25..1
}
```

Default placement remains docked at the top center:

```ts
{ mode: "docked", edge: "top", offset: 0.5 }
```

Default idle opacity: `0.72`.

## Adaptive orientation

Docked:
- top → horizontal
- bottom → horizontal
- left → vertical
- right → vertical

Floating:
- left/right outer zones prefer vertical;
- central region prefers horizontal;
- expansion direction is chosen from available screen space.

Orientation means layout reflow, never a 90-degree CSS rotation of text/content.

## Expansion direction

Docked:
- top → down
- bottom → up
- left → right
- right → left

Floating:
- choose the direction with the greatest safe space;
- clamp the host rectangle so the expanded surface remains on-screen.

## Drag interaction

### Start

A normal click still opens/closes Nimbi.

A pointer-down on the cloud becomes a drag only after either:
- pointer travels at least ~5 logical px, or
- a short hold threshold confirms movement intent.

On drag start:
- suppress the click toggle;
- contract the shell toward the cloud;
- increase shadow/separation slightly;
- use grabbing cursor;
- show subtle dock affordances near eligible edges.

### Move

Browser preview:
- follow the pointer directly.

Native Windows:
- use Tauri window dragging rather than manually teleporting the WebView each frame;
- listen to window movement and derive the candidate placement from real monitor/work-area geometry.

### Drop

Near an edge:
- snap magnetically;
- calculate normalized edge offset;
- morph to the edge's orientation.

Away from an edge:
- remain floating;
- store normalized x/y;
- choose adaptive orientation and expansion direction.

## Presence / opacity

The user-facing setting controls idle presence, not a blanket CSS opacity on the whole interface.

Example with `idleOpacity = 0.40`:

- idle → 0.40
- hover → 1.00
- thinking → max(configured, 0.58)
- working → max(configured, 0.68)
- complete → max(configured, 0.82)
- error → max(configured, 0.90)
- needs-input → 1.00
- actionable text/buttons → always fully legible

Character/shell ambience may fade; content remains readable.

Transition back to passive opacity after hover should be soft (~500–700 ms).

## Persistence

Production settings are local-only and contain no prompts, responses, credentials or provider payloads.

Suggested local state:

```json
{
  "placement": {
    "mode": "docked",
    "edge": "right",
    "offset": 0.32,
    "monitorId": "..."
  },
  "presence": {
    "idleOpacity": 0.55
  }
}
```

Rust owns persistence. React receives/updates a narrow preference contract through Tauri commands/events.

## Native host strategy

The transparent host changes geometry based on placement rather than always assuming top-center:

- horizontal dock host: approximately 640 × 300 logical px;
- vertical dock host: approximately 300 × 640 logical px;
- floating host: compact area centered around the floating anchor and large enough for safe expansion.

Click-through outside the visible island remains mandatory.

Pure Rust geometry functions must be unit-tested for:
- all four edges;
- 100%, 125%, 150%, 200% DPI;
- negative monitor coordinates;
- normalized offsets;
- floating clamp;
- missing-monitor fallback.

## Browser preview acceptance

The same production React components must support:
- drag cloud around the simulated desktop;
- snap top/right/bottom/left;
- remain floating in the center;
- visibly morph horizontal ↔ vertical without rotating text;
- never render expanded content outside the preview viewport;
- opacity slider with immediate passive-state feedback;
- hover restoring full presence;
- activity state shortcuts remaining usable during placement testing.

## Slice exit criteria

The slice is ready to merge when:

- placement/orientation/expansion logic is covered by unit tests;
- browser preview supports fluid drag + docking + floating;
- opacity/presence behavior is covered by tests;
- placement survives refresh in preview/local storage;
- Rust has a serializable placement/presence preference model and safe geometry logic;
- native commands are wired for load/save placement and host repositioning;
- Windows CI passes frontend tests/build, Rust tests/clippy and native Tauri compile/link;
- no change weakens RunOptic privacy or Windows security boundaries.
