"use client";

import { useRef, useState } from "react";
import { saveRecordProperty } from "@/app/(workspace)/records/[recordId]/actions";

export function RecordTitle({
  recordId,
  propertyId,
  initialTitle,
}: {
  recordId: string;
  propertyId: string;
  initialTitle: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const lastSaved = useRef(initialTitle);

  async function commit() {
    const next = title.trim() || "Untitled";
    setTitle(next);
    if (next === lastSaved.current) return;
    lastSaved.current = next;
    await saveRecordProperty({
      recordId,
      propertyId,
      rawValue: next,
    });
  }

  return (
    <input
      value={title}
      onChange={(event) => setTitle(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      aria-label="Record title"
      placeholder="Untitled"
      className="w-full bg-transparent text-h1 outline-none placeholder:text-text-muted"
    />
  );
}
