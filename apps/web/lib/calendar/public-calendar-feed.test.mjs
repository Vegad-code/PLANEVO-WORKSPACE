import assert from "node:assert/strict"
import test from "node:test"
import {
  isPublicNetworkAddress,
  resolvePublicCalendarFeedUrl,
} from "./public-calendar-feed.ts"

test("calendar subscriptions reject loopback, private, link-local, and metadata ranges", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.4",
    "172.16.1.2",
    "192.168.1.1",
    "169.254.169.254",
    "240.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:7f00:1",
    "::7f00:1",
    "64:ff9b::a9fe:a9fe",
    "2001:0000:4136:e378:8000:63bf:3fff:fdd2",
    "2001:2::1",
    "2001:10::1",
    "2001:20::1",
    "2002:7f00:1::",
    "fe80::1",
    "fec0::1",
    "fd00::1",
    "2001:db8::1",
  ]) {
    assert.equal(isPublicNetworkAddress(address), false, address)
  }
  assert.equal(isPublicNetworkAddress("8.8.8.8"), true)
  assert.equal(isPublicNetworkAddress("2606:4700:4700::1111"), true)
})

test("feed URLs require HTTPS without embedded credentials", async () => {
  const publicLookup = async () => [{ address: "8.8.8.8", family: 4 }]

  await assert.rejects(
    resolvePublicCalendarFeedUrl("http://example.com/calendar.ics", publicLookup),
    /HTTPS/,
  )
  await assert.rejects(
    resolvePublicCalendarFeedUrl(
      "https://user:secret@example.com/calendar.ics",
      publicLookup,
    ),
    /credentials/,
  )
  await assert.rejects(
    resolvePublicCalendarFeedUrl("https://localhost/calendar.ics", publicLookup),
    /host/,
  )
})

test("every resolved address must be public before a feed is fetched", async () => {
  await assert.rejects(
    resolvePublicCalendarFeedUrl(
      "https://calendar.example/feed.ics",
      async () => [
        { address: "203.0.113.8", family: 4 },
        { address: "10.0.0.8", family: 4 },
      ],
    ),
    /public Internet/,
  )

  const url = await resolvePublicCalendarFeedUrl(
    "https://calendar.example/feed.ics",
    async () => [{ address: "8.8.4.4", family: 4 }],
  )
  assert.equal(url.href, "https://calendar.example/feed.ics")
})
