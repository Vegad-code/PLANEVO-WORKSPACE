"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { authenticate, type AuthFormState } from "../actions";

const INITIAL_STATE: AuthFormState = { status: "idle", message: null };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 w-full rounded-lg bg-marigold px-4 text-small font-medium text-ink outline-none transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50 motion-reduce:transition-none"
    >
      {pending ? "One moment…" : label}
    </button>
  );
}

export function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [state, formAction] = useActionState(authenticate, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="intent" value={mode} />

      <label className="block">
        <span className="text-label uppercase text-text-muted">Email</span>
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="mt-2 h-10 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-body outline-none placeholder:text-text-muted focus:border-ink"
        />
      </label>

      <label className="block">
        <span className="text-label uppercase text-text-muted">Password</span>
        <input
          required
          type="password"
          name="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          minLength={mode === "sign-up" ? 8 : undefined}
          placeholder={mode === "sign-up" ? "At least 8 characters" : "Your password"}
          className="mt-2 h-10 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-body outline-none placeholder:text-text-muted focus:border-ink"
        />
      </label>

      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-brick-tint px-3 py-2 text-small text-ink">
          {state.message}
        </p>
      )}
      {state.status === "confirm-email" && (
        <p role="status" className="rounded-lg bg-meadow-tint px-3 py-2 text-small text-ink">
          {state.message}
        </p>
      )}

      <SubmitButton label={mode === "sign-in" ? "Sign in" : "Create account"} />

      <p className="text-center text-small text-text-secondary">
        {mode === "sign-in" ? "New to Planevo?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          className="font-medium text-ink underline underline-offset-2 outline-none hover:no-underline focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {mode === "sign-in" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
