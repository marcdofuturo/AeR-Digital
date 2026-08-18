import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const AUTHENTICATED_DATA_ROUTES = [
  "app/page.tsx",
  "app/artists/page.tsx",
  "app/inbox/page.tsx",
  "app/inbox/[id]/page.tsx",
  "app/releases/page.tsx",
  "app/tarefas/page.tsx",
  "components/dashboard/urgent-tasks.tsx",
];

describe("authenticated data routes", () => {
  it.each(AUTHENTICATED_DATA_ROUTES)(
    "does not stream tenant data through an inner Suspense boundary in %s",
    (file) => {
      const source = readFileSync(file, "utf8");

      expect(source).not.toContain("<Suspense");
    },
  );
});
