import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { NimbiActivity } from "../telemetry/contract";
import {
  effectiveOpacity,
  type PresenceInteraction,
} from "../presence/presence";
import {
  clampGaze,
  motionForActivity,
  type DOMRectLike,
} from "./nimbi-motion";
import "./nimbi.css";

export interface NimbiCloudProps {
  activity: NimbiActivity;
  pointer?: { x: number; y: number };
  bounds?: DOMRectLike;
  reducedMotion?: boolean;
  hidden?: boolean;
  className?: string;
  passiveOpacity?: number;
  interaction?: PresenceInteraction;
}

const DEFAULT_BOUNDS: DOMRectLike = { x: 0, y: 0, width: 100, height: 60 };

export function NimbiCloud({
  activity,
  pointer,
  bounds = DEFAULT_BOUNDS,
  reducedMotion = false,
  hidden = false,
  className = "",
  passiveOpacity = 0.72,
  interaction = "passive",
}: NimbiCloudProps) {
  const profile = motionForActivity(activity);
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibilityChange = () =>
      setDocumentVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const motionDisabled = reducedMotion || hidden || !documentVisible;
  const presenceOpacity = effectiveOpacity(
    activity,
    passiveOpacity,
    interaction,
  );
  const gaze =
    !motionDisabled && pointer
      ? clampGaze(pointer.x, pointer.y, bounds)
      : { x: 0, y: 0 };

  const gazeX = gaze.x * 1.8 + profile.gazeX;
  const gazeY = gaze.y * 1.35 + profile.gazeY;
  const reaction =
    activity === "complete" || activity === "error" ? activity : undefined;
  const loops =
    !motionDisabled &&
    activity !== "complete" &&
    activity !== "error" &&
    activity !== "offline";

  const floatY =
    activity === "thinking"
      ? [0, -1.3, 0]
      : activity === "working"
        ? [0, -0.65, 0]
        : activity === "idle"
          ? [0, -0.35, 0]
          : 0;

  return (
    <motion.svg
      data-testid="nimbi-cloud"
      data-activity={activity}
      data-motion={motionDisabled ? "reduced" : "full"}
      data-gaze-x={motionDisabled ? "0" : String(gaze.x)}
      data-gaze-y={motionDisabled ? "0" : String(gaze.y)}
      data-reaction={reaction}
      data-looping={String(loops)}
      data-effective-opacity={String(presenceOpacity)}
      className={`nimbi-cloud ${className}`.trim()}
      viewBox="0 0 100 62"
      role="img"
      aria-label={`Nimbi: ${activity}`}
      initial={false}
      animate={{
        opacity: profile.opacity * presenceOpacity,
        scaleX: profile.stretchX,
        scaleY: profile.stretchY,
        rotate: profile.tilt,
        y: motionDisabled ? 0 : floatY,
      }}
      transition={
        loops
          ? {
              duration: activity === "idle" ? 5.8 : 2.4,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }
          : { type: "spring", stiffness: 260, damping: 24 }
      }
    >
      <defs>
        <linearGradient id="nimbi-body" x1="25%" y1="5%" x2="78%" y2="95%">
          <stop offset="0%" stopColor="#f8f7ff" />
          <stop offset="48%" stopColor="#ddd8ff" />
          <stop offset="100%" stopColor="#aebfff" />
        </linearGradient>
        <radialGradient id="nimbi-highlight" cx="34%" cy="20%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <motion.g
        animate={
          reaction === "complete" && !motionDisabled
            ? { scale: [1, 0.93, 1.08, 1], y: [0, 1.4, -1.2, 0] }
            : reaction === "error" && !motionDisabled
              ? { y: [0, 1.8, 0], x: [0, -0.8, 0.7, 0] }
              : {}
        }
        transition={{ duration: reaction === "complete" ? 0.55 : 0.42 }}
        style={{ transformOrigin: "50px 38px" }}
      >
        <path
          className="nimbi-cloud__body"
          d="M17 46.5C10.5 46.5 6 42.4 6 36.8c0-5.1 3.8-9.2 9-9.8.5-8.2 7.3-14.8 15.7-14.8 2.4 0 4.8.6 6.8 1.6C41.1 8.6 47 5.5 53.6 5.5c9.8 0 17.9 6.8 19.8 15.8 1.7-.7 3.6-1 5.6-1 8.3 0 15 6.2 15 13.8 0 6.9-5.6 12.4-13.2 12.4H17Z"
          fill="url(#nimbi-body)"
        />
        <path
          d="M15.5 31.5c4.8-1.2 8.3-4.9 9.1-9.5 2.1 2 4.9 3.2 8 3.2 5.4 0 10-3.6 11.4-8.5 2.8 3.7 7.3 6.1 12.3 6.1 4.9 0 9.3-2.2 12.1-5.7.7 5.4 5.1 9.7 10.7 10.7"
          fill="none"
          stroke="url(#nimbi-highlight)"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.65"
        />

        <motion.g
          animate={{ x: motionDisabled ? 0 : gazeX, y: motionDisabled ? 0 : gazeY }}
          transition={{ type: "spring", stiffness: 190, damping: 22 }}
        >
          <ellipse
            data-nimbi-eye
            cx="42"
            cy="35"
            rx={activity === "needs-input" ? "2.25" : "1.85"}
            ry={activity === "error" ? "1.15" : "2.25"}
            fill="#181725"
          />
          <ellipse
            data-nimbi-eye
            cx="59"
            cy="35"
            rx={activity === "needs-input" ? "2.25" : "1.85"}
            ry={activity === "error" ? "1.15" : "2.25"}
            fill="#181725"
          />
        </motion.g>
      </motion.g>
    </motion.svg>
  );
}
