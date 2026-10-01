# Nimbi — Cloudee Behavior Runtime Design

**Date:** 2026-10-01  
**Status:** Approved design, pending written-spec review  
**Repository:** `jhonatan-oliveiradev/nimbi`  
**Depends on:** Placement & Presence v1 (PR #4)

## 1. Purpose

Replace Nimbi's hand-built cloud avatar renderer with the exported **Cloudee** avatar definition from Bible Strong Avatar Lab, while keeping Nimbi's product behavior, system-state semantics, placement, shell, and interaction model under Nimbi ownership.

The goal is not to embed the Avatar Lab Studio. The goal is to use the exported Cloudee character as Nimbi's visual embodiment and connect its existing expressions/animations to Nimbi's semantic and pointer interaction states.

Success means Nimbi no longer feels like a draggable UI with a mascot attached. The avatar should feel alive, reactive, and naturally integrated into the Dynamic-Island-like shell without becoming distracting or pet-like.

## 2. Product principles

1. **Nimbi owns behavior; Cloudee renders it.**
   - RunOptic and user interaction determine what Nimbi is doing.
   - The avatar runtime receives semantic animation/expression commands.
   - Avatar-specific animation names must not leak across the rest of the app.

2. **The avatar is the origin of the interface.**
   - Opening the island should visually grow from the avatar.
   - Closing should collapse back into the avatar.
   - The shell must not feel like an unrelated panel appearing behind a character.

3. **Alive but elegant.**
   - Persistent animation must remain subtle.
   - Reactions are richer when the user directly interacts.
   - State feedback should be readable without constant visual noise.

4. **Placement remains authoritative.**
   - This feature must not change the placement/persistence contract established by PR #4.
   - Docking, normalized coordinates, native drag geometry, and presence opacity stay separate concerns.

5. **RunOptic remains the observability source.**
   - Nimbi does not add provider collectors or access provider credentials.
   - No prompt/response persistence is introduced.

## 3. Source asset

The initial avatar source is the exported `cloudee.avatar.json` supplied from Bible Strong Avatar Lab.

The definition contains:
- Cloudee body geometry and colors;
- semantic expressions;
- animation timelines;
- blinking configuration;
- expression-local body/eye motion;
- metadata labels/descriptions.

The source export is copied into Nimbi as a versioned product asset rather than reconstructed from the Studio document.

Recommended location:

```text
src/avatar/assets/cloudee.avatar.json
```

Nimbi may adjust the exported body color to match the Nimbi palette. Geometry and animation data should remain unchanged in the first integration pass unless visual testing proves a specific issue.

## 4. Architecture

### 4.1 Components

```text
RunOptic snapshot ───────────────┐
                                 │
Pointer / hover / click ─────────┼──> NimbiBehaviorController
                                 │              │
Drag lifecycle ──────────────────┤              │
                                 │              v
Island lifecycle ────────────────┘      NimbiAvatarAdapter
                                                │
                                                v
                                      Cloudee runtime component
                                                │
                                                v
                                      SVG / Motion rendering
```

### 4.2 Responsibility boundaries

#### `NimbiBehaviorController`

Owns:
- semantic Nimbi behavior state;
- priority between system state and direct interaction;
- transient reaction timing;
- return-to-baseline behavior;
- reduced-motion policy;
- mapping from Nimbi events to avatar commands.

Does not own:
- avatar geometry;
- animation interpolation;
- placement coordinates;
- Tauri window position;
- persistence.

#### `NimbiAvatarAdapter`

Owns:
- validation/loading of the Cloudee definition;
- mapping semantic Nimbi behaviors to Cloudee animation/expression keys;
- runtime imperative calls such as `play()`, `setExpression()`, `stop()`;
- safe fallback if a requested animation is missing;
- hiding runtime-specific names from the rest of Nimbi.

Does not own:
- business semantics;
- RunOptic polling;
- interaction arbitration.

#### `NimbiAvatar`

Owns:
- the rendered avatar surface;
- pointer target semantics;
- sizing inside compact/attention/expanded island modes;
- visual integration with shell transitions;
- accessibility label.

It replaces the current hand-authored cloud rendering surface, but keeps the existing placement/drag integration points.

## 5. Semantic behavior model

Introduce a Nimbi-owned behavior vocabulary:

```ts
export type NimbiBehavior =
  | "idle"
  | "notice"
  | "listening"
  | "thinking"
  | "searching"
  | "working"
  | "complete"
  | "needs-input"
  | "error"
  | "tap"
  | "grab"
  | "dragging"
  | "release";
```

These are product semantics, not avatar animation names.

### 5.1 Baseline state mapping

| Nimbi behavior | Initial Cloudee mapping | Notes |
| --- | --- | --- |
| `idle` | `idle` | Default ambient state |
| `notice` | `curious` or attentive expression | Pointer approaches/hover |
| `listening` | `listening` | Island open and awaiting user |
| `thinking` | `thinking` | Direct semantic match |
| `searching` | `searching` | Direct semantic match |
| `working` | `working` | Direct semantic match |
| `complete` | short `celebrate`, then `happy`, then baseline | Must not loop celebration indefinitely |
| `needs-input` | attentive expression / `curious` | Full presence opacity remains governed by Presence policy |
| `error` | `confused` or uneasy expression | Avoid aggressive/angry default |
| `tap` | short playful reaction | Interaction overlay, then previous baseline |
| `grab` | controlled expression + shell squash | Direct manipulation |
| `dragging` | controlled expression; no long loop | Drag physics comes from shell, not avatar timeline |
| `release` | short playful/settle reaction | Then return to current baseline |

The final exact expression used for `notice`, `needs-input`, `error`, `grab`, `dragging`, and `release` is a visual-tuning decision inside implementation. Their semantic role is fixed by this spec.

## 6. Behavior arbitration

Nimbi can receive multiple inputs at once. The controller resolves them using explicit priority.

Highest to lowest:

1. `dragging` / `grab`
2. `tap` / `release`
3. `needs-input`
4. `error`
5. `complete` transient
6. `working`
7. `searching`
8. `thinking`
9. `listening`
10. `notice`
11. `idle`

Rules:
- Direct manipulation temporarily overrides system animation.
- When a transient reaction ends, the controller re-evaluates the current system state rather than blindly returning to `idle`.
- `complete` is transient even if the RunOptic snapshot remains complete for a while.
- Hover/notice must not interrupt drag.
- Opening the island should not suppress a higher-priority system state.
- The controller must avoid restarting the same looping animation on every React render.

## 7. Pointer interaction model

### 7.1 Hover

When the pointer enters the avatar:
- Presence opacity becomes 1 through the existing Presence policy.
- If no higher-priority state is active, Nimbi enters `notice`.
- The reaction should start quickly but not snap abruptly.

When the pointer leaves:
- Return to the current baseline behavior after a small debounce to prevent flicker from edge crossings.

### 7.2 Click/tap

A click that does not cross the existing 6 px drag threshold:
- emits `tap`;
- plays a short reaction;
- continues the existing island open/close behavior;
- suppresses duplicate reactions caused by pointer-up/click event overlap.

Repeated clicks may reuse the same reaction in v1. Progressive easter-egg reactions are explicitly deferred.

### 7.3 Drag

Existing placement drag remains authoritative.

During drag:
- drag threshold stays 6 px;
- native/browser drag geometry stays unchanged;
- avatar enters `grab`, then `dragging`;
- the shell keeps the existing compact drag surface;
- additional shell squash/stretch may be applied with Motion;
- avatar animation must not alter pointer geometry.

On release:
- placement snap/persistence happens first;
- avatar receives `release`;
- after the release reaction, the controller resumes the current semantic baseline.

## 8. Island transition integration

Current island transitions should be refined so the shell appears to emerge from the avatar.

Opening sequence:
1. avatar acknowledges interaction;
2. shell halo/background begins expanding from avatar bounds;
3. shell reaches target geometry;
4. content fades/slides in last;
5. avatar transitions to current semantic behavior.

Closing sequence reverses this:
1. content exits;
2. shell contracts toward avatar;
3. avatar becomes the sole visible surface;
4. ambient behavior resumes.

The implementation must reuse existing island modes and geometry reporting. It must not create a second independent overlay/window.

## 9. Color and identity

The exported Cloudee body color is replaced by a Nimbi-owned color token.

Requirements:
- preserve sufficient contrast against the eyes;
- work over light and dark desktop backgrounds;
- keep the avatar recognizable as Cloudee;
- no geometry redesign in v1;
- no per-state body color flashes except where explicitly useful for error/success and visually validated.

Preferred implementation:
- derive a Nimbi-specific avatar definition object once at module load;
- override color data immutably;
- avoid mutating imported JSON at runtime.

## 10. Presence integration

The existing Presence opacity policy remains the source of truth.

The avatar renderer must:
- accept the computed character opacity;
- keep readable shell content at full opacity;
- use full opacity during hover and drag;
- respect state floors from Placement & Presence v1;
- avoid animation effects that visually defeat the intended opacity.

## 11. Reduced motion

When `prefers-reduced-motion: reduce` is active:
- disable non-essential ambient body drift;
- reduce or remove squash/stretch;
- use direct or shortened expression transitions;
- keep semantic expression changes so state remains understandable;
- preserve blink only if the runtime treats it as low-intensity motion; otherwise disable it;
- placement and interaction functionality must remain unchanged.

## 12. Runtime failure behavior

If the avatar runtime or definition fails:
- Nimbi must remain usable;
- render a minimal static fallback cloud;
- island open/close, placement, RunOptic state, and controls continue working;
- log a development-visible error;
- do not crash the Tauri shell.

If one animation key is missing:
- fall back to a safe expression or `idle`;
- do not throw through the React tree.

## 13. Licensing and notices

Project decision:
- Cloudee is used as an exported avatar asset, not as a rebranded Avatar Lab product.
- Attribution and relevant third-party notices must be preserved.
- If Nimbi directly ships `@bible-strong/avatar-react` / `@bible-strong/avatar-core`, their AGPL-3.0-only license must be reflected in dependency/license review before distribution.
- This spec does not make a legal determination about downstream licensing obligations; it records the implementation boundary and the need to keep notices explicit.

Update `THIRD_PARTY_NOTICES.md` as part of implementation.

## 14. Expected file layout

Exact filenames may shift to match the codebase, but responsibilities should remain separated.

```text
src/
  avatar/
    assets/
      cloudee.avatar.json
    nimbi-avatar.tsx
    nimbi-avatar-adapter.ts
    nimbi-avatar.types.ts
    nimbi-avatar.test.tsx

  behavior/
    nimbi-behavior.ts
    nimbi-behavior-controller.ts
    nimbi-behavior-controller.test.ts

  island/
    DynamicIsland.tsx
    island.css

  cloud/
    Cloud.tsx            # removed or reduced to fallback-only role
```

Do not place behavior arbitration inside `DynamicIsland.tsx`.

## 15. Testing strategy

### Domain/controller tests

Cover:
- baseline RunOptic state mapping;
- behavior priority;
- transient reaction completion;
- restoring current baseline after transient reactions;
- hover debounce;
- drag overriding hover/system state;
- complete celebration plays once per completion transition;
- missing animation fallback;
- reduced-motion behavior selection.

### Component tests

Cover:
- Cloudee definition loads;
- correct animation command is issued for semantic state changes;
- same animation is not restarted unnecessarily;
- pointer enter/leave drives notice behavior;
- click-vs-drag threshold remains intact;
- fallback renders if avatar runtime fails;
- accessible avatar label is present.

### Existing regression suite

Placement & Presence tests must remain green.

No test may weaken:
- 6 px drag threshold;
- 56 logical px snap threshold;
- normalized placement persistence;
- Presence opacity floors;
- native window geometry contracts.

### Visual validation

Browser preview must expose fixtures for at least:
- idle;
- hover/notice;
- thinking;
- working;
- needs-input;
- error;
- complete;
- tap;
- drag;
- docked top/right/bottom/left;
- floating expanded near each monitor edge.

The user should validate motion using recorded video before the implementation PR is marked ready.

## 16. Rollout

1. Merge Placement & Presence v1 first.
2. Rebase implementation branch onto the resulting `main`.
3. Add Cloudee definition and runtime behind `NimbiAvatar`.
4. Preserve static fallback.
5. Introduce behavior controller and baseline mappings.
6. Wire pointer interaction overlays.
7. Wire RunOptic semantic states.
8. Refine island emergence/contraction motion.
9. Validate browser preview.
10. Run frontend + Rust + native Windows CI.
11. Open/keep implementation PR as draft until visual approval.

## 17. Explicitly deferred

Not part of this slice:
- Attention & Actions command execution;
- voice input/output;
- autonomous desktop actions;
- progressive click easter eggs;
- user-selectable avatar packs;
- Avatar Lab editing UI inside Nimbi;
- runtime avatar customization UI;
- emotion inference from prompts/messages;
- per-state color themes;
- additional downloadable characters.

## 18. Acceptance criteria

The slice is complete only when:

1. Cloudee replaces the current primary hand-built avatar in normal operation.
2. The current static cloud remains available as a safe fallback.
3. Nimbi semantic states map through a Nimbi-owned controller rather than direct runtime calls throughout the UI.
4. Idle motion feels alive but remains unobtrusive.
5. Hover produces a visible but subtle acknowledgement.
6. Click, grab, drag, release, completion, needs-input, and error have distinct behavior.
7. Dragging and docking behavior from Placement & Presence remains unchanged.
8. Island open/close visually originates from and returns to the avatar.
9. Reduced-motion users retain full functional feedback without unnecessary motion.
10. Existing frontend and Rust tests remain green, with focused new behavior tests added.
11. Windows CI successfully builds the native shell.
12. Third-party notices are updated before distribution.
13. Visual validation is approved from the browser preview before the implementation PR is marked ready.
