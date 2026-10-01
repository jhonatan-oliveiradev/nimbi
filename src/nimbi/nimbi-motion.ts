import type { NimbiActivity } from "../telemetry/contract";

export interface NimbiMotion {
  energy: number;
  focus: number;
  urgency: number;
  stretchX: number;
  stretchY: number;
  tilt: number;
  gazeX: number;
  gazeY: number;
  opacity: number;
}

export interface DOMRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MOTION: Record<NimbiActivity, NimbiMotion> = {
  offline: {
    energy: 0,
    focus: 0,
    urgency: 0,
    stretchX: 1,
    stretchY: 1,
    tilt: 0,
    gazeX: 0,
    gazeY: 0,
    opacity: 0.38,
  },
  idle: {
    energy: 0.08,
    focus: 0.16,
    urgency: 0,
    stretchX: 1,
    stretchY: 1,
    tilt: 0,
    gazeX: 0,
    gazeY: 0,
    opacity: 1,
  },
  thinking: {
    energy: 0.28,
    focus: 0.72,
    urgency: 0.08,
    stretchX: 1.015,
    stretchY: 0.985,
    tilt: -0.8,
    gazeX: 0.08,
    gazeY: 0.06,
    opacity: 1,
  },
  working: {
    energy: 0.42,
    focus: 0.62,
    urgency: 0.12,
    stretchX: 1.025,
    stretchY: 0.975,
    tilt: 0.9,
    gazeX: 0,
    gazeY: 0,
    opacity: 1,
  },
  "needs-input": {
    energy: 0.34,
    focus: 0.96,
    urgency: 0.72,
    stretchX: 1.02,
    stretchY: 0.98,
    tilt: 0,
    gazeX: 0,
    gazeY: -0.08,
    opacity: 1,
  },
  complete: {
    energy: 0.7,
    focus: 0.82,
    urgency: 0.04,
    stretchX: 1.06,
    stretchY: 0.94,
    tilt: 0,
    gazeX: 0,
    gazeY: 0,
    opacity: 1,
  },
  error: {
    energy: 0.16,
    focus: 0.7,
    urgency: 0.92,
    stretchX: 0.985,
    stretchY: 1.015,
    tilt: -1.2,
    gazeX: 0,
    gazeY: 0.12,
    opacity: 0.82,
  },
};

export function motionForActivity(activity: NimbiActivity): NimbiMotion {
  return { ...MOTION[activity] };
}

export function clampGaze(
  pointerX: number,
  pointerY: number,
  bounds: DOMRectLike,
): { x: number; y: number } {
  if (bounds.width <= 0 || bounds.height <= 0) return { x: 0, y: 0 };

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const x = (pointerX - centerX) / (bounds.width / 2);
  const y = (pointerY - centerY) / (bounds.height / 2);

  return {
    x: Math.max(-1, Math.min(1, x)),
    y: Math.max(-1, Math.min(1, y)),
  };
}
