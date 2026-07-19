export type TaskIconSource = "auto" | "user";

/** Plain = Phosphor / Font Awesome line icons. Emoji = Apple Color Emoji glyphs. */
export type TaskIconStyle = "plain" | "emoji";

export type TaskIconRef = {
  id: string;
  source: TaskIconSource;
  style?: TaskIconStyle;
  /** Unicode emoji character when style is emoji. */
  emoji?: string;
};

export type TaskIconLibrary = "phosphor" | "fontawesome" | "emoji";

export type CatalogIconSnapshot = {
  id: string;
  library: "solid" | "regular";
  iconName: string;
  label: string;
  svgPath: string;
  width: number;
  height: number;
};

export type TaskIconDefinition = {
  id: string;
  label: string;
  library: TaskIconLibrary;
  name: string;
  catalog?: CatalogIconSnapshot;
  emoji?: string;
};

export const DEFAULT_TASK_ICON_STYLE: TaskIconStyle = "plain";

export function emojiToId(emoji: string): string {
  const points = [...emoji]
    .map((char) => char.codePointAt(0))
    .filter((point): point is number => point != null)
    .map((point) => point.toString(16));
  return `emoji:${points.join("-")}`;
}

export function parseEmojiFromId(id: string): string | null {
  if (!id.startsWith("emoji:")) return null;
  const payload = id.slice("emoji:".length);
  if (!payload) return null;
  if (!payload.includes("-") && payload.length <= 8) {
    const point = Number.parseInt(payload, 16);
    return Number.isNaN(point) ? payload : String.fromCodePoint(point);
  }
  if (/^[0-9a-f-]+$/i.test(payload)) {
    try {
      return String.fromCodePoint(
        ...payload.split("-").map((part) => Number.parseInt(part, 16)),
      );
    } catch {
      return null;
    }
  }
  return payload;
}
