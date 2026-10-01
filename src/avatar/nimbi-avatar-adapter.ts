import type { NimbiBehavior } from "../behavior/nimbi-behavior";
import {
  NIMBI_CLOUDEE_DEFINITION,
  type CloudeeDefinition,
} from "./cloudee-definition";

export type AvatarTarget =
  | { kind: "animation"; key: string }
  | { kind: "expression"; key: string };

const NORMAL_TARGETS: Record<NimbiBehavior, AvatarTarget> = {
  idle: { kind: "animation", key: "idle" },
  notice: { kind: "animation", key: "curious" },
  listening: { kind: "animation", key: "listening" },
  thinking: { kind: "animation", key: "thinking" },
  searching: { kind: "animation", key: "searching" },
  working: { kind: "animation", key: "working" },
  complete: { kind: "animation", key: "celebrate" },
  "needs-input": { kind: "expression", key: "small-attentive" },
  error: { kind: "animation", key: "confused" },
  tap: { kind: "animation", key: "playful" },
  grab: { kind: "expression", key: "surprised-left" },
  dragging: { kind: "expression", key: "attentive-left" },
  release: { kind: "expression", key: "playful-right" },
};

const REDUCED_TARGETS: Partial<Record<NimbiBehavior, AvatarTarget>> = {
  complete: { kind: "expression", key: "joyful-wide" },
  tap: { kind: "expression", key: "playful-right" },
  release: { kind: "expression", key: "neutral" },
};

export function targetForBehavior(
  behavior: NimbiBehavior,
  reducedMotion: boolean,
): AvatarTarget {
  return (reducedMotion && REDUCED_TARGETS[behavior]) || NORMAL_TARGETS[behavior];
}

function targetExists(target: AvatarTarget, definition: CloudeeDefinition): boolean {
  return target.kind === "animation"
    ? Boolean(definition.animations[target.key])
    : Boolean(definition.expressions[target.key]);
}

export function safeTargetForBehavior(
  behavior: NimbiBehavior,
  reducedMotion: boolean,
  definition: CloudeeDefinition = NIMBI_CLOUDEE_DEFINITION,
): AvatarTarget {
  const target = targetForBehavior(behavior, reducedMotion);
  if (targetExists(target, definition)) return target;

  if (definition.animations.idle) {
    return { kind: "animation", key: "idle" };
  }

  return {
    kind: "expression",
    key: definition.expressions.neutral
      ? "neutral"
      : Object.keys(definition.expressions)[0] ?? "neutral",
  };
}
