import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isDevDataAccessEnabled } from "@/utils/supabase/admin";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — Planevo" };

export default async function LoginPage() {
  if (isDevDataAccessEnabled()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="text-h2 lowercase tracking-tight">planevo</span>
          <div>
            <h1 className="text-h2">Welcome to Planevo</h1>
            <p className="mt-1 text-small text-text-secondary">
              The workspace that&rsquo;s ready before you are.
            </p>
          </div>
        </div>
        <div className="rounded-card border border-border bg-surface-raised p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
