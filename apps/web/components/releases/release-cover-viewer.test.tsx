import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReleaseCoverViewer } from "./release-cover-viewer";

describe("ReleaseCoverViewer", () => {
  it("opens the cover in-page with zoom and a same-origin download", () => {
    render(
      <ReleaseCoverViewer
        title="Acordei feliz"
        available
        previewUrl="/api/releases/release-1/media?kind=cover"
        downloadUrl="/api/releases/release-1/media?kind=cover&download=1"
      />,
    );

    expect(document.body.textContent).not.toContain("supabase.co");
    fireEvent.click(screen.getByRole("button", { name: /visualizar capa/i }));

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("img", { name: /capa de acordei feliz/i })).toHaveAttribute(
      "src",
      "/api/releases/release-1/media?kind=cover",
    );
    expect(screen.getByRole("button", { name: /ampliar/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /reduzir/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /baixar capa/i })).toHaveAttribute(
      "href",
      "/api/releases/release-1/media?kind=cover&download=1",
    );
    expect(screen.getByRole("link", { name: /baixar capa/i })).not.toHaveAttribute("target");
  });
});
