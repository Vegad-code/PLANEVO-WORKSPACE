import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto"

const TOKEN_VERSION = "v1"
const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12

function encryptionKey(encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, "base64")
  if (key.byteLength !== 32) {
    throw new Error(
      "CALENDAR_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.",
    )
  }
  return key
}

export function sealCalendarToken(
  plaintext: string,
  encodedKey: string,
): string {
  if (!plaintext) throw new Error("Calendar tokens must be non-empty.")

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(encodedKey), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    TOKEN_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

export function openCalendarToken(
  sealed: string,
  encodedKey: string,
): string {
  const [version, encodedIv, encodedTag, encodedCiphertext, ...rest] =
    sealed.split(".")
  if (
    version !== TOKEN_VERSION ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext ||
    rest.length > 0
  ) {
    throw new Error("Invalid encrypted calendar token format.")
  }

  const iv = Buffer.from(encodedIv, "base64url")
  const tag = Buffer.from(encodedTag, "base64url")
  const ciphertext = Buffer.from(encodedCiphertext, "base64url")
  if (iv.byteLength !== IV_BYTES || tag.byteLength !== 16) {
    throw new Error("Invalid encrypted calendar token format.")
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(encodedKey), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8")
}

export function calendarTokenEncryptionKey(): string {
  const key = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY?.trim()
  if (!key) {
    throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY is not configured.")
  }
  encryptionKey(key)
  return key
}
