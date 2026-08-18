import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationFeedback } from "./navigation-feedback";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/releases"),
  useSearchParams: vi.fn(() => new URLSearchParams(window.location.search)),
}));

describe("NavigationFeedback", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.history.replaceState({}, "", "/releases");
  });

  it("shows progress immediately for internal navigation", () => {
    render(
      <>
        <NavigationFeedback />
        <a href="/artists" onClick={(event) => event.preventDefault()}>Artistas</a>
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Artistas" }));

    expect(screen.getByRole("progressbar", { name: "Carregando pagina" })).toBeInTheDocument();
  });

  it("does not intercept external links", () => {
    render(
      <>
        <NavigationFeedback />
        <a href="https://example.com" onClick={(event) => event.preventDefault()}>Externo</a>
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Externo" }));

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows progress for a query-only navigation", () => {
    render(
      <>
        <NavigationFeedback />
        <a href="/releases?stage=em_analise" onClick={(event) => event.preventDefault()}>
          Filtrar em analise
        </a>
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Filtrar em analise" }));

    expect(screen.getByRole("progressbar", { name: "Carregando pagina" })).toBeInTheDocument();
  });

  it("does not show page progress for a fragment-only link", () => {
    render(
      <>
        <NavigationFeedback />
        <a href="/releases#metadados" onClick={(event) => event.preventDefault()}>Metadados</a>
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Metadados" }));

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
