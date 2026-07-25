"use client";

import { useState } from "react";
import type { HomeData } from "@/lib/queries/home";
import { createPageAndOpen } from "@/app/(workspace)/actions";
import { ActionCard } from "@/features/home/action-card";
import { PlanevoComposer } from "@/features/home/planevo-composer";
import { TaskComposer } from "@/features/tasks/task-composer";

const CHIPS = [
  { id: "all", label: "All" },
  { id: "workspace", label: "Workspace" },
  { id: "tasks", label: "Tasks" },
  { id: "files", label: "Files" },
  { id: "agents", label: "Agents" },
] as const;

type ChipId = (typeof CHIPS)[number]["id"];
type CardCategory = Exclude<ChipId, "all">;

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeCommandCenter({ data }: { data: HomeData }) {
  const [chip, setChip] = useState<ChipId>("all");
  const firstName = data.userName?.trim().split(/\s+/)[0] || null;
  const greeting = greetingForNow();
  const show = (category: CardCategory) => chip === "all" || chip === category;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-5 py-6 sm:px-8">
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={chip === item.id}
            onClick={() => setChip(item.id)}
            className={`h-8 rounded-full border px-4 text-small font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
              chip === item.id
                ? "border-ink bg-surface-raised text-ink"
                : "border-border bg-paper text-text-secondary hover:border-border-strong hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-center py-10">
        <div className="text-center">
          {/* Greeting is time-of-day; suppress the rare server/client hour-boundary mismatch. */}
          <h1 className="text-h1" suppressHydrationWarning>
            {firstName ? `${greeting}, ${firstName}` : greeting}
          </h1>
          <p className="mt-2 text-h3 font-normal text-text-secondary">
            What do you want to organize today?
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {show("workspace") && (
            <ActionCard
              icon="page"
              title="Create new page"
              description="Start writing freely."
              formAction={createPageAndOpen}
            />
          )}
          {show("tasks") && (
            <TaskComposer
              workspaceId={data.workspaceId}
              trigger={(open) => (
                <ActionCard
                  icon="tasks"
                  title="Add new task"
                  description="Capture something to do."
                  onClick={open}
                />
              )}
            />
          )}
          {show("workspace") && (
            <ActionCard
              icon="canvas"
              title="Open workspace"
              description="Build with pages, databases, and records."
              href="/workspace"
            />
          )}
          {show("files") && (
            <ActionCard
              icon="upload"
              title="Upload first file"
              description="Turn documents into sources."
              href="/files"
            />
          )}
          {show("agents") && (
            <ActionCard
              icon="calendar"
              title="Connect calendar"
              description="Bring dates into Planevo."
              href="/integrations"
            />
          )}
          {show("files") && (
            <ActionCard
              icon="import"
              title="Import from Notion"
              description="Move your workspace in."
              href="/settings?section=export"
            />
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl pb-2">
        <PlanevoComposer />
      </div>
    </div>
  );
}
