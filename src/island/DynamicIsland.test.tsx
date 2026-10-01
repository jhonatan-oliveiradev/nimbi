import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NIMBI_FIXTURES } from "../telemetry/fixtures";
import type { NimbiPlacement, WorkArea } from "../placement/placement";
import { DynamicIsland } from "./DynamicIsland";
import type { IslandMode } from "./island-machine";

describe("DynamicIsland", () => {
  it("keeps idle minimal with no dashboard metrics", () => {
    const { container } = render(
      <DynamicIsland snapshot={NIMBI_FIXTURES.idle} mode="idle" />,
    );

    expect(screen.getByTestId("nimbi-cloud")).toBeInTheDocument();
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

  it("feeds pointer movement into the Nimbi character", () => {
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

    render(<DynamicIsland snapshot={NIMBI_FIXTURES.idle} mode="idle" />);
    fireEvent.pointerMove(screen.getByTestId("nimbi-island"), {
      clientX: 390,
      clientY: 20,
    });

    expect(screen.getByTestId("nimbi-cloud")).not.toHaveAttribute(
      "data-gaze-x",
      "0",
    );
    rectSpy.mockRestore();
  });

  it("uses the character bounds rather than the whole island for gaze", () => {
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        const isCharacter = this.classList.contains("nimbi-island__character");
        return {
          x: isCharacter ? 14 : 0,
          y: 0,
          width: isCharacter ? 48 : 292,
          height: isCharacter ? 36 : 48,
          top: 0,
          right: isCharacter ? 62 : 292,
          bottom: isCharacter ? 36 : 48,
          left: isCharacter ? 14 : 0,
          toJSON: () => ({}),
        } as DOMRect;
      });

    render(<DynamicIsland snapshot={NIMBI_FIXTURES.working} mode="compact" />);
    fireEvent.pointerMove(screen.getByTestId("nimbi-island"), {
      clientX: 62,
      clientY: 18,
    });

    expect(Number(screen.getByTestId("nimbi-cloud").getAttribute("data-gaze-x"))).toBeGreaterThan(
      0.8,
    );
    rectSpy.mockRestore();
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
    expect(screen.getByTestId("nimbi-cloud")).toHaveAttribute(
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

  it("renders Cloudee as the primary avatar and preserves tap versus drag", () => {
    const onAvatarTap = vi.fn();
    const onAvatarGrab = vi.fn();
    const onAvatarDragging = vi.fn();
    const onAvatarRelease = vi.fn();
    const onToggle = vi.fn();

    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.thinking}
        mode="compact"
        behavior="thinking"
        onAvatarTap={onAvatarTap}
        onAvatarGrab={onAvatarGrab}
        onAvatarDragging={onAvatarDragging}
        onAvatarRelease={onAvatarRelease}
        onToggle={onToggle}
      />,
    );

    const avatar = screen.getByRole("img", { name: "Nimbi: thinking" });
    expect(avatar).toHaveAttribute("data-avatar", "cloudee");

    const character = screen.getByTestId("nimbi-character");
    fireEvent.pointerDown(character, { clientX: 100, clientY: 10, pointerId: 1 });
    expect(onAvatarGrab).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(character, { clientX: 105, clientY: 10, pointerId: 1 });
    expect(onAvatarDragging).not.toHaveBeenCalled();
    fireEvent.pointerMove(character, { clientX: 107, clientY: 10, pointerId: 1 });
    expect(onAvatarDragging).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(character, { clientX: 120, clientY: 40, pointerId: 1 });
    expect(onAvatarRelease).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("nimbi-island"));
    expect(onAvatarTap).not.toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
  });

});
