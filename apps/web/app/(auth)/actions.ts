"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { bootstrapWorkspace } from "@/app/(workspace)/actions";

export type AuthFormState = {
  status: "idle" | "error" | "confirm-email";
  message: string | null;
};

export async function authenticate(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const intent = formData.get("intent");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { status: "error", message: "Email and password are required." };
  }
  if (intent === "sign-up" && password.length < 8) {
    return { status: "error", message: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();

  if (intent === "sign-up") {
    const origin = (await headers()).get("origin");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: origin ? { emailRedirectTo: `${origin}/auth/callback` } : undefined,
    });
    if (error) return { status: "error", message: error.message };

    if (!data.session) {
      return {
        status: "confirm-email",
        message: "Check your email for a confirmation link to finish signing up.",
      };
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { status: "error", message: error.message };
  }

  // First sign-in has no workspace yet; failures fall through to the
  // create-workspace screen rendered by the workspace layout.
  await bootstrapWorkspace();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
