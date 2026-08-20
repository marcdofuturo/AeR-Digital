import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/releases/actions", () => ({ saveRegistrationStatus: vi.fn() }));

import { RegistrationForm } from "./registration-form";

describe("RegistrationForm", () => {
  it("locks distribution data and uses the release distributor and UPC", () => {
    render(
      <RegistrationForm
        releaseId="release-1"
        trackId="track-1"
        kind="distribuicao"
        registration={null}
        distributor="Audiolink Brasil"
        upc="789123456789"
        isrc=""
      />,
    );

    expect(screen.getByLabelText("Distribuidora")).toHaveValue("Audiolink Brasil");
    expect(screen.getByLabelText("UPC")).toHaveValue("789123456789");
    expect(screen.getByLabelText("Distribuidora")).toBeDisabled();
    expect(screen.getByLabelText("UPC")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /editar distribuicao/i }));
    expect(screen.getByLabelText("Distribuidora")).toBeEnabled();
    expect(screen.getByLabelText("UPC")).toBeEnabled();
  });

  it("uses the track ISRC in the phonogram record", () => {
    render(
      <RegistrationForm
        releaseId="release-1"
        trackId="track-1"
        kind="fonograma_ecad"
        registration={null}
        distributor="Audiolink Brasil"
        upc=""
        isrc="BR-AAA-26-00001"
      />,
    );

    expect(screen.getByLabelText("ISRC")).toHaveValue("BR-AAA-26-00001");
    expect(screen.getByLabelText("ISRC")).toBeDisabled();
  });
});
