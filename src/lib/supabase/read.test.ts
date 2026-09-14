import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { classifyReadError, readWithRetry } from "./read";

describe("readWithRetry", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));

  it("retries a transient read once and returns the successful result", async () => {
    const read = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST000", status: 503 } })
      .mockResolvedValueOnce({ data: ["ok"], error: null });

    await expect(readWithRetry("test_read", read, { delayMs: 0 })).resolves.toEqual({ data: ["ok"], error: null });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("retries a 504 current_employee read once and succeeds", async () => {
    const read = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "unknown", status: 504 } })
      .mockResolvedValueOnce({ data: { id: "employee-1" }, error: null });

    await expect(readWithRetry("current_employee", read, { delayMs: 0, correlationId: "request-1" }))
      .resolves.toEqual({ data: { id: "employee-1" }, error: null });
    expect(read).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith("supabase_read_failure", expect.objectContaining({
      operation: "current_employee", attempt: 1, status: 504, code: "unknown", correlationId: "request-1",
    }));
  });

  it("retries a status-null transport read failure once", async () => {
    const read = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "unknown", status: null } })
      .mockResolvedValueOnce({ data: ["ok"], error: null });
    await readWithRetry("transport_read", read, { delayMs: 0 });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("does not retry authorization or persistent failures", async () => {
    const read = vi.fn().mockResolvedValue({ data: null, error: { code: "42501", status: 403 } });
    const result = await readWithRetry("protected_read", read);
    expect(result.error?.code).toBe("42501");
    expect(read).toHaveBeenCalledTimes(1);
    expect(classifyReadError(result.error!)).toBe("authorization");
  });

  it("does not retry a mutation even when the failure is transient", async () => {
    const mutation = vi.fn().mockResolvedValue({ data: null, error: { code: "unknown", status: 504 } });
    await readWithRetry("update_employee", mutation, { readOnly: false, delayMs: 0 });
    expect(mutation).toHaveBeenCalledTimes(1);
  });

  it("preserves the second failure after the bounded retry", async () => {
    const read = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "08006", status: 503 } })
      .mockResolvedValueOnce({ data: null, error: { code: "57014", status: 500 } });
    const result = await readWithRetry("failed_read", read, { delayMs: 0 });
    expect(result.error?.code).toBe("57014");
    expect(read).toHaveBeenCalledTimes(2);
  });
});

