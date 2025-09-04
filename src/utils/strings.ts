// src/utils/strings.ts
export function cycle<T extends string>(v: T, arr: readonly T[]): T {
  const i = arr.indexOf(v);
  return arr[(i + 1) % arr.length];
}
export function sanitizeInner(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
export function extractTagInner(text: string, tag: string): string | null {
  const m = new RegExp(`<${tag}\\s*>[\\s\\S]*?<\\/${tag}>`, "i").exec(text);
  if (!m) return null;
  return m[0]
    .replace(new RegExp(`^<${tag}\\s*>`, "i"), "")
    .replace(new RegExp(`<\\/${tag}>$`, "i"), "")
    .trim();
}
