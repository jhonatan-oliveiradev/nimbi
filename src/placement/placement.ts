import type { NimbiActivity } from "../telemetry/contract";

export type NimbiEdge = "top" | "right" | "bottom" | "left";
export type NimbiOrientation = "horizontal" | "vertical";
export type NimbiExpansionDirection = "up" | "right" | "down" | "left";
export type NimbiAxisAlignment = "start" | "center" | "end";

export type NimbiPlacement =
  | {
      mode: "docked";
      edge: NimbiEdge;
      offset: number;
      monitorId?: string;
    }
  | {
      mode: "floating";
      x: number;
      y: number;
      monitorId?: string;
    };

export interface NimbiPresence {
  idleOpacity: number;
}

export interface ViewportRect {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface HostRect {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

export const DEFAULT_PLACEMENT: NimbiPlacement = {
  mode: "docked",
  edge: "top",
  offset: 0.5,
};

export const DEFAULT_PRESENCE: NimbiPresence = {
  idleOpacity: 0.72,
};

export const HORIZONTAL_HOST = { width: 640, height: 300 } as const;
export const VERTICAL_HOST = { width: 300, height: 640 } as const;
export const FLOATING_HORIZONTAL_HOST = { width: 420, height: 300 } as const;
export const FLOATING_VERTICAL_HOST = { width: 300, height: 420 } as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizePlacement(placement: NimbiPlacement): NimbiPlacement {
  if (placement.mode === "docked") {
    return {
      ...placement,
      offset: clamp01(placement.offset),
    };
  }

  return {
    ...placement,
    x: clamp01(placement.x),
    y: clamp01(placement.y),
  };
}

export function normalizePresence(presence: NimbiPresence): NimbiPresence {
  const value = Number.isFinite(presence.idleOpacity)
    ? presence.idleOpacity
    : DEFAULT_PRESENCE.idleOpacity;
  return {
    idleOpacity: clamp(value, 0.25, 1),
  };
}

export function deriveOrientation(
  placement: NimbiPlacement,
  _viewport: ViewportRect,
): NimbiOrientation {
  if (placement.mode === "docked") {
    return placement.edge === "left" || placement.edge === "right"
      ? "vertical"
      : "horizontal";
  }

  return placement.x <= 0.22 || placement.x >= 0.78
    ? "vertical"
    : "horizontal";
}

export function deriveAxisAlignment(value: number): NimbiAxisAlignment {
  const normalizedValue = clamp01(value);
  if (normalizedValue <= 0.25) return "start";
  if (normalizedValue >= 0.75) return "end";
  return "center";
}

export function deriveExpansionDirection(
  placement: NimbiPlacement,
  viewport: ViewportRect,
): NimbiExpansionDirection {
  if (placement.mode === "docked") {
    switch (placement.edge) {
      case "top":
        return "down";
      case "right":
        return "left";
      case "bottom":
        return "up";
      case "left":
        return "right";
    }
  }

  const x = clamp01(placement.x) * viewport.width;
  const y = clamp01(placement.y) * viewport.height;
  const spaces: Array<[NimbiExpansionDirection, number]> = [
    ["left", x],
    ["right", viewport.width - x],
    ["up", y],
    ["down", viewport.height - y],
  ];
  spaces.sort((a, b) => b[1] - a[1]);
  return spaces[0][0];
}

export function placementFromPoint(
  point: Point,
  viewport: ViewportRect,
  threshold = 64,
): NimbiPlacement {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const distances: Array<[NimbiEdge, number]> = [
    ["top", point.y],
    ["right", width - point.x],
    ["bottom", height - point.y],
    ["left", point.x],
  ];
  distances.sort((a, b) => a[1] - b[1]);

  const [edge, distance] = distances[0];
  if (distance <= threshold) {
    const offset =
      edge === "top" || edge === "bottom"
        ? clamp01(point.x / width)
        : clamp01(point.y / height);
    return { mode: "docked", edge, offset };
  }

  return {
    mode: "floating",
    x: clamp01(point.x / width),
    y: clamp01(point.y / height),
  };
}

export function hostRectForPlacement(
  placement: NimbiPlacement,
  viewport: ViewportRect,
): HostRect {
  const normalized = normalizePlacement(placement);
  const orientation = deriveOrientation(normalized, viewport);
  const rawSize =
    normalized.mode === "floating"
      ? orientation === "vertical"
        ? FLOATING_VERTICAL_HOST
        : FLOATING_HORIZONTAL_HOST
      : orientation === "vertical"
        ? VERTICAL_HOST
        : HORIZONTAL_HOST;

  const width = Math.min(rawSize.width, Math.max(1, viewport.width));
  const height = Math.min(rawSize.height, Math.max(1, viewport.height));
  const maxX = Math.max(0, viewport.width - width);
  const maxY = Math.max(0, viewport.height - height);

  let targetX: number;
  let targetY: number;

  if (normalized.mode === "floating") {
    targetX = normalized.x * viewport.width;
    targetY = normalized.y * viewport.height;
  } else {
    switch (normalized.edge) {
      case "top":
        targetX = normalized.offset * viewport.width;
        targetY = 0;
        break;
      case "bottom":
        targetX = normalized.offset * viewport.width;
        targetY = viewport.height;
        break;
      case "left":
        targetX = 0;
        targetY = normalized.offset * viewport.height;
        break;
      case "right":
        targetX = viewport.width;
        targetY = normalized.offset * viewport.height;
        break;
    }
  }

  const x =
    normalized.mode === "docked" && normalized.edge === "left"
      ? 0
      : normalized.mode === "docked" && normalized.edge === "right"
        ? maxX
        : clamp(targetX - width / 2, 0, maxX);

  const y =
    normalized.mode === "docked" && normalized.edge === "top"
      ? 0
      : normalized.mode === "docked" && normalized.edge === "bottom"
        ? maxY
        : clamp(targetY - height / 2, 0, maxY);

  return {
    x,
    y,
    width,
    height,
    anchorX: clamp(targetX - x, 0, width),
    anchorY: clamp(targetY - y, 0, height),
  };
}

export function effectivePresence(
  activity: NimbiActivity,
  idleOpacity: number,
  hovered: boolean,
): number {
  if (hovered) return 1;
  const base = normalizePresence({ idleOpacity }).idleOpacity;

  switch (activity) {
    case "needs-input":
      return 1;
    case "error":
      return Math.max(base, 0.9);
    case "complete":
      return Math.max(base, 0.82);
    case "working":
      return Math.max(base, 0.68);
    case "thinking":
      return Math.max(base, 0.58);
    case "offline":
      return Math.max(0.25, Math.min(base, 0.5));
    case "idle":
      return base;
  }
}
