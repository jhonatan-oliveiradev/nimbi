import { Avatar, type AvatarController } from "@bible-strong/avatar-react";
import "@bible-strong/avatar-react/styles.css";
import {
  Component,
  useEffect,
  useRef,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from "react";
import type { NimbiBehavior } from "../behavior/nimbi-behavior";
import { NimbiCloud } from "../nimbi/NimbiCloud";
import type { DOMRectLike } from "../nimbi/nimbi-motion";
import {
  effectiveOpacity,
  type PresenceInteraction,
} from "../presence/presence";
import type { NimbiActivity } from "../telemetry/contract";
import { NIMBI_CLOUDEE_DEFINITION } from "./cloudee-definition";
import { safeTargetForBehavior } from "./nimbi-avatar-adapter";
import type { AvatarTarget } from "./nimbi-avatar.types";
import "./nimbi-avatar.css";

type RuntimeDefinition = Parameters<typeof Avatar>[0]["definition"];

export interface NimbiAvatarProps {
  behavior: NimbiBehavior;
  activity: NimbiActivity;
  reducedMotion: boolean;
  passiveOpacity: number;
  interaction: PresenceInteraction;
  pointer?: { x: number; y: number };
  bounds?: DOMRectLike;
  className?: string;
}

interface RuntimeBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface RuntimeBoundaryState {
  failed: boolean;
}

class AvatarRuntimeBoundary extends Component<
  RuntimeBoundaryProps,
  RuntimeBoundaryState
> {
  state: RuntimeBoundaryState = { failed: false };

  static getDerivedStateFromError(): RuntimeBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Nimbi avatar runtime failed; using static fallback.", error, info);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function sameTarget(left: AvatarTarget | undefined, right: AvatarTarget): boolean {
  return left?.kind === right.kind && left.key === right.key;
}

function CloudeeRuntime({
  behavior,
  reducedMotion,
}: Pick<NimbiAvatarProps, "behavior" | "reducedMotion">) {
  const controller = useRef<AvatarController | null>(null);
  const previousTarget = useRef<AvatarTarget | undefined>(undefined);

  useEffect(() => {
    const runtime = controller.current;
    if (!runtime) return;

    const target = safeTargetForBehavior(behavior, reducedMotion);
    if (sameTarget(previousTarget.current, target)) return;
    previousTarget.current = target;

    const result =
      target.kind === "animation"
        ? runtime.play(target.key)
        : runtime.setExpression(target.key);

    if (!result.ok) {
      console.error("Nimbi avatar rejected runtime target.", result.error);
    }
  }, [behavior, reducedMotion]);

  return (
    <Avatar
      ref={controller}
      definition={NIMBI_CLOUDEE_DEFINITION as unknown as RuntimeDefinition}
      defaultExpression="neutral"
      size="100%"
      ariaLabel={`Nimbi: ${behavior}`}
      className="nimbi-avatar__runtime"
    />
  );
}

export function NimbiAvatar({
  behavior,
  activity,
  reducedMotion,
  passiveOpacity,
  interaction,
  pointer,
  bounds,
  className = "",
}: NimbiAvatarProps) {
  const opacity = effectiveOpacity(activity, passiveOpacity, interaction);
  const fallback = (
    <NimbiCloud
      activity={activity}
      pointer={pointer}
      bounds={bounds}
      reducedMotion={reducedMotion}
      passiveOpacity={passiveOpacity}
      interaction={interaction}
      className={className}
    />
  );

  const style = { opacity } satisfies CSSProperties;

  return (
    <div
      className={`nimbi-avatar ${className}`.trim()}
      data-testid="nimbi-avatar"
      data-behavior={behavior}
      data-effective-opacity={String(opacity)}
      style={style}
    >
      <AvatarRuntimeBoundary fallback={fallback}>
        <CloudeeRuntime behavior={behavior} reducedMotion={reducedMotion} />
      </AvatarRuntimeBoundary>
    </div>
  );
}
