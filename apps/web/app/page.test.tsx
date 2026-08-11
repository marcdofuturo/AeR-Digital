import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/dashboard/stats-grid", () => ({
  StatsGrid: () => <div data-testid="stats-grid" />,
}));

vi.mock("@/components/dashboard/catalog-growth-chart", () => ({
  CatalogGrowthChart: () => <div data-testid="catalog-growth" />,
}));

vi.mock("@/components/dashboard/pipeline-funnel", () => ({
  PipelineFunnel: () => <div data-testid="pipeline-funnel" />,
}));

vi.mock("@/components/dashboard/urgent-tasks", () => ({
  UrgentTasks: () => <div data-testid="urgent-tasks" />,
}));

vi.mock("@/lib/data/dashboard", () => ({
  getCatalogGrowth: vi.fn().mockResolvedValue([]),
  getPipelineFunnel: vi.fn().mockResolvedValue([]),
  getRecentActivity: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/tenant", () => ({
  getTenant: vi.fn().mockResolvedValue({
    name: "Selo de teste",
    plan: "trial",
    intake_code: "TST",
  }),
}));

import Page from "./page";

describe("Page", () => {
  it("renders the dashboard shell with the current tenant", async () => {
    render(await Page());

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeDefined();
    expect(screen.getByText("Selo de teste")).toBeDefined();
    expect(screen.getByTestId("stats-grid")).toBeDefined();
  });
});
