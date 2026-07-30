import assert from "node:assert/strict"
import { test } from "node:test"
import {
  calendarColorPickerCustomUi,
  calendarColorPickerMountsColorWheel,
  calendarColorPickerMountsQuickDropdown,
} from "./calendar-color-picker-variant.ts"

test("quick variant never takes the color-wheel custom path", () => {
  assert.deepEqual(calendarColorPickerCustomUi("quick"), {
    kind: "quick_dropdown",
  })
  assert.equal(
    calendarColorPickerMountsColorWheel({
      variant: "quick",
      customOpen: true,
    }),
    false,
  )
  assert.equal(
    calendarColorPickerMountsColorWheel({
      variant: "quick",
      customOpen: false,
    }),
    false,
  )
  assert.equal(
    calendarColorPickerMountsQuickDropdown({
      variant: "quick",
      customOpen: true,
    }),
    true,
  )
})

test("full variant retains Custom color → wheel mount path", () => {
  assert.deepEqual(calendarColorPickerCustomUi("full"), {
    kind: "full_wheel",
  })
  assert.equal(
    calendarColorPickerMountsColorWheel({
      variant: "full",
      customOpen: true,
    }),
    true,
  )
  assert.equal(
    calendarColorPickerMountsColorWheel({
      variant: "full",
      customOpen: false,
    }),
    false,
  )
  assert.equal(
    calendarColorPickerMountsQuickDropdown({
      variant: "full",
      customOpen: true,
    }),
    false,
  )
})
