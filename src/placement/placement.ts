export type DockEdge = "top" | "right" | "bottom" | "left";
export type NimbiOrientation = "horizontal" | "vertical";
export type ExpansionDirection = "down" | "up" | "left" | "right";

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export interface WorkArea extends Rect {
  monitorId?: string;
}

export type NimbiPlacement =
  | {
      mode: "docked";
      monitorId: string;
      edge: DockEdge;
      offset: number;
    }
  | {
      mode: "floating";
      monitorId: string;
      x: number;
      y: number;
    };

export const DEFAULT_PLACEMENT: NimbiPlacement = {
  mode: "docked",
  monitorId: "primary",
  edge: "top",
  offset: 0.5,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function orientationForPlacement(
  placement: NimbiPlacement,
): NimbiOrientation {
  if (placement.mode === "floating") return "horizontal";
  return placement.edge === "left" || placement.edge === "right"
    ? "vertical"
    : "horizontal";
}

function monitorIdFor(area: WorkArea): string {
  return area.monitorId ?? "current";
}

function normalizedOffset(
  edge: DockEdge,
  point: Point,
  area: WorkArea,
): number {
  if (edge === "top" || edge === "bottom") {
    return clamp01((point.x - area.x) / area.width);
  }
  return clamp01((point.y - area.y) / area.height);
}

export function snapPlacement(
  point: Point,
  area: WorkArea,
  previous?: NimbiPlacement,
  threshold = 56,
): NimbiPlacement {
  const distances: Record<DockEdge, number> = {
    top: Math.abs(point.y - area.y),
    right: Math.abs(area.x + area.width - point.x),
    bottom: Math.abs(area.y + area.height - point.y),
    left: Math.abs(point.x - area.x),
  };

  const eligible = (Object.entries(distances) as [DockEdge, number][])
    .filter(([, distance]) => distance <= threshold)
    .sort((a, b) => a[1] - b[1]);

  if (eligible.length) {
    const nearestDistance = eligible[0][1];
    const tied = eligible
      .filter(([, distance]) => Math.abs(distance - nearestDistance) < 0.0001)
      .map(([edge]) => edge);

    let edge = tied[0];
    if (
      previous?.mode === "docked" &&
      tied.includes(previous.edge)
    ) {
      edge = previous.edge;
    } else {
      edge =
        tied.find((candidate) => candidate === "top" || candidate === "bottom") ??
        tied[0];
    }

    return {
      mode: "docked",
      monitorId: monitorIdFor(area),
      edge,
      offset: normalizedOffset(edge, point, area),
    };
  }

  return {
    mode: "floating",
    monitorId: monitorIdFor(area),
    x: clamp01((point.x - area.x) / area.width),
    y: clamp01((point.y - area.y) / area.height),
  };
}

export function clampPlacement(
  placement: NimbiPlacement,
  area: WorkArea,
  surface: Size,
): NimbiPlacement {
  if (placement.mode === "docked") {
    const alongLength =
      placement.edge === "top" || placement.edge === "bottom"
        ? area.width
        : area.height;
    const surfaceLength =
      placement.edge === "top" || placement.edge === "bottom"
        ? surface.width
        : surface.height;
    const half = Math.min(0.5, surfaceLength / 2 / alongLength);

    return {
      ...placement,
      offset: Math.min(1 - half, Math.max(half, placement.offset)),
    };
  }

  const halfX = Math.min(0.5, surface.width / 2 / area.width);
  const halfY = Math.min(0.5, surface.height / 2 / area.height);

  return {
    ...placement,
    x: Math.min(1 - halfX, Math.max(halfX, placement.x)),
    y: Math.min(1 - halfY, Math.max(halfY, placement.y)),
  };
}

export function expansionDirection(
  placement: NimbiPlacement,
  area: WorkArea,
  surface: Rect,
): ExpansionDirection {
  if (placement.mode === "docked") {
    switch (placement.edge) {
      case "top":
        return "down";
      case "bottom":
        return "up";
      case "left":
        return "right";
      case "right":
        return "left";
    }
  }

  const spaces: Array<[ExpansionDirection, number]> = [
    ["down", area.y + area.height - (surface.y + surface.height)],
    ["right", area.x + area.width - (surface.x + surface.width)],
    ["left", surface.x - area.x],
    ["up", surface.y - area.y],
  ];

  spaces.sort((a, b) => b[1] - a[1]);
  return spaces[0][0];
}
