import type { NimbiBehavior } from "../behavior/nimbi-behavior";
import { NIMBI_CLOUDEE_DEFINITION } from "./cloudee-definition";
import type {
  AvatarDefinitionTargets,
  AvatarTarget,
} from "./nimbi-avatar.types";

const TARGETS: Record<NimbiBehavior, AvatarTarget> = {
  idle: { kind: "animation", key: "idle" },
  notice: { kind: "animation", key: "curious" },
  listening: { kind: "animation", key: "listening" },
  thinking: { kind: "animation", key: "thinking" },
  searching: { kind: "animation", key: "searching" },
  working: { kind: "animation", key: "working" },
  complete: { kind: "animation", key: "celebrate" },
  "needs-input": { kind: "expression", key: "attentive-left" },
  error: { kind: "expression", key: "uneasy-left" },
  tap: { kind: "animation", key: "playful" },
  grab: { kind: "expression", key: "small-attentive" },
  dragging: { kind: "expression", key: "attentive-left" },
  release: { kind: "expression", key: "joyful-down-right" },
};

const REDUCED_TARGETS: Record<NimbiBehavior, AvatarTarget> = {
  idle: { kind: "expression", key: "neutral" },
  notice: { kind: "expression", key: "attentive-left" },
  listening: { kind: "expression", key: "small-attentive" },
  thinking: { kind: "expression", key: "gentle-downward-gaze" },
  searching: { kind: "expression", key: "attentive-left" },
  working: { kind: "expression", key: "small-attentive" },
  complete: { kind: "expression", key: "joyful-wide" },
  "needs-input": { kind: "expression", key: "attentive-left" },
  error: { kind: "expression", key: "uneasy-left" },
  tap: { kind: "expression", key: "playful-right" },
  grab: { kind: "expression", key: "small-attentive" },
  dragging: { kind: "expression", key: "attentive-left" },
  release: { kind: "expression", key: "gentle-downward-gaze" },
};

export function targetForBehavior(
  behavior: NimbiBehavior,
  reducedMotion: boolean,
): AvatarTarget {
  return reducedMotion ? REDUCED_TARGETS[behavior] : TARGETS[behavior];
}

function targetExists(
  target: AvatarTarget,
  definition: AvatarDefinitionTargets,
): boolean {
  return target.key in (
    target.kind === "animation"
      ? definition.animations
      : definition.expressions
  );
}

export function safeTargetForBehavior(
  behavior: NimbiBehavior,
  reducedMotion: boolean,
  definition: AvatarDefinitionTargets = NIMBI_CLOUDEE_DEFINITION,
): AvatarTarget {
  const target = targetForBehavior(behavior, reducedMotion);
  if (targetExists(target, definition)) return target;

  const sameKindFallback: AvatarTarget =
    target.kind === "animation"
      ? { kind: "animation", key: "idle" }
      : { kind: "expression", key: "neutral" };

  if (targetExists(sameKindFallback, definition)) return sameKindFallback;

  const finalFallback: AvatarTarget =
    target.kind === "animation"
      ? { kind: "expression", key: "neutral" }
      : { kind: "animation", key: "idle" };

  return finalFallback;
}
