/**
 * Generates packages/core/src/tasks/icon-catalog.json from Font Awesome npm
 * packages (same glyphs as github.com/FortAwesome/Font-Awesome). Run after
 * upgrading @fortawesome/* dependencies.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as solid from "@fortawesome/free-solid-svg-icons";
import * as regular from "@fortawesome/free-regular-svg-icons";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../packages/core/src/tasks/icon-catalog.json");

const INTENT_SYNONYMS = {
  book: "read library homework study school assignment exam class learning",
  "book-open": "read homework study notes textbook learning",
  "book-open-reader": "read homework study learning",
  "graduation-cap": "school homework college university student education",
  house: "home chores clean household",
  "cart-shopping": "groceries grocery shopping store buy",
  utensils: "cook cooking dinner lunch meal food kitchen",
  dumbbell: "workout gym exercise fitness",
  plane: "travel flight trip vacation",
  car: "drive commute travel transport",
  bed: "sleep rest nap",
  broom: "clean cleaning chore chores sweep",
  dog: "pet walk puppy",
  cat: "pet kitten",
  heart: "health love care",
  "money-bill": "pay bill finance budget money",
  calendar: "schedule plan date reminder",
  envelope: "email mail message",
  phone: "call contact",
  wrench: "repair fix maintenance",
  hammer: "build fix repair",
  laptop: "computer work code dev",
  code: "programming developer software",
};

function camelToWords(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/-/g, " ")
    .toLowerCase();
}

function exportKeyToIconName(key) {
  if (!key.startsWith("fa") || key === "fas" || key === "far") return null;
  const raw = key.slice(2);
  if (!raw) return null;
  return raw
    .replace(/([A-Z])/g, (match, _g, offset) =>
      offset === 0 ? match.toLowerCase() : `-${match.toLowerCase()}`,
    )
    .replace(/^-/, "");
}

function labelFromIconName(iconName) {
  return iconName
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function collectIcons(pack, library) {
  const rows = [];
  for (const [key, definition] of Object.entries(pack)) {
    const iconName = exportKeyToIconName(key);
    if (!iconName || !definition?.icon) continue;
    const [width, height, _aliases, _unicode, svgPath] = definition.icon;
    if (typeof svgPath !== "string") continue;

    const label = labelFromIconName(iconName);
    const baseSearch = `${iconName} ${camelToWords(iconName)} ${label.toLowerCase()}`;
    const synonyms = INTENT_SYNONYMS[iconName] ?? "";
    const searchText = `${baseSearch} ${synonyms}`.trim();

    rows.push({
      id: `fa:${library}:${iconName}`,
      library,
      iconName,
      label,
      searchText,
      svgPath,
      width,
      height,
    });
  }
  return rows;
}

const catalog = [
  ...collectIcons(solid, "solid"),
  ...collectIcons(regular, "regular"),
].sort((a, b) => a.label.localeCompare(b.label));

writeFileSync(OUT, JSON.stringify(catalog));
console.log(`Wrote ${catalog.length} icons to ${OUT}`);
