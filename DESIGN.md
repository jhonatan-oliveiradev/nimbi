---
version: alpha
name: "Nimbi"
description: "Ambient Windows AI companion whose interface emerges naturally from a quiet living cloud."
colors:
  shell: "#050507"
  surface: "#111116"
  text: "#FFFFFF"
  muted: "#9B9BA7"
  lilac: "#B9A8FF"
  blue: "#9FC7FF"
  avatar: "#C8C5FF"
typography:
  sans:
    fontFamily: "\"Segoe UI Variable Text\", \"Segoe UI\", system-ui, sans-serif"
rounded:
  compact: "1.5rem"
  attention: "1.75rem"
  pill: "999px"
components:
  island: {}
  avatar: {}
omitted:
  - section: spacing
    reason: "Existing Nimbi geometry uses context-specific desktop shell dimensions rather than a shared spacing scale."
---

# Nimbi Design System

## Overview

### Creative North Star

Nimbi should feel like a small Windows system presence that happens to be alive: closer to a Dynamic Island or status surface than to a dashboard, floating assistant window, or desktop pet. The cloud is not decoration placed beside the interface; it is the visual origin from which the interface appears.

### Product context and register

- **Audience and primary job:** people running AI agents who need a glanceable, ambient way to understand state and interact when attention is required.
- **Target market(s) and evidence:** desktop-first product; current primary platform is Windows 11.
- **Locale(s) and language policy:** current product copy is English; product behavior must not depend on locale-specific geometry.
- **Usage scene:** persistent desktop companion, seen frequently but interacted with intermittently. Ambient states must tolerate long dwell times without visual fatigue.
- **Register:** product / ambient system UI.
- **Memorable signature:** the shell grows out of the Cloudee avatar and collapses back into it, so character and interface read as one object.
- **Restraint:** idle motion stays subtle; richer expression is earned by direct interaction or meaningful agent state.
- **Anti-references:** desktop pets with constant antics, sci-fi HUDs, glass dashboards, oversized assistant windows, and decorative motion with no semantic cause.
- **Token ownership/runtime mapping:** this file mirrors the canonical runtime colors in `src/styles/tokens.css`; the Nimbi-specific Cloudee body token is applied in `src/avatar/cloudee-definition.ts`.

## Colors

The shell is near-black (`shell`) and visually recedes. `surface` is reserved for controls or secondary internal surfaces. Primary text is white and secondary metadata uses `muted`. Lilac and blue are sparse semantic accents, not large decorative gradients.

The Cloudee body uses `avatar` (`#C8C5FF`) as Nimbi's identity color. State meaning should primarily come from expression, motion, copy, and small semantic accents rather than flashing the avatar through unrelated colors.

## Typography

Use the Windows-native Segoe UI Variable stack. The interface is too small and system-adjacent to justify a display face. Hierarchy comes from size, weight, opacity, and layout rather than typographic novelty.

Copy is concise, sentence case, and descriptive of real state. Nimbi does not fabricate emotional or operational claims that are not supported by telemetry or explicit interaction.

## Layout

The avatar is the persistent anchor. Shell geometry adapts to top, bottom, left, right, and floating placement without rotating text. Edge docking must preserve safe placement and the established native window bounds.

Expanded content follows the avatar rather than competing with it. The interface should reveal only the amount of information appropriate to the active mode.

## Elevation & Depth

Depth is restrained: a dark shell, low-opacity border, and controlled shadow distinguish Nimbi from the desktop. Avoid glass-heavy blur stacks. The avatar may carry a soft perceptual lift, but it should remain visually integrated with the shell.

## Shapes

The avatar retains Cloudee's soft procedural cloud silhouette. Shells use generous radii, becoming pill-like while floating or dragging. Docked edges flatten only where the shell physically meets the screen edge.

## Components

### Foundational visual states

Idle is quiet and partially transparent according to Presence. Hover restores full avatar opacity and produces a subtle acknowledgement. Thinking/working use semantic avatar behavior without turning the shell into a dashboard. Needs-input and error remain visually legible at their existing Presence floors. Complete is a short transient reaction, never an indefinite celebration.

Focus-visible behavior must remain available for keyboard-operable controls inside the expanded shell. Drag remains a pointer interaction with non-drag reset controls available in the expanded UI.

### Buttons and actions

Controls inside Nimbi use compact dark surfaces, light text, and restrained border feedback. Primary attention actions, when introduced, may use the lilac identity accent. Routine controls must not visually overpower the avatar.

### Navigation and data display

Nimbi has no conventional navigation chrome. State copy and known attribution stay short and glanceable. Unknown metadata remains absent rather than guessed.

### Forms and overlays

Expanded controls inherit the shell rather than opening browser-native dialogs. Presence controls remain compact. Future attention/action surfaces must stay inside the app-owned shell and preserve accessible names and focus behavior.

### Iconography

Use icons only when they communicate an operation more quickly than text and remain understandable at compact sizes. The avatar itself is not an icon substitute for actions.

### Motion

Motion is organic but disciplined.

- Shell geometry: approximately 280–300 ms using the established soft cubic-bezier/spring character.
- Content entrance: short and later than shell expansion.
- Direct manipulation response: approximately 180 ms.
- Hover/tap/complete behavior comes from the Nimbi behavior controller and Cloudee runtime.
- Opening order: avatar acknowledgement → shell expansion → content entrance.
- Closing order: content exit → shell contraction → ambient avatar.
- Reduced motion removes staged delays, squash/stretch, and unnecessary ambient movement while preserving semantic state changes.

Animations must be interruptible. A new semantic or direct-manipulation state may replace an older transient state without forcing a stale animation to finish.

### Content and data visualization

Nimbi uses plain operational language. Status text describes what is known: working, thinking, finished, needs attention, offline, or an error summary. No charts, token meters, or dashboard metrics belong in the ambient shell.

## Do's and Don'ts

- **Do:** make the avatar and shell feel like one continuously transforming desktop object.
- **Do:** reserve expressive motion for real system change and intentional pointer interaction.
- **Don't:** turn Nimbi into a noisy desktop pet or animate continuously just to prove it is alive.
- **Don't:** add dashboard density, speculative state, or decorative glass effects that compete with the avatar.
