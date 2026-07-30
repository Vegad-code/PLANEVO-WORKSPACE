/**
 * Variant gating for CalendarColorPicker custom-color UI.
 * Quick create must never take the color-wheel path; Details keeps Custom → wheel.
 */

export type CalendarColorPickerVariant = "full" | "quick"

export type CalendarColorPickerCustomUi =
  | { kind: "quick_dropdown" }
  | { kind: "full_wheel" }

/** Which custom-color surface a variant may mount. Never both. */
export function calendarColorPickerCustomUi(
  variant: CalendarColorPickerVariant,
): CalendarColorPickerCustomUi {
  switch (variant) {
    case "quick":
      return { kind: "quick_dropdown" }
    case "full":
      return { kind: "full_wheel" }
    default: {
      const _exhaustive: never = variant
      return _exhaustive
    }
  }
}

/** True only when Details/`full` has the custom panel open (wheel mount path). */
export function calendarColorPickerMountsColorWheel(args: {
  variant: CalendarColorPickerVariant
  customOpen: boolean
}): boolean {
  return (
    args.customOpen &&
    calendarColorPickerCustomUi(args.variant).kind === "full_wheel"
  )
}

/** True when Quick/`quick` has the compact hex/native dropdown open. */
export function calendarColorPickerMountsQuickDropdown(args: {
  variant: CalendarColorPickerVariant
  customOpen: boolean
}): boolean {
  return (
    args.customOpen &&
    calendarColorPickerCustomUi(args.variant).kind === "quick_dropdown"
  )
}
