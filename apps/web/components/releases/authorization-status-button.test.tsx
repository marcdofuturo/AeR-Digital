import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/releases/actions", () => ({
  setAuthorizationRecipientStatus: vi.fn(),
}));

import { AuthorizationStatusButton } from "./authorization-status-button";

describe("AuthorizationStatusButton", () => {
  it("allows an approved recipient to return to pending", () => {
    const { container } = render(
      <AuthorizationStatusButton releaseId="release-1" recipientId="recipient-1" approved />,
    );

    expect(screen.getByRole("button", { name: /marcar pendente/i })).toBeVisible();
    expect(container.querySelector('input[name="status"]')).toHaveValue("pendente");
  });

  it("allows a pending recipient to be approved", () => {
    const { container } = render(
      <AuthorizationStatusButton releaseId="release-1" recipientId="recipient-1" approved={false} />,
    );

    expect(screen.getByRole("button", { name: /marcar ok/i })).toBeVisible();
    expect(container.querySelector('input[name="status"]')).toHaveValue("aprovado");
  });
});
