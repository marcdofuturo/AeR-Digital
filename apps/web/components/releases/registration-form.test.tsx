import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/releases/actions", () => ({ saveRegistrationStatus: vi.fn() }));

import { RegistrationForm } from "./registration-form";

describe("RegistrationForm", () => {
  beforeEach(cleanup);

  it("keeps distribution blank by default and exposes distributor, UPC and ISRC", () => {
    render(
      <RegistrationForm
        releaseId="release-1"
        trackId="track-1"
        kind="distribuicao"
        registration={null}
        distributor=""
        upc="789123456789"
        isrc=""
      />,
    );

    expect(screen.getByLabelText("Distribuidora")).toHaveValue("");
    expect(screen.getByLabelText("Distribuidora")).toHaveAttribute(
      "placeholder",
      "Audiolink Brasil",
    );
    expect(screen.getByLabelText("UPC")).toHaveValue("789123456789");
    expect(screen.getByLabelText("ISRC")).toHaveValue("");
    expect(screen.getByLabelText("Distribuidora")).toBeDisabled();
    expect(screen.getByLabelText("UPC")).toBeDisabled();
    expect(screen.getByLabelText("ISRC")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /editar distribuicao/i }));
    expect(screen.getByLabelText("Distribuidora")).toBeEnabled();
    expect(screen.getByLabelText("UPC")).toBeEnabled();
    expect(screen.getByLabelText("ISRC")).toBeEnabled();
  });

  it("lists every ECAD association for work and phonogram records", () => {
    render(
      <RegistrationForm
        releaseId="release-1"
        trackId="track-1"
        kind="obra_ecad"
        registration={null}
        distributor=""
        upc=""
        isrc=""
      />,
    );

    const association = screen.getByLabelText("Associacao");
    expect(association).toHaveTextContent("Abramus");
    expect(association).toHaveTextContent("Amar");
    expect(association).toHaveTextContent("Assim");
    expect(association).toHaveTextContent("Sbacem");
    expect(association).toHaveTextContent("Sicam");
    expect(association).toHaveTextContent("Socinpro");
    expect(association).toHaveTextContent("UBC");
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
