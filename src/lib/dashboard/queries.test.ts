import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { getDashboardReport } from "./queries";

const report = { role: "owner", kpis: {}, recent_sales: [], shops: [] };

describe("getDashboardReport", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  });

  it("starts the owner report and profit reads without a waterfall", async () => {
    let releaseReport!: () => void;
    const reportResult = new Promise<{ data: typeof report; error: null }>(resolve => { releaseReport = () => resolve({ data: report, error: null }); });
    mocks.rpc.mockImplementation((name: string) => name === "get_dashboard_report" ? reportResult : Promise.resolve({ data: { net_profit: 12 }, error: null }));

    const pending = getDashboardReport("THIS_MONTH", null, null, null, "owner");
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2));
    releaseReport();
    await expect(pending).resolves.toMatchObject({ profit: { net_profit: 12 } });
  });

  it("keeps the core dashboard available when optional profit fails", async () => {
    mocks.rpc.mockImplementation((name: string) => name === "get_dashboard_report"
      ? Promise.resolve({ data: { ...report }, error: null })
      : Promise.resolve({ data: null, error: { code: "22000", status: 400 } }));

    await expect(getDashboardReport("THIS_MONTH", null, null, null, "owner")).resolves.toMatchObject({ role: "owner" });
  });

  it("does not request owner-only profit for a salesperson", async () => {
    mocks.rpc.mockResolvedValue({ data: { role: "salesperson", kpis: {}, recent_sales: [] }, error: null });
    await getDashboardReport("THIS_MONTH", "shop", null, null, "salesperson");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});

