// src/core/token.ts
import { encode } from "gpt-tokenizer/model/gpt-4o";
import { ConsolidateItem } from "./types";
import { originalDocTexts } from "./state";

export function itemTokenCount(item: ConsolidateItem): number {
  if (item.type === "file") {
    const txt = originalDocTexts.get(item.uri);
    return txt ? encode(txt).length : 0;
  }
  return encode(item.text).length;
}
export function itemLineCount(item: ConsolidateItem): number {
  if (item.type === "file") {
    const txt = originalDocTexts.get(item.uri);
    return txt ? txt.split("\n").length : 0;
  }
  return item.range.end.line - item.range.start.line + 1;
}
export function calcTotals(items: ConsolidateItem[]): {
  tokens: number;
  lines: number;
} {
  let tokens = 0,
    lines = 0;
  for (const i of items) {
    tokens += itemTokenCount(i);
    lines += itemLineCount(i);
  }
  return { tokens, lines };
}
export function weightEmojiDynamic(
  tokens: number,
  lines: number,
  fraction: number,
  avgTok: number
): string {
  if (tokens >= 7500 || lines >= 800 || fraction >= 0.4 || tokens >= avgTok * 2)
    return "🔴";
  if (tokens >= 2500 || lines >= 400 || fraction >= 0.15 || tokens >= avgTok)
    return "🟡";
  return "🟢";
}
