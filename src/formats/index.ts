import { extname } from "node:path";
import { markdownAdapter } from "./markdown.js";
import { orgAdapter } from "./org.js";
import type { FormatAdapter } from "./types.js";

export type { FormatAdapter, BreakPoint, CodeFenceRegion } from "./types.js";
export { markdownAdapter, orgAdapter };

const ADAPTERS: FormatAdapter[] = [markdownAdapter, orgAdapter];

const byExt = new Map<string, FormatAdapter>();
for (const adapter of ADAPTERS) {
  for (const ext of adapter.extensions) {
    byExt.set(ext.toLowerCase(), adapter);
  }
}

export function getAdapter(filepath?: string): FormatAdapter {
  if (!filepath) return markdownAdapter;
  const ext = extname(filepath).toLowerCase();
  return byExt.get(ext) ?? markdownAdapter;
}
