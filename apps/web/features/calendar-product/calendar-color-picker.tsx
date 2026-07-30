"use client"

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { Plus } from "lucide-react"
import Wheel from "@uiw/react-color-wheel"
import {
  hexToHsva,
  hsvaToHex,
  type HsvaColor,
} from "@uiw/color-convert"
import type { CalendarColorValue } from "@planevo/core/types/calendar"
import {
  CALENDAR_PALETTE,
  DEFAULT_CALENDAR_COLOR,
  isCustomCalendarColor,
  normalizeCalendarColor,
} from "@/lib/calendar/calendar-color"
import {
  calendarColorPickerMountsColorWheel,
  calendarColorPickerMountsQuickDropdown,
  type CalendarColorPickerVariant,
} from "@/lib/calendar/calendar-color-picker-variant"
import {
  COLOR_WHEEL_NARROW_MAX_WIDTH_PX,
  getColorWheelPanelGapPx,
  getColorWheelPosition,
  getColorWheelSizePx,
  preferredColorWheelSideForAnchor,
  readColorWheelPanelSize,
  resolveColorWheelAnchorElement,
  type ColorWheelPosition,
} from "@/lib/calendar/color-wheel-position"
import {
  CalendarColorDot,
  calendarColorStyle,
} from "./calendar-color-dot"

export type { CalendarColorPickerVariant }

function seedCustomHexFromToken(): `#${string}` | null {
  const token = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-calendar-${DEFAULT_CALENDAR_COLOR}`)
    .trim()
  const normalized = normalizeCalendarColor(token)
  return normalized && isCustomCalendarColor(normalized) ? normalized : null
}

/**
 * Named swatches stay inline.
 * - `full` (Details): custom color opens the side-docked wheel.
 * - `quick`: compact “add your color” dropdown (hex + native picker) — no wheel.
 */
export function CalendarColorPicker({
  value,
  onChange,
  label = "Calendar color",
  variant = "full",
  onCustomOpenChange,
}: {
  value: CalendarColorValue
  onChange: (value: CalendarColorValue) => void
  label?: string
  variant?: CalendarColorPickerVariant
  /** Lets parent Escape handlers skip while custom UI owns dismiss. */
  onCustomOpenChange?: (open: boolean) => void
}) {
  const isQuick = variant === "quick"
  const [customOpen, setCustomOpen] = useState(false)
  const [customHex, setCustomHex] = useState<`#${string}` | null>(
    isCustomCalendarColor(value) ? value : null,
  )
  const [hexDraft, setHexDraft] = useState(
    isCustomCalendarColor(value) ? value : "",
  )
  const [isNarrow, setIsNarrow] = useState(false)
  const [position, setPosition] = useState<ColorWheelPosition | null>(null)
  const [wheelSizePx, setWheelSizePx] = useState(160)
  const [portalReady, setPortalReady] = useState(false)
  const wheelInstructionsId = useId()
  const panelId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  function setOpen(next: boolean) {
    setCustomOpen(next)
    onCustomOpenChange?.(next)
  }

  function ensureCustomHexSeed() {
    if (customHex) return
    const seeded = seedCustomHexFromToken()
    if (!seeded) return
    setCustomHex(seeded)
    setHexDraft(seeded)
  }

  function toggleCustomPicker() {
    if (customOpen) {
      setOpen(false)
      return
    }
    ensureCustomHexSeed()
    setOpen(true)
  }

  function closeCustomPicker(restoreFocus = false) {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  function commitCustom(next: string) {
    const normalized = normalizeCalendarColor(next)
    if (!normalized || !isCustomCalendarColor(normalized)) return
    setCustomHex(normalized)
    setHexDraft(normalized)
    onChange(normalized)
  }

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    return () => {
      onCustomOpenChange?.(false)
    }
  }, [onCustomOpenChange])

  useEffect(() => {
    if (isQuick) return
    const media = window.matchMedia(
      `(max-width: ${COLOR_WHEEL_NARROW_MAX_WIDTH_PX}px)`,
    )
    const updateViewport = () => setIsNarrow(media.matches)
    updateViewport()
    media.addEventListener("change", updateViewport)
    return () => media.removeEventListener("change", updateViewport)
  }, [isQuick])

  useLayoutEffect(() => {
    if (isQuick || !customOpen) {
      if (!customOpen) setPosition(null)
      return
    }

    const updatePosition = () => {
      // Layout size, not transformed visual box — enter scale must not shrink
      // dock math or left/above placements collapse the settled gap.
      const panel = readColorWheelPanelSize(panelRef.current)
      const trigger = triggerRef.current
      if (!panel || !trigger) return

      const anchorElement = resolveColorWheelAnchorElement(trigger)
      const anchor = anchorElement?.getBoundingClientRect()
      if (!anchor) return

      const remPx = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      )
      const nextWheelSize = getColorWheelSizePx(remPx)
      setWheelSizePx((current) =>
        current === nextWheelSize ? current : nextWheelSize,
      )

      const next = getColorWheelPosition({
        anchor,
        panel,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        gapPx: getColorWheelPanelGapPx(remPx),
        isNarrow,
        preferredSide: preferredColorWheelSideForAnchor(anchorElement),
      })
      if (!Number.isFinite(next.top) || !Number.isFinite(next.left)) return
      setPosition((current) =>
        current &&
        current.top === next.top &&
        current.left === next.left &&
        current.placement === next.placement
          ? current
          : next,
      )
    }

    updatePosition()
    // Re-dock after wheel enter + popover spring settle (transforms skip RO).
    let outerFrame = 0
    let innerFrame = 0
    outerFrame = window.requestAnimationFrame(() => {
      updatePosition()
      innerFrame = window.requestAnimationFrame(updatePosition)
    })
    const settleTimer = window.setTimeout(updatePosition, 200)
    const panelEl = panelRef.current
    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.target !== panelEl) return
      updatePosition()
    }
    panelEl?.addEventListener("animationend", onAnimationEnd)

    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    const observer = new ResizeObserver(updatePosition)
    if (panelEl) observer.observe(panelEl)
    const anchorElement = resolveColorWheelAnchorElement(triggerRef.current)
    if (anchorElement) observer.observe(anchorElement)

    return () => {
      window.cancelAnimationFrame(outerFrame)
      window.cancelAnimationFrame(innerFrame)
      window.clearTimeout(settleTimer)
      panelEl?.removeEventListener("animationend", onAnimationEnd)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
      observer.disconnect()
    }
  }, [customOpen, isNarrow, customHex, hexDraft, isQuick])

  useEffect(() => {
    if (!customOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      // Clicks on title/time/fields inside the event card must keep the wheel
      // open — mirror event-detail-popover ignoring portaled wheel clicks.
      if (!isQuick) {
        const anchor = resolveColorWheelAnchorElement(triggerRef.current)
        if (anchor?.contains(target)) return
      }
      closeCustomPicker()
    }
    const frame = window.requestAnimationFrame(() => {
      document.addEventListener("pointerdown", handlePointerDown)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [customOpen, isQuick])

  useEffect(() => {
    if (!customOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      closeCustomPicker(true)
    }
    // Capture so we win over the calendar product window Escape closer.
    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [customOpen])

  useEffect(() => {
    if (isQuick || !customOpen) return
    const wheel = panelRef.current?.querySelector<HTMLElement>(
      '[role="slider"]',
    )
    wheel?.focus()
  }, [customOpen, customHex, isQuick])

  const hsva = useMemo<HsvaColor | null>(
    () => (customHex ? hexToHsva(customHex) : null),
    [customHex],
  )
  const normalizedDraft = normalizeCalendarColor(hexDraft)
  const draftIsValid =
    normalizedDraft !== null && isCustomCalendarColor(normalizedDraft)
  const customSelected = isCustomCalendarColor(value)

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

  const hexField = (
    <label className="flex flex-col gap-1 text-product-meta text-text-secondary">
      Hex color
      <input
        value={hexDraft}
        onChange={(event) => {
          const next = event.target.value
          setHexDraft(next)
          const normalized = normalizeCalendarColor(next)
          if (normalized && isCustomCalendarColor(normalized)) {
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
  )

  const showColorWheel = calendarColorPickerMountsColorWheel({
    variant,
    customOpen,
  })
  const showQuickDropdown = calendarColorPickerMountsQuickDropdown({
    variant,
    customOpen,
  })

  const wheelPanel =
    showColorWheel && customHex && hsva && portalReady
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Custom color wheel"
            data-calendar-color-wheel=""
            data-placement={position?.placement}
            data-ready={position ? "true" : "false"}
            className="calendar-color-wheel-panel"
            style={
              position
                ? {
                    top: position.top,
                    left: position.left,
                    visibility: "visible",
                  }
                : {
                    top: 0,
                    left: 0,
                    visibility: "hidden",
                  }
            }
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return
              event.preventDefault()
              event.stopPropagation()
              closeCustomPicker(true)
            }}
          >
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
              className="mx-auto rounded-full outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <Wheel
                color={hsva}
                width={wheelSizePx}
                height={wheelSizePx}
                onChange={({ hsva: next }) => commitCustom(hsvaToHex(next))}
              />
            </div>
            <p id={wheelInstructionsId} className="sr-only">
              Use left and right arrows for hue, up and down arrows for
              saturation. Hold Shift for larger steps. Press Escape to close.
            </p>
            {hexField}
            {hexDraft.length > 0 && !draftIsValid ? (
              <p role="alert" className="text-product-meta text-brick">
                Enter a six-digit hex color.
              </p>
            ) : null}
          </div>,
          document.body,
        )
      : null

  const swatchSizeClass = isQuick
    ? "size-7 sm:size-6"
    : "size-11 sm:size-8"

  return (
    <fieldset className={`flex flex-col ${isQuick ? "gap-2" : "gap-3"}`}>
      <legend className="text-product-meta font-medium text-ink">
        {label}
      </legend>
      <div
        className={
          isQuick
            ? "flex flex-wrap items-center gap-1"
            : "grid grid-cols-4 gap-1.5 sm:grid-cols-8"
        }
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
              setOpen(false)
              onChange(key)
            }}
            className={`flex items-center justify-center rounded-full border outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${swatchSizeClass} ${
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

        {isQuick ? (
          <div className="relative">
            <button
              ref={triggerRef}
              type="button"
              role="radio"
              aria-checked={customSelected}
              aria-expanded={customOpen}
              aria-haspopup="dialog"
              aria-controls={showQuickDropdown ? panelId : undefined}
              aria-label={
                customSelected
                  ? `Custom color ${value}`
                  : "Add your color"
              }
              onClick={toggleCustomPicker}
              className={`flex items-center justify-center rounded-full border outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${swatchSizeClass} ${
                customSelected || customOpen
                  ? "border-border-strong bg-surface-raised"
                  : "border-dashed border-border"
              }`}
            >
              {customSelected ? (
                <CalendarColorDot
                  color={value}
                  size="picker"
                  selected
                />
              ) : (
                <Plus
                  aria-hidden="true"
                  className="size-3.5 text-text-secondary"
                  strokeWidth={2.25}
                />
              )}
            </button>

            {showQuickDropdown ? (
              <div
                ref={dropdownRef}
                id={panelId}
                role="dialog"
                aria-label="Add your color"
                className="absolute left-0 top-[calc(100%+0.375rem)] z-20 flex w-44 flex-col gap-2 rounded-lg border border-border bg-paper p-2 shadow-none"
                onPointerDown={(event) => event.stopPropagation()}
              >
                {customHex ? (
                  <label className="flex items-center gap-2 text-product-meta text-text-secondary">
                    <span className="shrink-0">Color</span>
                    <input
                      type="color"
                      value={customHex.toLowerCase()}
                      onChange={(event) => commitCustom(event.target.value)}
                      className="h-7 w-full cursor-pointer rounded-md border border-border bg-paper"
                      aria-label="Choose a custom color"
                    />
                  </label>
                ) : null}
                {hexField}
                {hexDraft.length > 0 && !draftIsValid ? (
                  <p role="alert" className="text-product-meta text-brick">
                    Enter a six-digit hex color.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {!isQuick ? (
        <>
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
            ref={triggerRef}
            type="button"
            aria-expanded={customOpen}
            aria-haspopup="dialog"
            aria-controls={showColorWheel ? panelId : undefined}
            onClick={toggleCustomPicker}
            className="min-h-11 self-start text-product-meta font-medium text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Custom color
          </button>

          {wheelPanel}
        </>
      ) : null}
    </fieldset>
  )
}
