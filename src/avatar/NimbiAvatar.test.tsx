import { render, screen } from "@testing-library/react";
import { useImperativeHandle, type Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NimbiAvatar } from "./NimbiAvatar";

const runtime = vi.hoisted(() => ({
  play: vi.fn(() => ({ ok: true })),
  setExpression: vi.fn(() => ({ ok: true })),
  pause: vi.fn(),
  stop: vi.fn(),
  getState: vi.fn(() => ({
    status: "stopped",
    activeExpression: "neutral",
  })),
  shouldThrow: false,
}));

vi.mock("@bible-strong/avatar-react", () => ({
  Avatar: ({
    ref,
    ariaLabel,
    style,
  }: {
    ref?: Ref<unknown>;
    ariaLabel?: string;
    style?: React.CSSProperties;
  }) => {
    if (runtime.shouldThrow) throw new Error("runtime exploded");
    useImperativeHandle(ref, () => ({
      play: runtime.play,
      setExpression: runtime.setExpression,
      pause: runtime.pause,
      stop: runtime.stop,
      getState: runtime.getState,
    }));
    return (
      <div data-testid="cloudee-runtime" aria-label={ariaLabel} style={style} />
    );
  },
}));

describe("NimbiAvatar", () => {
  beforeEach(() => {
    runtime.shouldThrow = false;
    runtime.play.mockClear();
    runtime.setExpression.mockClear();
    runtime.pause.mockClear();
    runtime.stop.mockClear();
    runtime.getState.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Cloudee with an accessible Nimbi label", () => {
    render(
      <NimbiAvatar
        behavior="idle"
        activity="idle"
        reducedMotion={false}
        passiveOpacity={0.72}
        interaction="passive"
      />,
    );

    expect(screen.getByLabelText("Nimbi: idle")).toBeInTheDocument();
    expect(screen.getByTestId("cloudee-runtime")).toBeInTheDocument();
  });

  it("does not restart the same runtime target on an unchanged rerender", () => {
    const view = render(
      <NimbiAvatar
        behavior="thinking"
        activity="thinking"
        reducedMotion={false}
        passiveOpacity={0.72}
        interaction="passive"
      />,
    );

    expect(runtime.play).toHaveBeenCalledTimes(1);
    expect(runtime.play).toHaveBeenLastCalledWith("thinking");

    view.rerender(
      <NimbiAvatar
        behavior="thinking"
        activity="thinking"
        reducedMotion={false}
        passiveOpacity={0.72}
        interaction="passive"
      />,
    );

    expect(runtime.play).toHaveBeenCalledTimes(1);
  });

  it("issues a new runtime command when semantic behavior changes", () => {
    const view = render(
      <NimbiAvatar
        behavior="idle"
        activity="idle"
        reducedMotion={false}
        passiveOpacity={0.72}
        interaction="passive"
      />,
    );

    view.rerender(
      <NimbiAvatar
        behavior="needs-input"
        activity="needs-input"
        reducedMotion={false}
        passiveOpacity={0.72}
        interaction="passive"
      />,
    );

    expect(runtime.play).toHaveBeenCalledWith("idle");
    expect(runtime.setExpression).toHaveBeenCalledWith("attentive-left");
  });

  it("uses the reduced-motion target from the adapter", () => {
    render(
      <NimbiAvatar
        behavior="tap"
        activity="idle"
        reducedMotion
        passiveOpacity={0.72}
        interaction="hover"
      />,
    );

    expect(runtime.setExpression).toHaveBeenCalledWith("playful-right");
    expect(runtime.play).not.toHaveBeenCalled();
  });

  it("pauses the Cloudee runtime while hidden and restores the current target when shown", () => {
    const view = render(
      <NimbiAvatar
        behavior="working"
        activity="working"
        reducedMotion={false}
        passiveOpacity={0.72}
        interaction="passive"
        hidden={false}
      />,
    );

    expect(runtime.play).toHaveBeenCalledWith("working");

    view.rerender(
      <NimbiAvatar
        behavior="working"
        activity="working"
        reducedMotion={false}
        passiveOpacity={0.72}
        interaction="passive"
        hidden
      />,
    );

    expect(runtime.pause).toHaveBeenCalledTimes(1);

    view.rerender(
      <NimbiAvatar
        behavior="working"
        activity="working"
        reducedMotion={false}
        passiveOpacity={0.72}
        interaction="passive"
        hidden={false}
      />,
    );

    expect(runtime.play).toHaveBeenCalledTimes(2);
    expect(runtime.play).toHaveBeenLastCalledWith("working");
  });

  it("falls back to the existing static cloud if the avatar runtime throws", () => {
    runtime.shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <NimbiAvatar
        behavior="working"
        activity="working"
        reducedMotion={false}
        passiveOpacity={0.2}
        interaction="passive"
      />,
    );

    const fallback = screen.getByTestId("nimbi-cloud");
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveAttribute("data-effective-opacity", "0.65");
    expect(fallback.closest('[data-testid="nimbi-avatar"]')).toBeNull();
  });
});
