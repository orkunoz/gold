import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signOut: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: mocks }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
import { signIn, signOut } from "./actions";

function credentials(username = "staff", password = "test-password") {
  const data = new FormData();
  data.set("username", username);
  data.set("password", password);
  return data;
}

beforeEach(() => vi.clearAllMocks());

describe("auth actions", () => {
  it("rejects invalid input before contacting Supabase", async () => {
    expect((await signIn({ error: "" }, credentials("invalid", ""))).error).toBeTruthy();
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });
  it("returns a generic failure without provider details", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: "User not found" } });
    const state = await signIn({ error: "" }, credentials());
    expect(state.error).toContain("Unable to sign in");
    expect(state.error).not.toContain("User not found");
  });
  it("signs in, invalidates cached layouts and redirects", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    await expect(signIn({ error: "" }, credentials(" Staff "))).rejects.toThrow("REDIRECT:/dashboard");
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "staff@internal.local", password: "test-password" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("signs out only the current session and redirects", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    await expect(signOut()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("does not report successful sign-out on failure", async () => {
    mocks.signOut.mockResolvedValue({ error: new Error("offline") });
    await expect(signOut()).rejects.toThrow("Unable to sign out");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
