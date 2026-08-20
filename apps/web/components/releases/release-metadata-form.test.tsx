import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/releases/actions", () => ({ saveReleaseOverview: vi.fn() }));

import { ReleaseMetadataForm } from "./release-metadata-form";

describe("ReleaseMetadataForm", () => {
  it("requires confirmation before saving a changed release date", () => {
    render(
      <ReleaseMetadataForm
        releaseId="release-1"
        data={{
          title: "Acordei feliz",
          releaseDate: "2026-09-15",
          genrePrimary: "Funk",
          genreSecondary: "",
          distributor: "Audiolink Brasil",
          upc: "",
          albumIdExt: "",
        }}
        coverAvailable={false}
      />,
    );

    expect(screen.getByLabelText("Data")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /editar visão geral/i }));
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-09-20" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar visão geral/i }));

    expect(screen.getByRole("dialog", { name: /confirmar nova data/i })).toBeVisible();
    expect(screen.getByText(/15\/09\/2026/)).toBeVisible();
    expect(screen.getByText(/20\/09\/2026/)).toBeVisible();
    expect(screen.getByRole("button", { name: /salvar nova data/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /manter data anterior/i })).toBeVisible();
  });
});
