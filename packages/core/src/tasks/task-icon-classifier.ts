import {
  bestCatalogIconForText,
  getCatalogIcon,
  isCatalogIconId,
  resolveIconDefinition,
  searchIconCatalog,
  tokenizeIntentText,
} from "./icon-catalog.ts";
import { bestEmojiForText, getEmojiCatalogEntry, searchEmojiCatalog } from "./emoji-catalog.ts";
import {
  getTaskIconDefinition,
  isValidTaskIconId,
  type TaskIconId,
} from "./task-icon-registry.ts";
import type { TaskIconDefinition, TaskIconRef, TaskIconStyle } from "./task-icon-types.ts";
import {
  DEFAULT_TASK_ICON_STYLE,
  emojiToId,
  parseEmojiFromId,
} from "./task-icon-types.ts";

export type ClassifyTaskIconInput = {
  title: string;
  tags?: string[];
  description?: string;
};

const TAG_TO_ICON: Record<string, TaskIconId> = {
  Product: "product",
  Design: "design",
  Components: "components",
  User: "user",
  Other: "other",
};

const TAG_TO_EMOJI: Record<string, string> = {
  Product: "🚀",
  Design: "🎨",
  Components: "🧩",
  User: "👤",
  Other: "📁",
};

const KEYWORD_RULES: { id: TaskIconId; keywords: string[] }[] = [
  { id: "bug", keywords: ["bug", "fix", "broken", "regression"] },
  { id: "meeting", keywords: ["meeting", "sync", "standup", "call"] },
  { id: "docs", keywords: ["doc", "write", "spec", "readme"] },
  { id: "research", keywords: ["research", "investigate", "spike"] },
  { id: "ops", keywords: ["deploy", "infra", "ci", "release"] },
  { id: "content", keywords: ["blog", "copy", "marketing"] },
  { id: "product", keywords: ["launch", "roadmap", "prd"] },
  { id: "design", keywords: ["ui", "mockup", "figma"] },
  { id: "components", keywords: ["api", "component"] },
  { id: "user", keywords: ["customer", "support"] },
];

const KEYWORD_EMOJI: { emoji: string; keywords: string[] }[] = [
  { emoji: "🐛", keywords: ["bug", "fix", "broken", "regression"] },
  { emoji: "👥", keywords: ["meeting", "sync", "standup", "call"] },
  { emoji: "📄", keywords: ["doc", "write", "spec", "readme"] },
  { emoji: "🔬", keywords: ["research", "investigate", "spike"] },
  { emoji: "⚙️", keywords: ["deploy", "infra", "ci", "release"] },
  { emoji: "✍️", keywords: ["blog", "copy", "marketing"] },
  { emoji: "🚀", keywords: ["launch", "roadmap", "prd"] },
  { emoji: "🎨", keywords: ["ui", "mockup", "figma"] },
  { emoji: "🧩", keywords: ["api", "component"] },
  { emoji: "👤", keywords: ["customer", "support"] },
];

const INTENT_EMOJI: { phrases: string[]; emoji: string }[] = [
  {
    phrases: ["homework", "school", "study", "assignment", "exam", "class"],
    emoji: "📚",
  },
  {
    phrases: ["groceries", "grocery", "shopping", "store"],
    emoji: "🛒",
  },
  {
    phrases: ["clean", "cleaning", "chore", "chores", "laundry"],
    emoji: "🧹",
  },
  {
    phrases: ["cook", "cooking", "dinner", "lunch", "meal", "recipe"],
    emoji: "🍳",
  },
  {
    phrases: ["workout", "gym", "exercise", "fitness"],
    emoji: "🏋️",
  },
  {
    phrases: ["walk dog", "pet", "dog"],
    emoji: "🐕",
  },
  {
    phrases: ["pay bill", "bills", "rent"],
    emoji: "💰",
  },
];

function normalizeSearchText(title: string, description?: string): string {
  return `${title} ${description ?? ""}`.toLowerCase();
}

export function makeEmojiIconRef(emoji: string, source: TaskIconRef["source"]): TaskIconRef {
  return {
    id: emojiToId(emoji),
    emoji,
    style: "emoji",
    source,
  };
}

function iconFromTags(tags: string[] | undefined): TaskIconId | null {
  if (!tags?.length) return null;
  for (const tag of tags) {
    const mapped = TAG_TO_ICON[tag];
    if (mapped) return mapped;
  }
  return null;
}

function emojiFromTags(tags: string[] | undefined): string | null {
  if (!tags?.length) return null;
  for (const tag of tags) {
    const mapped = TAG_TO_EMOJI[tag];
    if (mapped) return mapped;
  }
  return null;
}

function iconFromKeywords(searchText: string): TaskIconId | null {
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => searchText.includes(keyword))) {
      return rule.id;
    }
  }
  return null;
}

function emojiFromKeywords(searchText: string): string | null {
  for (const rule of KEYWORD_EMOJI) {
    if (rule.keywords.some((keyword) => searchText.includes(keyword))) {
      return rule.emoji;
    }
  }
  return null;
}

function emojiFromIntentPhrases(searchText: string): string | null {
  for (const rule of INTENT_EMOJI) {
    if (rule.phrases.some((phrase) => searchText.includes(phrase))) {
      return rule.emoji;
    }
  }
  return null;
}

function iconFromCatalogSearch(title: string, description?: string): string | null {
  const combined = `${title} ${description ?? ""}`.trim();
  const tokens = tokenizeIntentText(combined);
  const query = tokens.length > 0 ? tokens.join(" ") : combined;
  const match = bestCatalogIconForText(query);
  return match?.id ?? null;
}

function emojiFromCatalogSearch(title: string, description?: string): string | null {
  const combined = `${title} ${description ?? ""}`.trim();
  const tokens = tokenizeIntentText(combined);
  const query = tokens.length > 0 ? tokens.join(" ") : combined;
  const match = bestEmojiForText(query);
  return match?.emoji ?? null;
}

/** Auto-assign emoji icons for life/work intents (Apple emoji style). */
export function classifyTaskEmoji(input: ClassifyTaskIconInput): TaskIconRef {
  const tagEmoji = emojiFromTags(input.tags);
  if (tagEmoji) return makeEmojiIconRef(tagEmoji, "auto");

  const searchText = normalizeSearchText(input.title, input.description);

  const intentEmoji = emojiFromIntentPhrases(searchText);
  if (intentEmoji) return makeEmojiIconRef(intentEmoji, "auto");

  const keywordEmoji = emojiFromKeywords(searchText);
  if (keywordEmoji) return makeEmojiIconRef(keywordEmoji, "auto");

  const catalogEmoji = emojiFromCatalogSearch(input.title, input.description);
  if (catalogEmoji) return makeEmojiIconRef(catalogEmoji, "auto");

  return makeEmojiIconRef("📁", "auto");
}

export function classifyTaskIcon(input: ClassifyTaskIconInput): TaskIconRef {
  return classifyTaskEmoji(input);
}

export function isValidTaskIconRefId(id: string): boolean {
  if (id.startsWith("emoji:")) {
    return parseEmojiFromId(id) != null;
  }
  return isValidTaskIconId(id) || isCatalogIconId(id);
}

function parseTaskIconStyle(value: unknown): TaskIconStyle {
  if (value === "emoji" || value === "colorful") return "emoji";
  return DEFAULT_TASK_ICON_STYLE;
}

export function parseTaskIconRef(value: unknown): TaskIconRef | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = record.id;
  const source = record.source;
  if (typeof id !== "string" || !isValidTaskIconRefId(id)) return null;
  if (source !== "auto" && source !== "user") return null;

  const style = parseTaskIconStyle(record.style);
  const emojiFromField =
    typeof record.emoji === "string" ? record.emoji : parseEmojiFromId(id);

  const resolvedStyle =
    style === "emoji" && !emojiFromField ? DEFAULT_TASK_ICON_STYLE : style;

  return {
    id,
    source,
    style: resolvedStyle,
    ...(resolvedStyle === "emoji" && emojiFromField
      ? { emoji: emojiFromField }
      : {}),
  };
}

export function resolveTaskIcon(
  task: { title: string; description_json: Record<string, unknown> },
  fileCount = 0,
): {
  ref: TaskIconRef;
  definition: TaskIconDefinition;
  active: boolean;
} {
  const stored = parseTaskIconRef(task.description_json.icon);
  const ref =
    stored ??
    classifyTaskIcon({
      title: task.title,
      tags: Array.isArray(task.description_json.tags)
        ? task.description_json.tags.filter(
            (tag): tag is string => typeof tag === "string",
          )
        : undefined,
      description:
        typeof task.description_json.text === "string"
          ? task.description_json.text
          : undefined,
    });

  const definition =
    resolveIconDefinition(ref.id, ref.emoji) ?? getTaskIconDefinition("default")!;

  return {
    ref: {
      ...ref,
      style: ref.style ?? DEFAULT_TASK_ICON_STYLE,
      emoji: ref.emoji ?? parseEmojiFromId(ref.id) ?? undefined,
    },
    definition,
    active: fileCount > 0,
  };
}

export function mergeTaskIconOnUpdate(input: {
  title: string;
  description: string;
  tags?: string[];
  existingDescriptionJson: Record<string, unknown>;
  explicitIcon?: TaskIconRef;
}): TaskIconRef {
  if (input.explicitIcon) {
    return input.explicitIcon;
  }

  const existing = parseTaskIconRef(input.existingDescriptionJson.icon);
  if (existing?.source === "user") {
    return existing;
  }

  if (existing?.style === "emoji") {
    return classifyTaskEmoji({
      title: input.title,
      tags: input.tags,
      description: input.description,
    });
  }

  const tagMatch = iconFromTags(input.tags);
  if (tagMatch) {
    return { id: tagMatch, source: "auto", style: "plain" };
  }

  const searchText = normalizeSearchText(input.title, input.description);
  const keywordMatch = iconFromKeywords(searchText);
  if (keywordMatch) {
    return { id: keywordMatch, source: "auto", style: "plain" };
  }

  const catalogMatch = iconFromCatalogSearch(input.title, input.description);
  if (catalogMatch) {
    return { id: catalogMatch, source: "auto", style: "plain" };
  }

  return { id: "default", source: "auto", style: "plain" };
}

export { searchIconCatalog, getCatalogIcon, searchEmojiCatalog, getEmojiCatalogEntry };
