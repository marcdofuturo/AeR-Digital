import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { KanbanBoard } from "./kanban-board";
import { ReleasesTable } from "./releases-table";
import type { KanbanCardData } from "./kanban-card";

vi.mock("@/app/releases/actions", () => ({
  updateReleaseStage: vi.fn(),
}));

const release: KanbanCardData = {
  id: "release-1",
  title: "Acordei feliz",
  artists: ["Mc Rick", "Mc Lobao"],
  releaseDate: "2026-09-15",
  stage: "em_analise",
  daysInStage: 2,
  stageSince: "2026-08-10T12:00:00.000Z",
  genrePrimary: "Funk",
  coverReceived: true,
  tracks: [
    {
      id: "track-1",
      title: "Acordei feliz",
      isrc: "BR1232600001",
      audioReceived: true,
      durationSec: 156,
      bpm: 130,
      participants: ["Mc Rick", "Mc Lobao"],
    },
  ],
  authorizations: {
    total: 2,
    approved: 1,
    pending: 1,
    rejected: 0,
  },
  registrations: {
    total: 3,
    completed: 1,
    pending: 2,
    rejected: 0,
  },
};

beforeAll(() => {
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
});

async function closeDialog(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole("button", { name: /close/i }));

  await act(async () => {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  });

  expect(dialog).not.toBeInTheDocument();
}

describe("release details dialog", () => {
  it("opens release details when a kanban card is clicked", async () => {
    render(<KanbanBoard releases={[release]} />);

    fireEvent.click(screen.getByText("Acordei feliz"));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Acordei feliz" })).toBeInTheDocument();
    expect(within(dialog).getAllByText("Mc Rick, Mc Lobao").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("BR1232600001")).toBeInTheDocument();
    await closeDialog(dialog);
  });

  it("opens release details when a table row is clicked", async () => {
    render(<ReleasesTable releases={[release]} />);

    fireEvent.click(screen.getByRole("button", { name: /abrir detalhes de acordei feliz/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("1 pendente")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /abrir ficha completa/i })).toHaveAttribute("href", "/releases/release-1");
    await closeDialog(dialog);
  });

  it("does not render missing audio metadata placeholders", async () => {
    render(
      <ReleasesTable
        releases={[
          {
            ...release,
            coverUrl: "received",
            tracks: [
              {
                id: "track-empty",
                title: "Sem metadados",
                isrc: null,
                audioReceived: false,
                durationSec: null,
                bpm: null,
                key: null,
                participants: ["Mc Rick"],
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /abrir detalhes de acordei feliz/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText(/dura.*n\/d/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText("BPM n/d")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("tom n/d")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Iniciou em:")).toBeInTheDocument();
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
    expect(within(dialog).getByText(/capa recebida/i)).toBeInTheDocument();
    await closeDialog(dialog);
  });
});
