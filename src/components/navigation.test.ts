import { describe, expect, it } from "vitest";
import { navigationLinks } from "./navigation";

describe("navigation access", () => {
  it("does not expose Pricing to owners or salespeople", () => {
    expect(navigationLinks("owner").map((link) => link.href)).not.toContain("/pricing");
    expect(navigationLinks("salesperson").map((link) => link.href)).not.toContain("/pricing");
  });

  it("preserves Owner administration access", () => {
    expect(navigationLinks("owner").map((link) => link.href)).toContain("/admin");
    expect(navigationLinks("salesperson").map((link) => link.href)).not.toContain("/admin");
  });
});
