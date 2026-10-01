import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NimbiApp } from "./NimbiApp";

describe("NimbiApp", () => {
  it("renders the semantic Nimbi island shell", () => {
    render(<NimbiApp />);
    const island = screen.getByTestId("nimbi-island");
    expect(island).toHaveAccessibleName("Nimbi");
  });
});
