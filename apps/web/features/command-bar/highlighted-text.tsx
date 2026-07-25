import type { ReactNode } from "react";

/** Renders `text` with fuzzy-match spans emphasized (Spotlight / Notion / Linear style). */
export function HighlightedText({
  text,
  ranges,
}: {
  text: string;
  ranges: [number, number][];
}) {
  if (ranges.length === 0) return <>{text}</>;

  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const [start, end] of ranges) {
    if (start > cursor) {
      parts.push(text.slice(cursor, start));
    }
    parts.push(
      <span key={`${start}-${end}`} className="spotlight-match">
        {text.slice(start, end)}
      </span>,
    );
    cursor = end;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <>{parts}</>;
}
