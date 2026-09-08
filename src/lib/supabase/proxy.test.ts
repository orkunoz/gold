import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), createServerClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("./env", () => ({ getSupabaseEnv: () => ({ url: "https://example.supabase.co", key: "test-key" }) }));
import { updateSession } from "./proxy";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServerClient.mockReturnValue({ auth: { getClaims: mocks.getClaims } });
});

describe("authentication routing", () => {
  it.each(["/", "/dashboard", "/inventory", "/sales"])("protects %s", async (path) => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    const response = await updateSession(new NextRequest(`https://gold.example${path}`));
    expect(response.headers.get("location")).toBe("https://gold.example/login");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("allows login for signed-out users", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    expect((await updateSession(new NextRequest("https://gold.example/login"))).status).toBe(200);
  });

  it("redirects authenticated users away from login and clears query parameters", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "staff" } }, error: null });
    const response = await updateSession(new NextRequest("https://gold.example/login?next=https://evil.example"));
    expect(response.headers.get("location")).toBe("https://gold.example/dashboard");
  });

  it("rejects claims when verification reports an error", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "staff" } }, error: new Error("Expired") });
    const response = await updateSession(new NextRequest("https://gold.example/dashboard"));
    expect(response.headers.get("location")).toBe("https://gold.example/login");
  });

  it.each(["/login", "/dashboard"])("preserves refresh cookies on %s", async (path) => {
    const request = new NextRequest(`https://gold.example${path}`);
    mocks.getClaims.mockImplementation(async () => {
      const options = mocks.createServerClient.mock.calls[0][2];
      options.cookies.setAll([{ name: "sb-auth", value: "refreshed", options: { path: "/", sameSite: "lax", secure: true } }]);
      return { data: { claims: { sub: "staff" } }, error: null };
    });
    const response = await updateSession(request);
    expect(request.cookies.get("sb-auth")?.value).toBe("refreshed");
    expect(response.cookies.get("sb-auth")).toMatchObject({ value: "refreshed", secure: true, sameSite: "lax" });
  });
});
