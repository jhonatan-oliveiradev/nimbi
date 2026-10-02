import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NIMBI_FIXTURES } from "../telemetry/fixtures";
import type { NimbiPlacement, WorkArea } from "../placement/placement";
import type { NimbiBehaviorEvents } from "../behavior/use-nimbi-behavior";
import {
  CONTENT_ENTER_DELAY_MS,
  CONTENT_EXIT_MS,
  DynamicIsland,
} from "./DynamicIsland";
import type { IslandMode } from "./island-machine";

describe("DynamicIsland", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createBehaviorEvents = (): NimbiBehaviorEvents => ({
    onHoverStart: vi.fn(),
    onHoverEnd: vi.fn(),
    onTap: vi.fn(),
    onGrab: vi.fn(),
    onDragging: vi.fn(),
    onRelease: vi.fn(),
    onDragCancel: vi.fn(),
  });
  it("keeps idle minimal with no dashboard metrics", () => {
    const { container } = render(
      <DynamicIsland snapshot={NIMBI_FIXTURES.idle} mode="idle" />,
    );

    expect(screen.getByTestId("nimbi-avatar")).toBeInTheDocument();
    expect(screen.queryByTestId("nimbi-status")).toBeNull();
    expect(container.querySelector("[data-metric]")).toBeNull();
  });

  it("shows one concise status line while working", () => {
    render(
      <DynamicIsland snapshot={NIMBI_FIXTURES.working} mode="compact" />,
    );

    expect(screen.getByTestId("nimbi-status")).toHaveTextContent(
      "Codex is working",
    );
  });

  it("shows known attribution in compact state", () => {
    render(
      <DynamicIsland snapshot={NIMBI_FIXTURES.working} mode="compact" />,
    );

    expect(screen.getByTestId("nimbi-meta")).toHaveTextContent(
      "openai · gpt-5.6 · nimbi",
    );
  });

  it("renders attribution only when it is known", () => {
    const snapshot = {
      ...NIMBI_FIXTURES.working,
      provider: undefined,
      model: undefined,
      project: undefined,
    };
    render(<DynamicIsland snapshot={snapshot} mode="compact" />);

    expect(screen.queryByTestId("nimbi-meta")).toBeNull();
  });

  it("marks preview attention UI as fixture-only", () => {
    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES["needs-input"]}
        mode="attention"
        fixtureOnly
      />,
    );

    const attention = screen.getByTestId("nimbi-attention");
    expect(attention).toHaveAttribute("data-fixture-only", "true");
    expect(attention).toHaveTextContent("Claude needs your attention");
  });

  it("keeps offline muted without opening an alert", () => {
    render(
      <DynamicIsland snapshot={NIMBI_FIXTURES.offline} mode="idle" />,
    );

    const shell = screen.getByTestId("nimbi-island");
    expect(shell).toHaveAttribute("data-muted", "true");
    expect(screen.queryByTestId("nimbi-attention")).toBeNull();
  });

  it("reports rendered island bounds to the native shell", () => {
    const onBoundsChange = vi.fn();
    const rectSpy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      x: 242,
      y: 0,
      width: 156,
      height: 40,
      top: 0,
      right: 398,
      bottom: 40,
      left: 242,
      toJSON: () => ({}),
    } as DOMRect);

    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="idle"
        onBoundsChange={onBoundsChange}
      />,
    );

    expect(onBoundsChange).toHaveBeenCalledWith({
      x: 242,
      y: 0,
      width: 156,
      height: 40,
    });
    rectSpy.mockRestore();
  });

  it("reflows vertically when docked on the right edge", () => {
    const placement: NimbiPlacement = {
      mode: "docked",
      monitorId: "preview",
      edge: "right",
      offset: 0.5,
    };
    const workArea: WorkArea = { x: 0, y: 0, width: 1000, height: 700 };
    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.working}
        mode="compact"
        placement={placement}
        workArea={workArea}
      />,
    );

    const island = screen.getByTestId("nimbi-island");
    expect(island).toHaveAttribute("data-orientation", "vertical");
    expect(island).toHaveAttribute("data-edge", "right");
    expect(island).toHaveAttribute("data-expansion", "left");
  });

  it("starts relocation only from the cloud character", () => {
    const placement: NimbiPlacement = {
      mode: "docked",
      monitorId: "preview",
      edge: "top",
      offset: 0.5,
    };
    const workArea: WorkArea = { x: 0, y: 0, width: 1000, height: 700 };
    const preview = vi.fn();

    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="idle"
        placement={placement}
        workArea={workArea}
        onPlacementPreview={preview}
      />,
    );

    fireEvent.pointerDown(screen.getByTestId("nimbi-island"), {
      clientX: 500,
      clientY: 10,
    });
    fireEvent.pointerMove(screen.getByTestId("nimbi-island"), {
      clientX: 530,
      clientY: 100,
    });
    expect(preview).not.toHaveBeenCalled();

    const character = screen.getByTestId("nimbi-character");
    fireEvent.pointerDown(character, { clientX: 500, clientY: 10 });
    fireEvent.pointerMove(character, { clientX: 530, clientY: 100 });
    expect(preview).toHaveBeenCalled();
  });

  it("separates grab from dragging at the existing 6 px threshold", () => {
    const placement: NimbiPlacement = {
      mode: "docked",
      monitorId: "preview",
      edge: "top",
      offset: 0.5,
    };
    const workArea: WorkArea = { x: 0, y: 0, width: 1000, height: 700 };
    const events = createBehaviorEvents();

    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="idle"
        behavior="idle"
        behaviorEvents={events}
        placement={placement}
        workArea={workArea}
      />,
    );

    const character = screen.getByTestId("nimbi-character");
    fireEvent.pointerDown(character, { clientX: 500, clientY: 10 });
    expect(events.onGrab).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(character, { clientX: 503, clientY: 10 });
    expect(events.onDragging).not.toHaveBeenCalled();

    fireEvent.pointerUp(character, { clientX: 503, clientY: 10 });
    expect(events.onDragCancel).toHaveBeenCalledTimes(1);
    expect(events.onRelease).not.toHaveBeenCalled();
  });

  it("commits placement before the release reaction and suppresses the drag click", () => {
    const placement: NimbiPlacement = {
      mode: "docked",
      monitorId: "preview",
      edge: "top",
      offset: 0.5,
    };
    const workArea: WorkArea = { x: 0, y: 0, width: 1000, height: 700 };
    const order: string[] = [];
    const events = createBehaviorEvents();
    (events.onRelease as ReturnType<typeof vi.fn>).mockImplementation(() => {
      order.push("release");
    });
    const commit = vi.fn(() => {
      order.push("commit");
    });

    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="idle"
        behavior="idle"
        behaviorEvents={events}
        placement={placement}
        workArea={workArea}
        onPlacementCommit={commit}
      />,
    );

    const character = screen.getByTestId("nimbi-character");
    fireEvent.pointerDown(character, { clientX: 500, clientY: 10 });
    fireEvent.pointerMove(character, { clientX: 530, clientY: 100 });
    expect(events.onDragging).toHaveBeenCalledTimes(1);

    fireEvent.pointerUp(character, { clientX: 530, clientY: 100 });
    expect(order).toEqual(["commit", "release"]);

    fireEvent.click(screen.getByTestId("nimbi-island"));
    expect(events.onTap).not.toHaveBeenCalled();
  });

  it("keeps content fully opaque while only the character uses passive opacity", () => {
    const placement: NimbiPlacement = {
      mode: "floating",
      monitorId: "preview",
      x: 0.5,
      y: 0.5,
    };
    const workArea: WorkArea = { x: 0, y: 0, width: 1000, height: 700 };

    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.working}
        mode="compact"
        placement={placement}
        workArea={workArea}
        passiveOpacity={0.2}
      />,
    );

    expect(screen.getByTestId("nimbi-island")).toHaveStyle({ opacity: "1" });
    expect(screen.getByTestId("nimbi-avatar")).toHaveAttribute(
      "data-effective-opacity",
      "0.65",
    );
  });


  it("keeps floating expanded geometry clamped inside the preview work area", () => {
    const placement: NimbiPlacement = {
      mode: "floating",
      monitorId: "preview",
      x: 0.06,
      y: 0.5,
    };
    const workArea: WorkArea = { x: 0, y: 0, width: 1000, height: 700 };

    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="expanded"
        placement={placement}
        workArea={workArea}
      />,
    );

    const island = screen.getByTestId("nimbi-island") as HTMLElement;
    expect(island.style.left).toContain("clamp(");
    expect(island.style.top).toContain("clamp(");
  });

  it("shows compact Presence controls in expanded mode", () => {
    const opacityChange = vi.fn();
    const resetPlacement = vi.fn();

    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="expanded"
        passiveOpacity={0.72}
        onPassiveOpacityChange={opacityChange}
        onResetPlacement={resetPlacement}
      />,
    );

    const slider = screen.getByRole("slider", { name: "Nimbi opacity" });
    expect(slider).toHaveValue("72");
    fireEvent.change(slider, { target: { value: "45" } });
    expect(opacityChange).toHaveBeenCalledWith(0.45);

    fireEvent.click(screen.getByRole("button", { name: "Reset position" }));
    expect(resetPlacement).toHaveBeenCalledTimes(1);
  });

  it("keeps the avatar mounted while the shell opens and closes", () => {
    const { rerender } = render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="idle"
        reducedMotion={false}
      />,
    );
    const avatar = screen.getByTestId("nimbi-avatar");

    rerender(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="expanded"
        reducedMotion={false}
      />,
    );

    expect(screen.getByTestId("nimbi-avatar")).toBe(avatar);

    act(() => {
      vi.advanceTimersByTime(CONTENT_ENTER_DELAY_MS);
    });

    rerender(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="idle"
        reducedMotion={false}
      />,
    );

    expect(screen.getByTestId("nimbi-avatar")).toBe(avatar);

    act(() => {
      vi.advanceTimersByTime(CONTENT_EXIT_MS);
    });

    expect(screen.getByTestId("nimbi-avatar")).toBe(avatar);
  });

  it("expands the shell before expanded content enters", () => {
    const { rerender } = render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="idle"
        reducedMotion={false}
      />,
    );

    rerender(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="expanded"
        reducedMotion={false}
      />,
    );

    const island = screen.getByTestId("nimbi-island");
    expect(island).toHaveAttribute("data-mode", "expanded");
    expect(island).toHaveAttribute("data-content-phase", "hidden");
    expect(screen.queryByTestId("nimbi-details")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(CONTENT_ENTER_DELAY_MS - 1);
    });
    expect(screen.queryByTestId("nimbi-details")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(island).toHaveAttribute("data-content-phase", "visible");
    expect(screen.getByTestId("nimbi-details")).toBeInTheDocument();
  });

  it("exits content before the shell contracts", () => {
    const { rerender } = render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="expanded"
        reducedMotion={false}
      />,
    );

    const island = screen.getByTestId("nimbi-island");
    expect(island).toHaveAttribute("data-mode", "expanded");
    expect(screen.getByTestId("nimbi-details")).toBeInTheDocument();

    rerender(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="idle"
        reducedMotion={false}
      />,
    );

    expect(island).toHaveAttribute("data-mode", "expanded");
    expect(island).toHaveAttribute("data-content-phase", "exiting");
    expect(screen.getByTestId("nimbi-details")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(CONTENT_EXIT_MS - 1);
    });
    expect(island).toHaveAttribute("data-mode", "expanded");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(island).toHaveAttribute("data-mode", "idle");
    expect(island).toHaveAttribute("data-content-phase", "hidden");
    expect(screen.queryByTestId("nimbi-details")).toBeNull();
  });

  it("skips staged content delays when reduced motion is enabled", () => {
    const { rerender } = render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="idle"
        reducedMotion
      />,
    );

    rerender(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="expanded"
        reducedMotion
      />,
    );

    const island = screen.getByTestId("nimbi-island");
    expect(island).toHaveAttribute("data-mode", "expanded");
    expect(island).toHaveAttribute("data-content-phase", "visible");
    expect(screen.getByTestId("nimbi-details")).toBeInTheDocument();

    rerender(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="idle"
        reducedMotion
      />,
    );

    expect(island).toHaveAttribute("data-mode", "idle");
    expect(island).toHaveAttribute("data-content-phase", "hidden");
    expect(screen.queryByTestId("nimbi-details")).toBeNull();
  });

  it.each<IslandMode>([
    "hidden",
    "idle",
    "compact",
    "attention",
    "expanded",
  ])("exposes the %s shell mode", (mode) => {
    render(<DynamicIsland snapshot={NIMBI_FIXTURES.idle} mode={mode} />);
    expect(screen.getByTestId("nimbi-island")).toHaveAttribute(
      "data-mode",
      mode,
    );
  });
});


describe("DynamicIsland action surface", () => {
  it("renders a Cloudee-anchored composer and keeps the avatar mounted", () => {
    const onActionDraftChange = vi.fn();
    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="expanded"
        reducedMotion
        actionState={{ status: "composing", draft: "", mode: "general" }}
        onActionDraftChange={onActionDraftChange}
      />,
    );

    expect(screen.getByTestId("nimbi-avatar")).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "Ask Nimbi" });
    expect(input).toHaveAttribute("placeholder", "Ask Nimbi…");
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: "check build" } });
    expect(onActionDraftChange).toHaveBeenCalledWith("check build");
  });

  it("uses Enter to submit, Shift+Enter for a newline, and Escape to close", () => {
    const onActionSubmit = vi.fn();
    const onActionClose = vi.fn();
    const { rerender } = render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="expanded"
        reducedMotion
        actionState={{ status: "composing", draft: "hello", mode: "general" }}
        onActionSubmit={onActionSubmit}
        onActionClose={onActionClose}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Ask Nimbi" });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onActionSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onActionSubmit).toHaveBeenCalledTimes(1);

    rerender(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="expanded"
        reducedMotion
        actionState={{ status: "composing", draft: "hello", mode: "general" }}
        onActionSubmit={onActionSubmit}
        onActionClose={onActionClose}
      />,
    );
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Ask Nimbi" }), {
      key: "Escape",
    });
    expect(onActionClose).toHaveBeenCalledTimes(1);
  });

  it("surfaces needs-input context with a contextual reply field", () => {
    const onActionOpen = vi.fn();
    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES["needs-input"]}
        mode="attention"
        reducedMotion
        actionState={{ status: "idle" }}
        onActionOpen={onActionOpen}
      />,
    );

    expect(screen.getByText("Claude needs your attention")).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "Reply to Claude" });
    fireEvent.pointerDown(input);
    expect(onActionOpen).toHaveBeenCalledWith("contextual");
    expect(screen.queryByRole("button", { name: "Allow" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Deny" })).toBeNull();
  });

  it("presents sending, response, and retry states without chat history", () => {
    const { rerender } = render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="expanded"
        reducedMotion
        actionState={{ status: "sending", text: "check build" }}
      />,
    );
    expect(screen.getByTestId("nimbi-action-surface")).toHaveTextContent(
      "Sending…",
    );
    expect(screen.queryByRole("textbox")).toBeNull();

    rerender(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="expanded"
        reducedMotion
        actionState={{ status: "response", text: "Build started." }}
      />,
    );
    expect(screen.getByTestId("nimbi-action-surface")).toHaveTextContent(
      "Build started.",
    );
    expect(screen.queryByText("check build")).toBeNull();

    const onActionRetry = vi.fn();
    rerender(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="expanded"
        reducedMotion
        actionState={{
          status: "error",
          message: "NX Agent is unavailable",
          draft: "check build",
        }}
        canActionRetry
        onActionRetry={onActionRetry}
      />,
    );
    expect(screen.getByDisplayValue("check build")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onActionRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the action surface attached in right-edge vertical docking", () => {
    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES["needs-input"]}
        mode="attention"
        reducedMotion
        placement={{
          mode: "docked",
          monitorId: "preview",
          edge: "right",
          offset: 0.5,
        }}
        workArea={{ x: 0, y: 0, width: 1000, height: 700 }}
        actionState={{ status: "composing", draft: "yes", mode: "contextual" }}
      />,
    );

    const island = screen.getByTestId("nimbi-island");
    expect(island).toHaveAttribute("data-orientation", "vertical");
    expect(screen.getByTestId("nimbi-action-surface")).toBeInTheDocument();
    expect(screen.getByTestId("nimbi-avatar")).toBeInTheDocument();
  });
});