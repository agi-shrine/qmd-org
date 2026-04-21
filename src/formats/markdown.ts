import type { CodeFenceRegion, FormatAdapter } from "./types.js";

const BREAK_PATTERNS: [RegExp, number, string][] = [
  [/\n#{1}(?!#)/g, 100, 'h1'],
  [/\n#{2}(?!#)/g, 90, 'h2'],
  [/\n#{3}(?!#)/g, 80, 'h3'],
  [/\n#{4}(?!#)/g, 70, 'h4'],
  [/\n#{5}(?!#)/g, 60, 'h5'],
  [/\n#{6}(?!#)/g, 50, 'h6'],
  [/\n```/g, 80, 'codeblock'],
  [/\n(?:---|\*\*\*|___)\s*\n/g, 60, 'hr'],
  [/\n\n+/g, 20, 'blank'],
  [/\n[-*]\s/g, 5, 'list'],
  [/\n\d+\.\s/g, 5, 'numlist'],
  [/\n/g, 1, 'newline'],
];

function findMarkdownCodeFences(text: string): CodeFenceRegion[] {
  const regions: CodeFenceRegion[] = [];
  const fencePattern = /\n```/g;
  let inFence = false;
  let fenceStart = 0;

  for (const match of text.matchAll(fencePattern)) {
    if (!inFence) {
      fenceStart = match.index!;
      inFence = true;
    } else {
      regions.push({ start: fenceStart, end: match.index! + match[0].length });
      inFence = false;
    }
  }

  if (inFence) {
    regions.push({ start: fenceStart, end: text.length });
  }

  return regions;
}

function extractMarkdownTitle(content: string): string | null {
  const match = content.match(/^##?\s+(.+)$/m);
  if (match) {
    const title = (match[1] ?? "").trim();
    if (title === "📝 Notes" || title === "Notes") {
      const nextMatch = content.match(/^##\s+(.+)$/m);
      if (nextMatch?.[1]) return nextMatch[1].trim();
    }
    return title;
  }
  return null;
}

export const markdownAdapter: FormatAdapter = {
  extensions: [".md", ".markdown"],
  breakPatterns: BREAK_PATTERNS,
  findCodeFences: findMarkdownCodeFences,
  extractTitle: extractMarkdownTitle,
};
