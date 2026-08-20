import { createHash } from "node:crypto";
import type { ParsedSourceDocument, PassageCandidate, SourceBlock } from "@searchos/contracts";

function decodeEntities(value: string): string {
  return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, "\"").replace(/&#39;/gi, "'");
}

function plainText(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function parseHtmlDocument(snapshotId: string, html: string, maxChars = 20_000): ParsedSourceDocument {
  const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<!--([\s\S]*?)-->/g, "");
  const title = plainText(cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "Untitled source");
  const matches = [...cleaned.matchAll(/<(h[1-6]|p|pre|li)[^>]*>([\s\S]*?)<\/\1>/gi)];
  const headings: string[] = [];
  const blocks: SourceBlock[] = [];
  let paragraph = 0;
  let used = 0;
  for (const match of matches) {
    const tag = match[1]!.toLowerCase();
    const text = plainText(match[2]!);
    if (!text) continue;
    if (tag.startsWith("h")) {
      const level = Number(tag[1]);
      headings.splice(level - 1);
      headings[level - 1] = text;
    }
    if (used >= maxChars) break;
    const clipped = text.slice(0, Math.max(0, maxChars - used));
    paragraph += 1;
    used += clipped.length;
    blocks.push({
      id: `b-${String(blocks.length + 1).padStart(4, "0")}-${createHash("sha1").update(clipped).digest("hex").slice(0, 8)}`,
      kind: tag.startsWith("h") ? "HEADING" : tag === "pre" ? "CODE" : tag === "li" ? "LIST_ITEM" : "PARAGRAPH",
      headingPath: headings.filter(Boolean), paragraph, text: clipped
    });
  }
  if (blocks.length === 0) {
    const text = plainText(cleaned).slice(0, maxChars);
    if (text) blocks.push({ id: `b-0001-${createHash("sha1").update(text).digest("hex").slice(0, 8)}`, kind: "PARAGRAPH", headingPath: [], paragraph: 1, text });
  }
  const normalizedText = blocks.map((block) => block.text).join("\n");
  return { snapshotId, title, normalizedText, blocks, truncated: plainText(cleaned).length > normalizedText.length, parserVersion: "html-blocks-v1" };
}

export function selectPassages(document: ParsedSourceDocument, query: string, limit = 8): PassageCandidate[] {
  const terms = [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter((term) => term.length > 1))];
  return document.blocks.map((block) => {
    const text = block.text.toLowerCase();
    const hits = terms.filter((term) => text.includes(term)).length;
    return { snapshotId: document.snapshotId, blockId: block.id, headingPath: block.headingPath, text: block.text, score: terms.length ? hits / terms.length : 0 };
  }).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function verifyExactAnchor(document: ParsedSourceDocument, blockId: string, excerpt: string): boolean {
  const block = document.blocks.find((item) => item.id === blockId);
  return Boolean(block && block.text.includes(excerpt));
}
