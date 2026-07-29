"use client"

import { useId, useMemo, useState } from "react"
import Wheel from "@uiw/react-color-wheel"
import {
  hexToHsva,
  hsvaToHex,
  type HsvaColor,
} from "@uiw/color-convert"
import type { CalendarColorValue } from "@planevo/core/types/calendar"
import {
  CALENDAR_PALETTE,
  isCustomCalendarColor,
  normalizeCalendarColor,
} from "@/lib/calendar/calendar-color"
import {
  CalendarColorDot,
  calendarColorStyle,
} from "./calendar-color-dot"

export function CalendarColorPicker({
  value,
  onChange,
  label = "Calendar color",
}: {
  value: CalendarColorValue
  onChange: (value: CalendarColorValue) => void
  label?: string
}) {
  const [customOpen, setCustomOpen] = useState(
    isCustomCalendarColor(value),
  )
  const [customHex, setCustomHex] = useState<`#${string}` | null>(
    isCustomCalendarColor(value) ? value : null,
  )
  const [hexDraft, setHexDraft] = useState(
    isCustomCalendarColor(value) ? value : "",
  )
  const wheelInstructionsId = useId()

  function toggleCustomPicker() {
    if (customOpen) {
      setCustomOpen(false)
      return
    }
    if (!customHex) {
    const token = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue("--color-calendar-sky")
      .trim()
    const normalized = normalizeCalendarColor(token)
      if (normalized && isCustomCalendarColor(normalized)) {
        setCustomHex(normalized)
        setHexDraft(normalized)
      }
    }
    setCustomOpen(true)
  }

  const hsva = useMemo<HsvaColor | null>(
    () => (customHex ? hexToHsva(customHex) : null),
    [customHex],
  )
  const normalizedDraft = normalizeCalendarColor(hexDraft)
  const draftIsValid =
    normalizedDraft !== null && isCustomCalendarColor(normalizedDraft)

  function commitCustom(next: string) {
    const normalized = normalizeCalendarColor(next)
    if (!normalized || !isCustomCalendarColor(normalized)) return
    setCustomHex(normalized)
    setHexDraft(normalized)
    onChange(normalized)
  }

  function adjustWithKeyboard(
    event: React.KeyboardEvent<HTMLDivElement>,
  ) {
    if (!hsva) return
    const delta = event.shiftKey ? 10 : 3
    let next: HsvaColor | null = null
    if (event.key === "ArrowLeft") {
      next = { ...hsva, h: (hsva.h - delta + 360) % 360 }
    } else if (event.key === "ArrowRight") {
      next = { ...hsva, h: (hsva.h + delta) % 360 }
    } else if (event.key === "ArrowUp") {
      next = { ...hsva, s: Math.min(100, hsva.s + delta) }
    } else if (event.key === "ArrowDown") {
      next = { ...hsva, s: Math.max(0, hsva.s - delta) }
    }
    if (!next) return
    event.preventDefault()
    commitCustom(hsvaToHex(next))
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-product-meta font-medium text-ink">
        {label}
      </legend>
      <div
        className="grid grid-cols-4 gap-1.5 sm:grid-cols-8"
        role="radiogroup"
      >
        {CALENDAR_PALETTE.map(({ key, label: colorLabel }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            aria-label={colorLabel}
            onClick={() => {
              setCustomOpen(false)
              onChange(key)
            }}
            className={`flex size-11 items-center justify-center rounded-full border outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink sm:size-8 ${
              value === key
                ? "border-border-strong bg-surface-raised"
                : "border-transparent"
            }`}
          >
            <CalendarColorDot
              color={key}
              size="picker"
              selected={value === key}
            />
          </button>
        ))}
      </div>

      <div
        aria-live="polite"
        style={{
          ...calendarColorStyle(value),
          backgroundColor: "var(--calendar-event-color)",
          color: "var(--calendar-event-text)",
        }}
        className="calendar-color-event-preview rounded-[var(--radius-calendar-event)] px-3 py-2"
      >
        <span className="block text-label opacity-75">
          3:00 PM – 4:00 PM
        </span>
        <span className="block truncate text-product-body font-medium">
          Event preview
        </span>
      </div>

      <button
        type="button"
        aria-expanded={customOpen}
        onClick={toggleCustomPicker}
        className="min-h-11 self-start text-product-meta font-medium text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Custom color
      </button>

      {customOpen && customHex && hsva ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-3">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Custom color wheel"
            aria-valuetext={customHex}
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(hsva.h)}
            aria-describedby={wheelInstructionsId}
            onKeyDown={adjustWithKeyboard}
            className="self-center rounded-full outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Wheel
              color={hsva}
              onChange={({ hsva: next }) => commitCustom(hsvaToHex(next))}
            />
          </div>
          <p id={wheelInstructionsId} className="sr-only">
            Use left and right arrows for hue, up and down arrows for
            saturation. Hold Shift for larger steps.
          </p>
          <label className="flex flex-col gap-1 text-product-meta text-text-secondary">
            Hex color
            <input
              value={hexDraft}
              onChange={(event) => {
                const next = event.target.value
                setHexDraft(next)
                const normalized = normalizeCalendarColor(next)
                if (
                  normalized &&
                  isCustomCalendarColor(normalized)
                ) {
                  setCustomHex(normalized)
                  onChange(normalized)
                }
              }}
              onBlur={() => {
                if (draftIsValid) commitCustom(hexDraft)
              }}
              aria-invalid={hexDraft.length > 0 && !draftIsValid}
              className="rounded-md border border-border bg-paper px-2 py-1.5 font-mono text-product-body uppercase text-ink outline-none focus-visible:border-border-strong"
            />
          </label>
          {hexDraft.length > 0 && !draftIsValid ? (
            <p role="alert" className="text-product-meta text-brick">
              Enter a six-digit hex color.
            </p>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  )
}
