import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../migrations/003_task_zero_panel_hardening.sql", import.meta.url),
);
const migration = readFileSync(migrationPath, "utf8");

describe("task zero migration security", () => {
  it("does not leave a permissive write policy on presentation jobs", () => {
    expect(migration).not.toContain("create policy presentation_jobs_tenant_rw");
    expect(migration).toContain("'pitches', 'tasks', 'presentation_jobs'");
    expect(migration).toContain("membership.role in ('owner', 'ar')");
  });

  it("keeps webhook reply mutation restricted to the service role", () => {
    expect(migration).toContain(
      "revoke all on function apply_authorization_reply(text, text, jsonb, text, boolean)",
    );
    expect(migration).toContain(
      "grant execute on function apply_authorization_reply(text, text, jsonb, text, boolean)\n  to service_role;",
    );
  });
});
