import { Icon } from "@/components/ui/planevo-icon";
import { startAiConversation } from "./actions";

const PROMPTS = [
  "Summarize what changed in my workspace this week",
  "Find the tasks that have dates but no priority",
  "Draft a report using my workspace files",
] as const;

export default function AiWelcomePage() {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto mt-auto w-full text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-slate bg-slate-tint text-ink"><Icon name="ai" className="size-6" /></span>
        <p className="mt-6 text-label uppercase text-text-muted">Planevo AI</p>
        <h1 className="mt-2 text-h1">Ask across your workspace</h1>
        <p className="mx-auto mt-3 max-w-xl text-body text-text-secondary">Open a conversation only when it helps. Your workspace remains the product; AI is an optional layer over your pages, databases, and files.</p>
        <div className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-3">
          {PROMPTS.map((prompt) => <div key={prompt} className="rounded-xl border border-border bg-surface-raised p-4 text-left text-small text-text-secondary">{prompt}</div>)}
        </div>
      </div>
      <form action={startAiConversation} className="mx-auto mt-8 w-full max-w-2xl">
        <button type="submit" className="flex min-h-14 w-full items-center gap-3 rounded-card border border-slate bg-slate-tint px-4 text-left text-body text-text-secondary outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"><Icon name="ai" className="size-5" /><span>Start a workspace conversation</span><span className="ml-auto text-small text-text-muted">Open</span></button>
      </form>
      <p className="mx-auto mt-3 mb-auto w-full max-w-2xl text-center text-small text-text-muted">
        Answers are coming soon — conversations you start are saved to this workspace, and the
        model layer arrives with the credit system.
      </p>
    </div>
  );
}
