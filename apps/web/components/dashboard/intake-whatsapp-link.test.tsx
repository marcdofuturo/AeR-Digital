import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntakeWhatsappLink } from "./intake-whatsapp-link";

describe("IntakeWhatsappLink", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("copies the WhatsApp intake link with one click", async () => {
    render(<IntakeWhatsappLink code="A7K9" />);

    const link = "https://wa.me/5511948059297?text=A7K9";
    expect(screen.getByRole("heading", { name: /envie sua música pelo whatsapp/i })).toBeVisible();
    expect(screen.getByText(link)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /copiar link do whatsapp/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(link);
    });
    expect(screen.getByText("Copiado")).toBeVisible();
  });
});

