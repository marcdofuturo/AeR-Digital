import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditableActionForm } from "./editable-action-form";

describe("EditableActionForm", () => {
  it("keeps persisted fields locked until Edit and locks them again after Save", async () => {
    const action = vi.fn(async () => undefined);

    render(
      <EditableActionForm action={action} editLabel="Editar email" saveLabel="Salvar email">
        <label>
          Email
          <input name="email" defaultValue="contato@example.com" />
        </label>
      </EditableActionForm>,
    );

    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Salvar email" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Editar email" }));
    expect(screen.getByLabelText("Email")).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "novo@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar email" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByLabelText("Email")).toBeDisabled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Editar email" })).toBeVisible());
  });
});
