/**
 * Conversions between ISO timestamps and the `value` of native date/time
 * inputs. Both directions tolerate empty and malformed input: an
 * `<input type="date">` can legitimately be cleared to "", and
 * `new Date("").toISOString()` throws `RangeError`.
 */

function padTwo(value: number): string {
  return String(value).padStart(2, "0")
}

/** ISO → `<input type="datetime-local">` value. "" when the ISO is unusable. */
export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return `${toDateInputValue(iso)}T${toTimeInputValue(iso)}`
}

/** ISO → `<input type="date">` value (`YYYY-MM-DD`), local calendar day. */
export function toDateInputValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`
}

/** ISO → `<input type="time">` value (`HH:mm`), local wall clock. */
export function toTimeInputValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`
}

/**
 * `<input type="datetime-local">` value → ISO. `null` when the field is empty
 * or unparseable, so callers can hold off on saving instead of crashing.
 */
export function fromDatetimeLocalValue(value: string): string | null {
  if (!value.trim()) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/**
 * Separate date and time fields → ISO. `null` if either half is missing, which
 * is the normal transient state while the user is retyping one of them.
 */
export function fromDateAndTimeInputValues(
  dateValue: string,
  timeValue: string,
): string | null {
  if (!dateValue.trim() || !timeValue.trim()) return null
  return fromDatetimeLocalValue(`${dateValue}T${timeValue}`)
}
