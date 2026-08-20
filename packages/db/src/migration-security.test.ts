import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../migrations/003_task_zero_panel_hardening.sql", import.meta.url),
);
const migration = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const repairMigrationPath = fileURLToPath(
  new URL("../migrations/004_task_zero_review_repairs.sql", import.meta.url),
);
const repairMigration = readFileSync(repairMigrationPath, "utf8").replace(/\r\n/g, "\n");
const productHardeningMigrationPath = fileURLToPath(
  new URL("../migrations/005_media_pitch_activity_hardening.sql", import.meta.url),
);
const productHardeningMigration = readFileSync(productHardeningMigrationPath, "utf8").replace(
  /\r\n/g,
  "\n",
);
const artistRolesMigrationPath = fileURLToPath(
  new URL("../migrations/006_artist_roles_split_allocations.sql", import.meta.url),
);
const artistRolesMigration = readFileSync(artistRolesMigrationPath, "utf8").replace(/\r\n/g, "\n");

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

  it("limits task uniqueness to automatic stage tasks", () => {
    expect(migration).toContain("tasks_tenant_release_stage_kind_uidx");
    expect(migration).toContain("where kind like 'stage:%'");
    expect(migration).toContain(
      "on conflict (tenant_id, release_id, kind) where kind like 'stage:%'",
    );
    expect(repairMigration).toContain("drop index if exists tasks_tenant_release_kind_uidx");
    expect(repairMigration).toContain("tasks_tenant_release_stage_kind_uidx");
  });

  it("updates authorization emails through a tenant-scoped service RPC", () => {
    expect(repairMigration).toContain("function save_authorization_recipient_email(");
    expect(repairMigration).toContain("authz.release_id = p_release_id");
    expect(repairMigration).not.toMatch(/join authorizations authorization\b/);
    expect(repairMigration).toContain("artist.tenant_id = p_tenant_id");
    expect(repairMigration).toContain(
      "revoke all on function save_authorization_recipient_email(uuid, uuid, uuid, text)",
    );
    expect(repairMigration).toContain(
      "grant execute on function save_authorization_recipient_email(uuid, uuid, uuid, text) to service_role",
    );
  });

  it("prevents authenticated owners from granting another owner role directly", () => {
    expect(repairMigration).toContain("role in ('ar', 'financeiro', 'viewer')");
  });

  it("binds cached audio analysis and media versions to the stored file", () => {
    expect(productHardeningMigration).toContain("audio_analysis_source_url text");
    expect(productHardeningMigration).toContain("audio_updated_at timestamptz");
    expect(productHardeningMigration).toContain("cover_updated_at timestamptz");
  });

  it("charges only jobs explicitly marked with a credit cost", () => {
    expect(productHardeningMigration).toContain("credit_cost smallint not null default 2");
    expect(productHardeningMigration).toContain("claimed_job.credit_cost");
    expect(productHardeningMigration).toContain("char_length(option_a) <= 500");
  });

  it("logs completed AI presentations without exposing the transcript or storage URL", () => {
    expect(productHardeningMigration).toContain("insert into activity_log");
    expect(productHardeningMigration).toContain("'Apresentacao com IA gerada'");
    expect(productHardeningMigration).not.toContain("lyrics_transcript");
  });

  it("stores ECAD separately from ISWC and ISRC registration identifiers", () => {
    expect(productHardeningMigration).toContain("add column if not exists ecad_code text");
  });

  it("removes the distributor default and supports all three billing roles", () => {
    expect(artistRolesMigration).toContain("alter column distributor drop default");
    expect(artistRolesMigration).toMatch(
      /update registrations[\s\S]*kind = 'distribuicao'[\s\S]*lower\(btrim\(entity\)\)/,
    );
    expect(artistRolesMigration).toContain("'principal', 'primary', 'featuring'");
    expect(artistRolesMigration).toContain("when position = 1 then 'principal'");
  });

  it("secures nested split allocations and validates their parent total", () => {
    expect(artistRolesMigration).toContain("create table if not exists split_allocations");
    expect(artistRolesMigration).toContain(
      "alter table split_allocations enable row level security",
    );
    expect(artistRolesMigration).toContain("total not in (0, 10000)");
    expect(artistRolesMigration).toContain("beneficiary.tenant_id = p_tenant_id");
    expect(artistRolesMigration).toContain(
      "grant execute on function replace_split_allocations(uuid, uuid, text, uuid, jsonb) to service_role",
    );
  });

  it("updates participant order and roles through a tenant-scoped service RPC", () => {
    expect(artistRolesMigration).toContain("function replace_track_participant_credits(");
    expect(artistRolesMigration).toContain("track.tenant_id = p_tenant_id");
    expect(artistRolesMigration).toContain("item->>'billing_role' = 'principal'");
    expect(artistRolesMigration).toContain(
      "grant execute on function replace_track_participant_credits(uuid, uuid, jsonb) to service_role",
    );
  });

  it("updates artist identity and primary contacts atomically", () => {
    expect(artistRolesMigration).toContain("function save_artist_profile(");
    expect(artistRolesMigration).toContain("artist.tenant_id = p_tenant_id");
    expect(artistRolesMigration).toContain("contact.is_primary");
    expect(artistRolesMigration).toContain(
      "grant execute on function save_artist_profile(uuid, uuid, text, text, text, text, text)",
    );
  });
});
