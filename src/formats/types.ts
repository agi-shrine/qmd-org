import type { BreakPoint, CodeFenceRegion } from "../store.js";

export type { BreakPoint, CodeFenceRegion };

export interface FormatAdapter {
  extensions: string[];
  breakPatterns: [RegExp, number, string][];
  findCodeFences(text: string): CodeFenceRegion[];
  extractTitle(content: string): string | null;
}
