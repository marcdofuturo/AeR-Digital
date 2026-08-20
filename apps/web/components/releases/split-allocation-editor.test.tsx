import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/releases/actions", () => ({ saveSplitAllocations: vi.fn() }));

import { SplitAllocationEditor } from "./split-allocation-editor";

describe("SplitAllocationEditor", () => {
  beforeEach(cleanup);

  it("shows each beneficiary share inside the parent and its effective track share", () => {
    render(
      <SplitAllocationEditor
        releaseId="release-1"
        trackId="track-1"
        scope="digital"
        parentArtistId="parent"
        parentArtistName="Grupo"
        parentBps100={1500}
        artists={[
          { id: "a", stageName: "Integrante A" },
          { id: "b", stageName: "Integrante B" },
        ]}
        allocations={[
          { beneficiaryId: "a", bps100: 1000 },
          { beneficiaryId: "b", bps100: 9000 },
        ]}
      />,
    );

    expect(screen.getByText(/Integrante A: 10.00%/)).toHaveTextContent("1.50% do total");
    expect(screen.getByText(/Integrante B: 90.00%/)).toHaveTextContent("13.50% do total");
    fireEvent.click(screen.getByRole("button", { name: /editar integrantes/i }));
    expect(screen.getByText("Total interno: 100.00%")).toHaveClass("text-success");
  });
});
