"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string };

export async function signIn(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 ||
      !password || password.length > 4096) {
    return { error: "Enter a valid email address and password." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
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
