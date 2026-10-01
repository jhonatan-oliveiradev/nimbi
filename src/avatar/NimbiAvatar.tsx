import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import type { NimbiBehavior } from "../behavior/nimbi-behavior";
import type { PresenceInteraction } from "../presence/presence";
import { effectiveOpacity } from "../presence/presence";
import type { NimbiActivity } from "../telemetry/contract";
import { NimbiCloud } from "../nimbi/NimbiCloud";
import {
  NIMBI_CLOUDEE_DEFINITION,
  type CloudeeAnimation,
  type CloudeeDefinition,
  type CloudeeExpression,
} from "./cloudee-definition";
import { safeTargetForBehavior } from "./nimbi-avatar-adapter";

export interface NimbiAvatarProps {
  behavior: NimbiBehavior;
  activity: NimbiActivity;
  reducedMotion?: boolean;
  hidden?: boolean;
  passiveOpacity?: number;
  interaction?: PresenceInteraction;
  pointer?: { x: number; y: number };
  bounds?: { x: number; y: number; width: number; height: number };
  className?: string;
  definition?: CloudeeDefinition;
}

function firstExpressionForAnimation(
  animation: CloudeeAnimation | undefined,
): string | undefined {
  return animation?.steps[0]?.expression;
}

function usableDefinition(definition: CloudeeDefinition): boolean {
  return (
    Boolean(definition.expressions.neutral) &&
    Object.keys(definition.expressions).length > 0 &&
    Object.keys(definition.animations).length > 0
  );
}

function targetExpressionKey(
  definition: CloudeeDefinition,
  behavior: NimbiBehavior,
  reducedMotion: boolean,
): string {
  const target = safeTargetForBehavior(behavior, reducedMotion, definition);
  if (target.kind === "expression") return target.key;
  return firstExpressionForAnimation(definition.animations[target.key]) ?? "neutral";
}

function useAnimatedExpression(
  definition: CloudeeDefinition,
  behavior: NimbiBehavior,
  reducedMotion: boolean,
): string {
  const target = safeTargetForBehavior(behavior, reducedMotion, definition);
  const fallback = targetExpressionKey(definition, behavior, reducedMotion);
  const [expressionKey, setExpressionKey] = useState(fallback);

  useEffect(() => {
    if (target.kind === "expression" || reducedMotion) {
      setExpressionKey(fallback);
      return;
    }

    const animation = definition.animations[target.key];
    if (!animation?.steps.length) {
      setExpressionKey("neutral");
      return;
    }

    let index = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const step = animation.steps[index];
      setExpressionKey(step.expression);
      const duration = Math.max(1, step.transitionMs + step.holdMs);
      timer = setTimeout(() => {
        index = (index + 1) % animation.steps.length;
        schedule();
      }, duration);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [behavior, definition, fallback, reducedMotion, target.kind, target.key]);

  return expressionKey;
}

function Body({
  definition,
  expression,
  reducedMotion,
}: {
  definition: CloudeeDefinition;
  expression: CloudeeExpression;
  reducedMotion: boolean;
}) {
  const bodyColor = expression.colors?.body ?? definition.colors.body;
  const bodyMotion =
    reducedMotion || expression.motion.body === "none"
      ? {}
      : expression.motion.body === "shake"
        ? { x: [0, -2.2, 1.8, -1.2, 0], y: [0, 0.8, -0.6, 0.4, 0] }
        : { y: [0, -2.4, 0, 1.3, 0], x: [0, 0.8, 0, -0.6, 0] };

  return (
    <motion.g
      animate={bodyMotion}
      transition={
        reducedMotion
          ? { duration: 0 }
          : expression.motion.body === "shake"
            ? { duration: 0.48, repeat: Infinity, repeatDelay: 0.4 }
            : { duration: 4.8, repeat: Infinity, ease: "easeInOut" }
      }
    >
      {definition.body.nodes.map((node, index) => (
        <ellipse
          key={index}
          cx={node.position[0]}
          cy={node.position[1]}
          rx={node.surface.width / 2}
          ry={node.surface.height / 2}
          fill={bodyColor}
        />
      ))}
      <ellipse
        cx="0"
        cy="0"
        rx={definition.body.primary.width / 2}
        ry={definition.body.primary.height / 2}
        fill={bodyColor}
      />
    </motion.g>
  );
}

function Eyes({
  definition,
  expression,
  reducedMotion,
}: {
  definition: CloudeeDefinition;
  expression: CloudeeExpression;
  reducedMotion: boolean;
}) {
  const eyeColor = expression.colors?.eyes ?? definition.colors.eyes;
  const motion =
    reducedMotion || expression.motion.eyes === "none"
      ? {}
      : expression.motion.eyes === "shake"
        ? { x: [0, -1.7, 1.4, -0.8, 0], y: [0, 0.7, -0.5, 0.3, 0] }
        : { x: [0, 1, 0, -0.7, 0], y: [0, -0.4, 0, 0.5, 0] };

  const left = expression.eyes.left;
  const right = expression.eyes.right;

  return (
    <motion.g
      animate={motion}
      transition={
        reducedMotion
          ? { duration: 0 }
          : expression.motion.eyes === "shake"
            ? { duration: 0.42, repeat: Infinity, repeatDelay: 0.5 }
            : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <ellipse
        cx={-expression.eyes.spacing / 2 + left.x}
        cy={left.y}
        rx={left.width / 2}
        ry={left.height / 2}
        fill={eyeColor}
        transform={`rotate(${left.angle} ${-expression.eyes.spacing / 2 + left.x} ${left.y})`}
      />
      <ellipse
        cx={expression.eyes.spacing / 2 + right.x}
        cy={right.y}
        rx={right.width / 2}
        ry={right.height / 2}
        fill={eyeColor}
        transform={`rotate(${right.angle} ${expression.eyes.spacing / 2 + right.x} ${right.y})`}
      />
    </motion.g>
  );
}

function RenderedNimbiAvatar({
  behavior,
  activity,
  reducedMotion = false,
  hidden = false,
  passiveOpacity = 0.72,
  interaction = "passive",
  className = "",
  definition,
}: Required<Pick<NimbiAvatarProps, "behavior" | "activity" | "definition">> &
  Omit<NimbiAvatarProps, "behavior" | "activity" | "definition" | "pointer" | "bounds">) {
  const target = safeTargetForBehavior(behavior, reducedMotion, definition);
  const expressionKey = useAnimatedExpression(
    definition,
    behavior,
    reducedMotion || hidden,
  );
  const expression =
    definition.expressions[expressionKey] ?? definition.expressions.neutral;
  const opacity = effectiveOpacity(activity, passiveOpacity, interaction);
  const targetLabel = `${target.kind}:${target.key}`;

  const pose = useMemo(
    () => ({
      x: expression.head.y * 0.18,
      y: expression.head.x * 0.14,
      rotate: expression.head.z * 0.12,
      scale: 1 + Math.max(-0.035, Math.min(0.035, expression.head.z / 900)),
    }),
    [expression.head.x, expression.head.y, expression.head.z],
  );

  return (
    <motion.svg
      role="img"
      aria-label={`Nimbi: ${behavior}`}
      data-avatar="cloudee"
      data-behavior={behavior}
      data-target={targetLabel}
      data-expression={expressionKey}
      data-motion={reducedMotion ? "reduced" : "full"}
      data-effective-opacity={String(opacity)}
      className={`nimbi-avatar ${className}`.trim()}
      viewBox="-150 -150 300 300"
      style={{ opacity, display: "block", width: "100%", height: "100%", overflow: "visible" }}
      initial={false}
    >
      <motion.g
        animate={reducedMotion ? {} : pose}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 130, damping: 19, mass: 0.75 }
        }
      >
        <Body
          definition={definition}
          expression={expression}
          reducedMotion={reducedMotion || hidden}
        />
        <Eyes
          definition={definition}
          expression={expression}
          reducedMotion={reducedMotion || hidden}
        />
      </motion.g>
    </motion.svg>
  );
}

export function NimbiAvatar({
  behavior,
  activity,
  reducedMotion = false,
  hidden = false,
  passiveOpacity = 0.72,
  interaction = "passive",
  pointer,
  bounds,
  className = "",
  definition = NIMBI_CLOUDEE_DEFINITION,
}: NimbiAvatarProps) {
  if (!usableDefinition(definition)) {
    return (
      <NimbiCloud
        activity={activity}
        pointer={pointer}
        bounds={bounds}
        reducedMotion={reducedMotion}
        hidden={hidden}
        passiveOpacity={passiveOpacity}
        interaction={interaction}
        className={className}
      />
    );
  }

  return (
    <RenderedNimbiAvatar
      behavior={behavior}
      activity={activity}
      reducedMotion={reducedMotion}
      hidden={hidden}
      passiveOpacity={passiveOpacity}
      interaction={interaction}
      className={className}
      definition={definition}
    />
  );
}
