import assert from "node:assert/strict";
import test from "node:test";

async function loadPreferencesModule() {
  try {
    return await import("./app-preferences.ts");
  } catch (error) {
    assert.fail(
      `App preferences must exist before these behaviors can pass: ${String(error)}`,
    );
  }
}

test("defaults missing preferences to system theme with full color", async () => {
  const { parseAppPreferences } = await loadPreferencesModule();

  assert.deepEqual(parseAppPreferences(null), {
    version: 1,
    theme: "system",
    minimal: false,
  });
});

test("accepts only the complete version-one preference schema", async () => {
  const { parseAppPreferences } = await loadPreferencesModule();

  assert.deepEqual(
    parseAppPreferences('{"version":1,"theme":"dark","minimal":true}'),
    { version: 1, theme: "dark", minimal: true },
  );
});

test("falls back for malformed, wrong-version, and invalid preferences", async () => {
  const { parseAppPreferences } = await loadPreferencesModule();
  const expected = { version: 1, theme: "system", minimal: false };

  for (const value of [
    "not json",
    '{"version":2,"theme":"dark","minimal":true}',
    '{"version":1,"theme":"sepia","minimal":true}',
    '{"version":1,"theme":"light","minimal":"yes"}',
    '{"version":1,"theme":"light"}',
  ]) {
    assert.deepEqual(parseAppPreferences(value), expected);
  }
});

test("resolves system theme from the current system appearance", async () => {
  const { resolveTheme } = await loadPreferencesModule();

  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("light", true), "light");
});

test("keeps theme and minimal preferences independent in every appearance", async () => {
  const { getRootAppearance } = await loadPreferencesModule();
  const cases = [
    {
      preferences: { version: 1, theme: "light", minimal: false },
      systemDark: true,
      expected: { theme: "light", minimal: false },
    },
    {
      preferences: { version: 1, theme: "light", minimal: true },
      systemDark: true,
      expected: { theme: "light", minimal: true },
    },
    {
      preferences: { version: 1, theme: "dark", minimal: false },
      systemDark: false,
      expected: { theme: "dark", minimal: false },
    },
    {
      preferences: { version: 1, theme: "dark", minimal: true },
      systemDark: false,
      expected: { theme: "dark", minimal: true },
    },
  ];

  for (const { preferences, systemDark, expected } of cases) {
    assert.deepEqual(getRootAppearance(preferences, systemDark), expected);
  }
});

