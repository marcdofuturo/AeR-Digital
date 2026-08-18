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

  it("guards the optional legacy tenant helper before changing its grants", () => {
    expect(migration).toContain("to_regprocedure('public.auth_tenant_ids(uuid)') is not null");
  });

  it("secures artist child tables through their parent artist tenant", () => {
    expect(migration).not.toContain("'artists', 'artist_aliases', 'artist_contacts'");
    expect(migration).toContain("alter table artist_aliases enable row level security");
    expect(migration).toContain("artist.id = artist_aliases.artist_id");
    expect(migration).toContain("alter table artist_contacts enable row level security");
    expect(migration).toContain("artist.id = artist_contacts.artist_id");
  });

  it("uses the set-returning tenant helper through a valid subquery", () => {
    expect(migration).not.toMatch(/any\s*\(\s*auth_tenant_ids\(\)\s*\)/i);
    expect(migration).toContain("in (select auth_tenant_ids())");
  });
});
