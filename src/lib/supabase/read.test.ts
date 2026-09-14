import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { classifyReadError, readWithRetry } from "./read";

describe("readWithRetry", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));

  it("retries a transient read once and returns the successful result", async () => {
    const read = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST000", status: 503 } })
      .mockResolvedValueOnce({ data: ["ok"], error: null });

    await expect(readWithRetry("test_read", read)).resolves.toEqual({ data: ["ok"], error: null });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("does not retry authorization or persistent failures", async () => {
    const read = vi.fn().mockResolvedValue({ data: null, error: { code: "42501", status: 403 } });
    const result = await readWithRetry("protected_read", read);
    expect(result.error?.code).toBe("42501");
    expect(read).toHaveBeenCalledTimes(1);
    expect(classifyReadError(result.error!)).toBe("authorization");
  });

  it("preserves the second failure after the bounded retry", async () => {
    const read = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "08006", status: 503 } })
      .mockResolvedValueOnce({ data: null, error: { code: "57014", status: 500 } });
    const result = await readWithRetry("failed_read", read);
    expect(result.error?.code).toBe("57014");
    expect(read).toHaveBeenCalledTimes(2);
  });
});

