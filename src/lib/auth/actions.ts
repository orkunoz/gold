"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string };

export async function signIn(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const username = formData.get("username");
  const password = formData.get("password");
  const normalized = typeof username === "string" ? username.trim().toLowerCase() : "";
  if (typeof password !== "string" || !/^[a-z0-9][a-z0-9_-]{2,31}$/.test(normalized) ||
      !password || password.length > 4096) {
    return { error: "Unable to sign in. Check your credentials and try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: `${normalized}@internal.local`, password });
  if (error) return { error: "Unable to sign in. Check your credentials and try again." };
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Unable to sign out. Please try again.");
  revalidatePath("/", "layout");
  redirect("/login");
}
