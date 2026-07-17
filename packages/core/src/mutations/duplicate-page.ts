import { randomUUID } from "node:crypto";
import type { Json } from "../types/database.types";

type BlockLike = {
  id?: string;
  type?: string;
  content?: unknown;
  children?: BlockLike[];
  props?: Record<string, unknown>;
};

/** F-12: duplicate page structure with fresh block ids and cleared inline text. */
export function stripPageContentForTemplate(content: unknown): Json {
  if (!Array.isArray(content)) return [];

  function cloneBlock(block: unknown): Json {
    if (!block || typeof block !== "object") return { id: randomUUID() };
    const source = block as BlockLike;

    const next: Record<string, Json> = {
      ...(source as Record<string, Json>),
      id: randomUUID(),
    };

    if (Array.isArray(source.content)) {
      next.content = source.content.map((inline) => {
        if (!inline || typeof inline !== "object") return inline as Json;
        if ("text" in inline && typeof (inline as { text?: unknown }).text === "string") {
          return { ...(inline as Record<string, Json>), text: "" };
        }
        return inline as Json;
      });
    }

    if (Array.isArray(source.children)) {
      next.children = source.children.map(cloneBlock);
    }

    return next;
  }

  return content.map(cloneBlock);
}
