"use client";

import { motion } from "framer-motion";
import { Repeat } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  parseEventCapture,
  type EventCapture,
} from "@/lib/calendar/parse-event-capture";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

/** Long enough to stop parsing mid-word, short enough to feel live. */
const PARSE_DEBOUNCE_MS = 140;

/**
 * Shared by the input and the highlight layer painted behind it. Any drift
 * between the two misaligns the highlight, so there is exactly one source.
 */
const INPUT_TEXT_CLASS =
  "w-full whitespace-pre bg-transparent px-3 py-2.5 text-h3 font-medium leading-snug tracking-normal";

type EventQuickCaptureFieldProps = {
  /** Raw line, owned here and never written back from the parsed result. */
  value: string;
  onValueChange: (value: string) => void;
  /** Fires on the debounce, after the line has been read. */
  onCapture: (capture: EventCapture) => void;
  fallbackStartsAt: string;
  fallbackEndsAt: string;
  autoFocus?: boolean;
};

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

/**
 * Paints the stretch of the line that became the date, behind a transparent
 * input. This is the promise of the feature: you can see which words were taken
 * before you commit, so the parse can never quietly eat part of your title.
 */
function CaptureHighlightLayer({
  value,
  ranges,
  scrollLeft,
}: {
  value: string;
  ranges: [number, number][];
  scrollLeft: number;
}) {
  const segments = useMemo(() => {
    const parts: { text: string; isConsumed: boolean }[] = [];
    let cursor = 0;

    for (const [start, end] of ranges) {
      if (start > cursor) {
        parts.push({ text: value.slice(cursor, start), isConsumed: false });
      }
      parts.push({ text: value.slice(start, end), isConsumed: true });
      cursor = end;
    }
    if (cursor < value.length) {
      parts.push({ text: value.slice(cursor), isConsumed: false });
    }

    return parts;
  }, [value, ranges]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* This layer is what the user actually reads — the input above it hides
          its own glyphs so the highlight can sit behind the caret. */}
      <div
        className={cn(INPUT_TEXT_CLASS, "text-ink")}
        style={{ transform: `translateX(${-scrollLeft}px)` }}
      >
        {segments.map((segment, index) =>
          segment.isConsumed ? (
            <span key={index} className="event-capture-highlight">
              {segment.text}
            </span>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
      </div>
    </div>
  );
}

function InterpretationChip({
  label,
  value,
  isParsed,
  index,
  isStatic,
}: {
  label: string;
  value: string;
  isParsed: boolean;
  index: number;
  isStatic: boolean;
}) {
  return (
    <motion.span
      initial={isStatic ? false : { opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "inline-flex items-baseline gap-1.5 rounded-lg px-2 py-1 text-product-meta",
        isParsed
          ? "event-capture-chip--parsed"
          : "event-capture-chip--assumed",
      )}
    >
      <span className="text-label uppercase opacity-70">{label}</span>
      <span className="font-medium">{value}</span>
    </motion.span>
  );
}

export function EventQuickCaptureField({
  value,
  onValueChange,
  onCapture,
  fallbackStartsAt,
  fallbackEndsAt,
  autoFocus = false,
}: EventQuickCaptureFieldProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [capture, setCapture] = useState<EventCapture | null>(null);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  // The parse runs on a debounce, and `onCapture` lifts the result into the
  // shared form state. "Now" is read inside the timer rather than during render,
  // so relative phrases resolve against the moment the user stopped typing.
  const onCaptureRef = useRef(onCapture);
  useEffect(() => {
    onCaptureRef.current = onCapture;
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const result = parseEventCapture(value, {
        reference: new Date(),
        fallbackStartsAt,
        fallbackEndsAt,
      });
      setCapture(result);
      onCaptureRef.current(result);
    }, PARSE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [value, fallbackStartsAt, fallbackEndsAt]);

  const hasText = value.trim().length > 0;

  return (
    <div className="flex flex-col">
      <div className="relative">
        {hasText ? (
          <CaptureHighlightLayer
            value={value}
            ranges={capture?.consumedRanges ?? []}
            scrollLeft={scrollLeft}
          />
        ) : null}
        <input
          ref={inputRef}
          value={value}
          onChange={(changeEvent) => onValueChange(changeEvent.target.value)}
          onScroll={(scrollEvent) =>
            setScrollLeft(scrollEvent.currentTarget.scrollLeft)
          }
          placeholder="Design review tomorrow 3-4pm"
          aria-label="Describe the event"
          aria-describedby="event-capture-interpretation"
          autoComplete="off"
          spellCheck={false}
          className={cn(
            INPUT_TEXT_CLASS,
            "relative border-0 text-ink caret-ink outline-none placeholder:font-normal placeholder:text-text-muted focus-visible:outline-none",
            // Transparent glyphs let the highlight layer show through, so the
            // text the user reads is the layer behind — hence the shared class.
            hasText && "text-transparent",
          )}
        />
      </div>

      <div
        id="event-capture-interpretation"
        aria-live="polite"
        className="event-card-divider flex flex-wrap items-center gap-1.5 px-3 py-2"
      >
        {capture && hasText ? (
          <>
            <InterpretationChip
              label="Title"
              value={capture.title || "Needs a title"}
              isParsed={capture.title.length > 0}
              index={0}
              isStatic={prefersReducedMotion}
            />
            <InterpretationChip
              label="Day"
              value={formatDay(capture.startsAt)}
              isParsed={capture.dateSource === "parsed"}
              index={1}
              isStatic={prefersReducedMotion}
            />
            <InterpretationChip
              label="Time"
              value={`${formatTime(capture.startsAt)} · ${formatDuration(capture.durationMinutes)}`}
              isParsed={capture.timeSource === "parsed"}
              index={2}
              isStatic={prefersReducedMotion}
            />
            {capture.recurrenceDetected ? (
              <span className="inline-flex items-center gap-1.5 text-product-meta text-text-secondary">
                <Repeat aria-hidden="true" className="size-3" />
                Repeats aren&apos;t supported yet — saving a single event
              </span>
            ) : null}
          </>
        ) : (
          <p className="text-product-meta text-text-muted">
            Name it, or say when — &ldquo;lunch with Sam at noon&rdquo;. Anything
            you leave out keeps the slot you picked.
          </p>
        )}
      </div>
    </div>
  );
}
