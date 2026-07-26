import { BlockList, isIP } from "node:net"
import { lookup as dnsLookup } from "node:dns/promises"
import { request as httpsRequest } from "node:https"

const MAX_FEED_BYTES = 5 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 3

type LookupAddress = {
  address: string
  family: number
}

export type CalendarFeedLookup = (
  hostname: string,
) => Promise<LookupAddress[]>

export type CalendarFeedResponse =
  | { status: "not-modified" }
  | {
      status: "updated"
      body: string
      etag: string | null
      lastModified: string | null
    }

const blockedAddresses = new BlockList()
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv4")
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["fc00::", 7],
  ["fec0::", 10],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001::", 32],
  ["2001:2::", 48],
  ["2001:10::", 28],
  ["2001:20::", 28],
  ["2001:db8::", 32],
  ["2002::", 16],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv6")
}

function ipv4FromMappedIpv6(address: string): string | null {
  const suffix = address.toLowerCase().replace(/^::ffff:/, "")
  if (suffix === address.toLowerCase()) return null
  if (isIP(suffix) === 4) return suffix

  const halves = suffix.split(":")
  if (halves.length !== 2) return null
  const [upper, lower] = halves.map((half) => Number.parseInt(half, 16))
  if (
    upper === undefined ||
    lower === undefined ||
    !Number.isInteger(upper) ||
    !Number.isInteger(lower) ||
    upper < 0 ||
    upper > 0xffff ||
    lower < 0 ||
    lower > 0xffff
  ) {
    return null
  }
  return [
    upper >>> 8,
    upper & 0xff,
    lower >>> 8,
    lower & 0xff,
  ].join(".")
}

export function isPublicNetworkAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return !blockedAddresses.check(address, "ipv4")
  if (family === 6) {
    const mappedIpv4 = ipv4FromMappedIpv6(address)
    return mappedIpv4
      ? !blockedAddresses.check(mappedIpv4, "ipv4")
      : !blockedAddresses.check(address, "ipv6")
  }
  return false
}

async function defaultLookup(hostname: string): Promise<LookupAddress[]> {
  return dnsLookup(hostname, { all: true, verbatim: true })
}

export async function resolvePublicCalendarFeedUrl(
  rawUrl: string,
  lookup: CalendarFeedLookup = defaultLookup,
): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error("Enter a valid calendar feed URL.")
  }

  if (url.protocol !== "https:") {
    throw new Error("Calendar feed URLs must use HTTPS.")
  }
  if (url.username || url.password) {
    throw new Error("Calendar feed URLs cannot include credentials.")
  }

  const hostname = url.hostname.toLowerCase()
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Calendar feed host is not allowed.")
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname)
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicNetworkAddress(address))
  ) {
    throw new Error("Calendar feeds must resolve only to the public Internet.")
  }

  return url
}

function requestFeedOnce({
  url,
  address,
  family,
  etag,
  lastModified,
}: {
  url: URL
  address: string
  family: number
  etag: string | null
  lastModified: string | null
}): Promise<{
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: string
}> {
  return new Promise((resolve, reject) => {
    let deadline: ReturnType<typeof setTimeout> | null = null
    const clearDeadline = () => {
      if (deadline) clearTimeout(deadline)
      deadline = null
    }
    const rejectRequest = (cause: Error) => {
      clearDeadline()
      reject(cause)
    }
    const request = httpsRequest(
      url,
      {
        method: "GET",
        headers: {
          Accept: "text/calendar, text/plain;q=0.9",
          "User-Agent": "Planevo-Calendar-Sync/1.0",
          ...(etag ? { "If-None-Match": etag } : {}),
          ...(lastModified ? { "If-Modified-Since": lastModified } : {}),
        },
        // Pin the already-vetted address so a DNS rebinding between validation
        // and connect cannot route the request into a private network.
        lookup: (_hostname, _options, callback) =>
          callback(null, address, family),
      },
      (response) => {
        const declaredLength = Number(response.headers["content-length"] ?? 0)
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > MAX_FEED_BYTES
        ) {
          response.destroy()
          rejectRequest(new Error("Calendar feed is too large."))
          return
        }

        const chunks: Buffer[] = []
        let received = 0
        response.on("data", (chunk: Buffer) => {
          received += chunk.byteLength
          if (received > MAX_FEED_BYTES) {
            response.destroy(new Error("Calendar feed is too large."))
            return
          }
          chunks.push(chunk)
        })
        response.on("end", () => {
          clearDeadline()
          resolve({
            statusCode: response.statusCode ?? 500,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        })
        response.on("error", rejectRequest)
      },
    )
    deadline = setTimeout(() => {
      request.destroy(new Error("Calendar feed request timed out."))
    }, REQUEST_TIMEOUT_MS)
    request.on("error", rejectRequest)
    request.end()
  })
}

export async function fetchPublicCalendarFeed({
  feedUrl,
  etag = null,
  lastModified = null,
  lookup = defaultLookup,
}: {
  feedUrl: string
  etag?: string | null
  lastModified?: string | null
  lookup?: CalendarFeedLookup
}): Promise<CalendarFeedResponse> {
  let url = await resolvePublicCalendarFeedUrl(feedUrl, lookup)

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const addresses = isIP(url.hostname)
      ? [{ address: url.hostname, family: isIP(url.hostname) }]
      : await lookup(url.hostname)
    const target = addresses[0]
    if (
      !target ||
      addresses.some(({ address }) => !isPublicNetworkAddress(address))
    ) {
      throw new Error("Calendar feeds must resolve only to the public Internet.")
    }

    const response = await requestFeedOnce({
      url,
      address: target.address,
      family: target.family,
      etag,
      lastModified,
    })
    if (response.statusCode === 304) return { status: "not-modified" }

    if (
      response.statusCode >= 300 &&
      response.statusCode < 400 &&
      typeof response.headers.location === "string"
    ) {
      if (redirect === MAX_REDIRECTS) {
        throw new Error("Calendar feed redirected too many times.")
      }
      url = await resolvePublicCalendarFeedUrl(
        new URL(response.headers.location, url).href,
        lookup,
      )
      continue
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Calendar feed returned HTTP ${response.statusCode}.`)
    }

    return {
      status: "updated",
      body: response.body,
      etag:
        typeof response.headers.etag === "string"
          ? response.headers.etag
          : null,
      lastModified:
        typeof response.headers["last-modified"] === "string"
          ? response.headers["last-modified"]
          : null,
    }
  }

  throw new Error("Calendar feed redirected too many times.")
}
