import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CTA_ROUTES = [
  ["Novo artista", "artists/new/page.tsx"],
  ["Novo lancamento", "releases/new/page.tsx"],
  ["Notificacoes", "config/notificacoes/page.tsx"],
] as const;

describe("CTA routes", () => {
  it.each(CTA_ROUTES)("%s points to an implemented route", async (_label, routeFile) => {
    await expect(
      fs.access(path.join(__dirname, routeFile)),
    ).resolves.toBeUndefined();
  });
});
