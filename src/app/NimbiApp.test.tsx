import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NIMBI_FIXTURES } from "../telemetry/fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const invokeMock = vi.hoisted(() => vi.fn());
const listenMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

import { NimbiApp } from "./NimbiApp";

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation((command: string) => {
    if (command === "get_nimbi_snapshot") {
      return Promise.resolve(NIMBI_FIXTURES.idle);
    }
    if (command === "get_preferences") {
      return Promise.resolve({
        version: 1,
        placement: {
          mode: "docked",
          monitorId: "primary",
          edge: "top",
          offset: 0.5,
        },
        presence: { passiveOpacity: 0.72 },
      });
    }
    return Promise.resolve(undefined);
  });
  listenMock.mockReset();
  listenMock.mockResolvedValue(() => {});
});

afterEach(() => {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe("NimbiApp", () => {
  it("renders the semantic Nimbi island shell", () => {
    render(<NimbiApp />);
    const island = screen.getByTestId("nimbi-island");
    expect(island).toHaveAccessibleName("Nimbi");
  });

  it("feeds semantic behavior and hover notice into the island", () => {
    render(
      <NimbiApp snapshot={NIMBI_FIXTURES.idle} mode="idle" reducedMotion />,
    );

    const island = screen.getByTestId("nimbi-island");
    expect(island).toHaveAttribute("data-behavior", "idle");

    fireEvent.pointerEnter(island);
    expect(island).toHaveAttribute("data-behavior", "notice");
  });

  it("keeps presence controls accessible from the island shell", async () => {
    render(<NimbiApp snapshot={NIMBI_FIXTURES.idle} reducedMotion />);

    fireEvent.click(screen.getByTestId("nimbi-island"));

    expect(
      await screen.findByRole("slider", { name: "Nimbi opacity" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Ask Nimbi" })).toBeNull();
  });

  it("opens the general composer when idle Nimbi is clicked", () => {
    render(<NimbiApp snapshot={NIMBI_FIXTURES.idle} reducedMotion />);

    fireEvent.click(screen.getByTestId("nimbi-character"));

    expect(screen.getByRole("textbox", { name: "Ask Nimbi" })).toBeInTheDocument();
    expect(screen.getByTestId("nimbi-avatar")).toBeInTheDocument();
  });

  it("submits the idle composer through the injected action client", async () => {
    const actionSubmit = vi.fn().mockResolvedValue({
      accepted: true,
      response: "Build started.",
    });
    render(
      <NimbiApp
        snapshot={NIMBI_FIXTURES.idle}
        reducedMotion
        actionSubmit={actionSubmit}
      />,
    );

    fireEvent.click(screen.getByTestId("nimbi-character"));
    const input = screen.getByRole("textbox", { name: "Ask Nimbi" });
    fireEvent.change(input, { target: { value: "check build" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(actionSubmit).toHaveBeenCalledWith({
        type: "prompt",
        text: "check build",
      }),
    );
    expect(await screen.findByText("Build started.")).toBeInTheDocument();
  });

  it("keeps real needs-input attention ahead of a short action response", async () => {
    const actionSubmit = vi.fn().mockResolvedValue({
      accepted: true,
      response: "Starting.",
    });
    const { rerender } = render(
      <NimbiApp
        snapshot={NIMBI_FIXTURES.idle}
        reducedMotion
        actionSubmit={actionSubmit}
      />,
    );

    fireEvent.click(screen.getByTestId("nimbi-character"));
    const input = screen.getByRole("textbox", { name: "Ask Nimbi" });
    fireEvent.change(input, { target: { value: "work" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("Starting.")).toBeInTheDocument();

    rerender(
      <NimbiApp
        snapshot={NIMBI_FIXTURES["needs-input"]}
        reducedMotion
        actionSubmit={actionSubmit}
      />,
    );

    expect(await screen.findByText("Claude needs your attention")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply to Claude" })).toBeInTheDocument();
    expect(screen.queryByText("Starting.")).toBeNull();
  });

  it("restores native passive interaction after closing the composer", async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    render(
      <NimbiApp
        reducedMotion
        actionSubmit={vi.fn().mockResolvedValue({ accepted: true })}
      />,
    );

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("get_nimbi_snapshot"),
    );

    fireEvent.click(screen.getByTestId("nimbi-character"));
    const input = await screen.findByRole("textbox", { name: "Ask Nimbi" });

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("set_interactive", {
        interactive: true,
      }),
    );

    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => {
      const interactionCalls = invokeMock.mock.calls.filter(
        ([command]) => command === "set_interactive",
      );
      expect(interactionCalls.at(-1)?.[1]).toEqual({ interactive: false });
    });
  });

  it("uses listening as the idle baseline while expanded", () => {
    render(
      <NimbiApp snapshot={NIMBI_FIXTURES.idle} mode="expanded" reducedMotion />,
    );

    expect(screen.getByTestId("nimbi-island")).toHaveAttribute(
      "data-behavior",
      "listening",
    );
  });
});