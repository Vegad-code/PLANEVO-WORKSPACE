import assert from "node:assert/strict"
import test from "node:test"
import {
  openCalendarToken,
  sealCalendarToken,
} from "./calendar-token-crypto.ts"

const key = Buffer.alloc(32, 7).toString("base64")
const otherKey = Buffer.alloc(32, 8).toString("base64")

test("OAuth tokens round-trip through versioned authenticated encryption", () => {
  const sealed = sealCalendarToken("refresh-token", key)

  assert.match(sealed, /^v1\.[^.]+\.[^.]+\.[^.]+$/)
  assert.equal(openCalendarToken(sealed, key), "refresh-token")
  assert.doesNotMatch(sealed, /refresh-token/)
})

test("tampering and the wrong key fail closed", () => {
  const sealed = sealCalendarToken("access-token", key)
  const tampered = `${sealed.slice(0, -1)}A`

  assert.throws(() => openCalendarToken(tampered, key))
  assert.throws(() => openCalendarToken(sealed, otherKey))
})

test("invalid key material and empty secrets are rejected", () => {
  assert.throws(() => sealCalendarToken("", key), /non-empty/)
  assert.throws(() => sealCalendarToken("token", "too-short"), /32 bytes/)
  assert.throws(() => openCalendarToken("not-a-payload", key), /format/)
})
