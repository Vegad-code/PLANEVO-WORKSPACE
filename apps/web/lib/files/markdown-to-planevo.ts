type PlanevoText = {
  type: "text";
  text: string;
  styles: Record<string, boolean>;
};

type PlanevoImportBlock = {
  type: string;
  props?: Record<string, unknown>;
  content: PlanevoText[];
};

function textContent(text: string): PlanevoText[] {
  return [{ type: "text", text, styles: {} }];
}

/**
 * Conservative Markdown import: source editing remains lossless, while an
 * explicit conversion maps stable block syntax into a separate Planevo page.
 */
export function markdownToPlanevoBlocks(source: string): PlanevoImportBlock[] {
  const blocks: PlanevoImportBlock[] = [];
  const paragraph: string[] = [];
  const code: string[] = [];
  let codeLanguage = "";
  let inCode = false;

  function flushParagraph() {
    const text = paragraph.join("\n").trim();
    paragraph.length = 0;
    if (text) blocks.push({ type: "paragraph", content: textContent(text) });
  }

  function flushCode() {
    blocks.push({
      type: "codeBlock",
      props: codeLanguage ? { language: codeLanguage } : {},
      content: textContent(code.join("\n")),
    });
    code.length = 0;
    codeLanguage = "";
  }

  for (const line of source.replaceAll("\r\n", "\n").split("\n")) {
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      if (inCode) flushCode();
      else {
        flushParagraph();
        codeLanguage = fence[1]?.trim() ?? "";
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        props: { level: heading[1]!.length },
        content: textContent(heading[2]!),
      });
      continue;
    }
    const checklist = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (checklist) {
      flushParagraph();
      blocks.push({
        type: "checkListItem",
        props: { checked: checklist[1]!.toLowerCase() === "x" },
        content: textContent(checklist[2]!),
      });
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      blocks.push({
        type: "bulletListItem",
        content: textContent(bullet[1]!),
      });
      continue;
    }
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      blocks.push({
        type: "numberedListItem",
        content: textContent(numbered[1]!),
      });
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      blocks.push({ type: "quote", content: textContent(quote[1]!) });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  if (inCode || code.length > 0) flushCode();
  return blocks.slice(0, 5000);
}
