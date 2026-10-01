# Cloudee Behavior Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Nimbi's primary hand-built cloud renderer with the exported Cloudee avatar while preserving Placement & Presence behavior and adding a Nimbi-owned semantic behavior controller for ambient, system, pointer, and drag interactions.

**Architecture:** A new `NimbiBehaviorController` resolves RunOptic/system state and transient pointer/drag interactions into a stable `NimbiBehavior`. A thin `NimbiAvatarAdapter` owns all Cloudee runtime-specific animation/expression keys, while `NimbiAvatar` renders the exported definition and falls back to the existing `NimbiCloud` if runtime initialization fails. `DynamicIsland` remains the integration surface for placement and pointer mechanics, but behavior arbitration stays outside it.

**Tech Stack:** React 19, TypeScript 5.8, Motion 12, Vite 6, Vitest 3, Testing Library, Tauri 2, Bible Strong Avatar React/Core runtime.

**Spec:** `docs/superpowers/specs/2026-10-01-cloudee-behavior-runtime-design.md`

## Global Constraints

- Implementation starts only after Placement & Presence v1 (PR #4) is merged and the implementation branch is rebased onto the resulting `main`.
- Existing drag threshold remains exactly **6 px**.
- Existing magnetic dock threshold remains exactly **56 logical px**.
- Placement persistence remains normalized 0..1 coordinates.
- Existing Presence opacity floors remain authoritative.
- RunOptic remains the observability source; no provider collectors or prompt/response persistence are added.
- The Cloudee export is stored as a versioned product asset; Avatar Lab Studio is not embedded.
- The current `NimbiCloud` remains available as a static/runtime-failure fallback.
- Reduced-motion behavior must preserve semantic feedback while removing non-essential motion.
- Direct runtime-specific animation names must be contained in the avatar adapter.
- Update `THIRD_PARTY_NOTICES.md` for Bible Strong Avatar Lab/runtime attribution before distribution.
- Windows Smart App Control is not disabled; local visual validation uses the browser preview and Windows CI remains the native build gate.

## Review Focus

- **Rapid state churn:** thinking → working → complete → idle must not restart loops every React render or replay completion celebration more than once per completion transition.
- **Pointer race with drag:** hover/tap events around pointer capture must never interrupt active dragging or produce an accidental island toggle after drag.
- **Missing/malformed avatar behavior key:** adapter must fall back safely without throwing through the React tree.
- **Runtime render failure:** Nimbi must render the current `NimbiCloud` fallback while placement, island, and RunOptic state remain functional.
- **Reduced motion + transient interactions:** tap/release/complete still communicate state without ambient drift or squash/stretch.

---

### Task 1: Add the Cloudee runtime dependency and versioned avatar definition

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/avatar/assets/cloudee.avatar.json`
- Create: `src/avatar/cloudee-definition.ts`
- Test: `src/avatar/cloudee-definition.test.ts`

**Interfaces:**
- Consumes: supplied `cloudee.avatar.json`.
- Produces: `CLOUDEE_DEFINITION` and `NIMBI_CLOUDEE_DEFINITION`, both immutable validated definition objects suitable for `@bible-strong/avatar-react`.

- [ ] **Step 1: Write the failing definition test**

Assert:
- schema is `bible-strong/avatar-definition`;
- name is `Cloudee`;
- required animations `idle`, `listening`, `thinking`, `searching`, `working`, `happy`, `curious`, `confused`, `playful`, and `celebrate` exist;
- `NIMBI_CLOUDEE_DEFINITION.colors.body` uses the chosen Nimbi body token while the imported JSON object remains unchanged.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --run src/avatar/cloudee-definition.test.ts`  
Expected: FAIL because the definition module/asset does not exist.

- [ ] **Step 3: Add runtime packages and the exported JSON asset**

Install the published React/core runtime versions compatible with React 19, commit the exact lockfile resolution, and add the supplied Cloudee JSON unchanged under `src/avatar/assets/`.

- [ ] **Step 4: Implement immutable Nimbi color derivation**

Create:
```ts
export const CLOUDEE_DEFINITION: AvatarDefinition;
export const NIMBI_CLOUDEE_DEFINITION: AvatarDefinition;
```

Derive the Nimbi version once at module load without mutating the imported JSON. Keep geometry and animation data unchanged.

- [ ] **Step 5: Run focused test and build**

Run:
```bash
npm test -- --run src/avatar/cloudee-definition.test.ts
npm run build
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/avatar
git commit -m "feat: add Cloudee avatar definition"
```

---

### Task 2: Implement Nimbi behavior domain and arbitration

**Files:**
- Create: `src/behavior/nimbi-behavior.ts`
- Create: `src/behavior/nimbi-behavior-controller.ts`
- Test: `src/behavior/nimbi-behavior-controller.test.ts`

**Interfaces:**
- Consumes: `NimbiActivity` from `src/telemetry/contract.ts`.
- Produces:
  - `NimbiBehavior` union from the approved spec.
  - `baselineBehavior(activity: NimbiActivity, islandOpen: boolean): NimbiBehavior`.
  - `resolveBehavior(input: BehaviorResolutionInput): NimbiBehavior`.
  - `CompletionLatch` helper/state that emits `complete` only on entry into the complete activity.

- [ ] **Step 1: Write failing controller tests**

Cover:
- idle + closed → `idle`;
- idle + open → `listening`;
- thinking/searching/working map to themselves;
- drag/grab overrides hover and system state;
- tap/release overrides normal system state but not active drag;
- needs-input outranks error/complete/working according to spec priority;
- complete is emitted once on transition into complete and not repeatedly for identical snapshots;
- after transient completion/tap/release ends, current baseline is recomputed rather than forced to idle;
- rapid thinking → working → complete → idle resolves deterministically.

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- --run src/behavior/nimbi-behavior-controller.test.ts`  
Expected: FAIL because behavior domain does not exist.

- [ ] **Step 3: Implement behavior types and pure arbitration functions**

Keep this layer framework-independent. Do not import React, Motion, Cloudee runtime, placement, or Tauri.

- [ ] **Step 4: Run test and verify pass**

Run: `npm test -- --run src/behavior/nimbi-behavior-controller.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/behavior
git commit -m "feat: add Nimbi behavior arbitration"
```

---

### Task 3: Add the Cloudee adapter and safe runtime key mapping

**Files:**
- Create: `src/avatar/nimbi-avatar.types.ts`
- Create: `src/avatar/nimbi-avatar-adapter.ts`
- Test: `src/avatar/nimbi-avatar-adapter.test.ts`

**Interfaces:**
- Consumes: `NimbiBehavior`, `NIMBI_CLOUDEE_DEFINITION`.
- Produces:
  - `AvatarTarget = { kind: "animation"; key: string } | { kind: "expression"; key: string }`.
  - `targetForBehavior(behavior: NimbiBehavior, reducedMotion: boolean): AvatarTarget`.
  - `safeTargetForBehavior(...): AvatarTarget` that falls back to `idle`/neutral if a configured key is absent.
  - Central constants for all Cloudee animation/expression names.

- [ ] **Step 1: Write failing adapter tests**

Pin direct mappings:
- idle → `idle`;
- listening → `listening`;
- thinking → `thinking`;
- searching → `searching`;
- working → `working`;
- complete → `celebrate`;
- notice/needs-input/error/tap/grab/dragging/release resolve to approved safe animation/expression targets;
- missing configured key returns safe fallback instead of throwing;
- reduced-motion variants avoid long looping reaction targets for tap/release/complete.

- [ ] **Step 2: Run focused test and verify failure**

Run: `npm test -- --run src/avatar/nimbi-avatar-adapter.test.ts`.

- [ ] **Step 3: Implement the adapter**

All Cloudee-specific names must live here. No other application file may refer directly to keys such as `curious`, `celebrate`, or `confused`.

- [ ] **Step 4: Run focused test and verify pass**

Run: `npm test -- --run src/avatar/nimbi-avatar-adapter.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/avatar/nimbi-avatar-adapter.ts src/avatar/nimbi-avatar-adapter.test.ts src/avatar/nimbi-avatar.types.ts
git commit -m "feat: map Nimbi behavior to Cloudee"
```

---

### Task 4: Build `NimbiAvatar` with runtime control and fallback

**Files:**
- Create: `src/avatar/NimbiAvatar.tsx`
- Create: `src/avatar/nimbi-avatar.css`
- Test: `src/avatar/NimbiAvatar.test.tsx`
- Modify: `src/nimbi/NimbiCloud.tsx` only as needed to support fallback presentation.

**Interfaces:**
- Consumes:
  - `behavior: NimbiBehavior`;
  - `activity: NimbiActivity`;
  - `reducedMotion: boolean`;
  - `passiveOpacity: number`;
  - `interaction: PresenceInteraction`;
  - pointer/bounds props needed by fallback only.
- Produces: `NimbiAvatar` React component and an internal runtime controller wrapper.

- [ ] **Step 1: Write failing component tests**

Cover:
- renders Cloudee with accessible label;
- behavior change issues exactly one new runtime target command;
- re-render with same behavior does not restart the same loop;
- missing target uses adapter fallback;
- runtime/render error boundary shows `NimbiCloud` fallback;
- fallback retains effective Presence opacity;
- reduced-motion mode uses the reduced target returned by adapter.

- [ ] **Step 2: Run focused test and verify failure**

Run: `npm test -- --run src/avatar/NimbiAvatar.test.tsx`.

- [ ] **Step 3: Implement `NimbiAvatar`**

Use the runtime's imperative controller so semantic behavior changes do not require remounting the avatar. Keep runtime failures contained behind a small error boundary/fallback component.

- [ ] **Step 4: Run focused test and verify pass**

Run: `npm test -- --run src/avatar/NimbiAvatar.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/avatar src/nimbi/NimbiCloud.tsx
git commit -m "feat: render Cloudee as Nimbi avatar"
```

---

### Task 5: Wire behavior state into `NimbiApp` without coupling it to the avatar runtime

**Files:**
- Modify: `src/app/NimbiApp.tsx`
- Create: `src/behavior/use-nimbi-behavior.ts`
- Test: `src/behavior/use-nimbi-behavior.test.tsx`
- Modify/Test: existing `src/app/NimbiApp.test.tsx` if present.

**Interfaces:**
- Consumes: current `NimbiSnapshot`, rendered island mode, reduced-motion flag, pointer interaction events from `DynamicIsland`.
- Produces:
  - `useNimbiBehavior({ activity, islandOpen, reducedMotion }): { behavior, interactionHandlers, dragHandlers }`.
  - Stable callbacks for notice/tap/grab/dragging/release lifecycle.

- [ ] **Step 1: Write failing hook tests**

Cover:
- hover enters notice and pointer leave returns to baseline after debounce;
- hover debounce does not flicker on immediate leave/re-enter;
- tap creates transient tap then restores current baseline;
- complete only celebrates once per transition;
- dragging cancels/supersedes hover transient;
- reduced motion does not change semantic priority.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run src/behavior/use-nimbi-behavior.test.tsx`.

- [ ] **Step 3: Implement hook/controller integration**

Use timers only inside the hook/controller boundary and clean them on unmount/state replacement. Do not place timers in `DynamicIsland.tsx`.

- [ ] **Step 4: Wire `NimbiApp` to pass behavior callbacks and current behavior into the island**

No Cloudee animation names may appear in `NimbiApp.tsx`.

- [ ] **Step 5: Run focused tests and verify pass**

Run:
```bash
npm test -- --run src/behavior/use-nimbi-behavior.test.tsx
npm test -- --run src/app
```

- [ ] **Step 6: Commit**

```bash
git add src/app src/behavior
git commit -m "feat: connect Nimbi behavior to app state"
```

---

### Task 6: Replace the primary avatar surface in `DynamicIsland` and preserve drag semantics

**Files:**
- Modify: `src/island/DynamicIsland.tsx`
- Modify: `src/island/island.css`
- Test: existing `src/island/*test*.tsx`
- Test: existing `src/placement/use-nimbi-drag.test.tsx`

**Interfaces:**
- Consumes: `behavior: NimbiBehavior`, behavior interaction callbacks supplied by `NimbiApp`.
- Produces: pointer/drag events forwarded to both existing placement mechanics and the behavior controller without changing placement contracts.

- [ ] **Step 1: Extend island tests before implementation**

Assert:
- pointer enter invokes notice callback;
- pointer down below 6 px does not emit drag-start;
- click after a real drag remains suppressed;
- drag-start emits grab/drag behavior callback exactly once;
- pointer-up after dragging emits release after placement commit;
- active drag cannot be replaced by hover behavior;
- avatar container still reports bounds for native shell geometry.

- [ ] **Step 2: Run island/drag tests and verify new assertions fail**

Run:
```bash
npm test -- --run src/island src/placement/use-nimbi-drag.test.tsx
```

- [ ] **Step 3: Replace normal `NimbiCloud` rendering with `NimbiAvatar`**

Keep `characterRef`, bounds reporting, placement, and drag event order unchanged.

- [ ] **Step 4: Add direct-manipulation shell motion**

Add subtle grab/drag/release squash/stretch in CSS/Motion without changing the 76×48 native drag surface or pointer geometry. Disable it under reduced motion.

- [ ] **Step 5: Run island/placement tests**

Run:
```bash
npm test -- --run src/island src/placement
```
Expected: all pass, including the original 6 px threshold contract.

- [ ] **Step 6: Commit**

```bash
git add src/island src/placement
git commit -m "feat: integrate Cloudee with island interactions"
```

---

### Task 7: Refine island emergence/contraction around the avatar

**Files:**
- Modify: `src/island/DynamicIsland.tsx`
- Modify: `src/island/island.css`
- Modify: browser preview files under `dev/` used by `island-preview.html`
- Test: `src/island/DynamicIsland.test.tsx` or nearest existing island component test.

**Interfaces:**
- Consumes: existing `IslandMode`, orientation, placement, reduced-motion state.
- Produces: staged visual shell lifecycle: avatar acknowledgement → shell expansion → content entrance, and reverse on close.

- [ ] **Step 1: Write failing transition-order tests**

Using stable data attributes/animation-state markers, assert:
- avatar remains mounted through open/close;
- content enters only after shell reaches the content-visible phase;
- content exits before shell contracts;
- reduced-motion mode skips staged delays while preserving final states.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run src/island`.

- [ ] **Step 3: Implement staged shell/content phases**

Reuse the existing island and geometry reporting. Do not create a second overlay/window. Keep vertical dock reflow intact.

- [ ] **Step 4: Extend preview fixtures**

Expose at least:
- idle;
- hover/notice;
- thinking;
- working;
- needs-input;
- error;
- complete;
- tap;
- drag;
- top/right/bottom/left dock;
- floating near each edge.

- [ ] **Step 5: Run island tests and production build**

Run:
```bash
npm test -- --run src/island
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/island dev
git commit -m "feat: make island emerge from Nimbi avatar"
```

---

### Task 8: Add notices, full regression verification, and browser visual gate

**Files:**
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `README.md` only if runtime setup/attribution needs developer documentation.
- Modify: `.github/workflows/*` only if the new npm dependency requires no-lock/cache adjustment; otherwise leave CI unchanged.

**Interfaces:**
- Consumes: completed Tasks 1–7.
- Produces: distributable attribution, green regression suite, and a visual-validation candidate branch.

- [ ] **Step 1: Add Bible Strong attribution/license notice**

Document Avatar Lab repository, Cloudee export usage, runtime packages actually shipped, and their declared license. Do not remove existing Coucou notice.

- [ ] **Step 2: Run the complete frontend suite**

Run:
```bash
npm ci
npm test -- --run
npm run build
npm audit --omit=dev
```
Expected: all tests pass, build passes, and no newly introduced production vulnerability is left unexplained.

- [ ] **Step 3: Verify Rust/native regression through Windows CI**

Push the implementation branch and verify:
- Rust tests pass;
- Clippy with `-D warnings` passes;
- Tauri native Windows build passes;
- Windows artifact is uploaded.

Do not recommend disabling Smart App Control for local native execution.

- [ ] **Step 4: Browser visual validation**

Run locally:
```powershell
npm ci
npm run dev
```

Open:
```text
http://localhost:5173/dev/island-preview.html
```

Validate all preview fixtures and record video, especially:
- hover acknowledgement;
- tap vs drag;
- drag to all four docks;
- complete celebration returning to baseline;
- needs-input/error;
- reduced motion;
- floating expansion near monitor edges;
- open/close shell appearing to originate from the avatar.

- [ ] **Step 5: Fix any visual/runtime issues with focused failing tests first**

Each fix follows TDD and receives its own small commit where meaningful.

- [ ] **Step 6: Final verification**

Run the same full frontend suite again and confirm latest Windows CI is green at the implementation branch head.

- [ ] **Step 7: Update/create draft implementation PR**

The PR must:
- target `main`;
- reference this spec and plan;
- remain draft until visual approval;
- call out Cloudee/Avatar Lab attribution;
- state that Placement & Presence contracts were preserved.

- [ ] **Step 8: Commit documentation changes**

```bash
git add THIRD_PARTY_NOTICES.md README.md
git commit -m "docs: add Cloudee runtime attribution"
```
