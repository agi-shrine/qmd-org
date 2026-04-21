import type { CodeFenceRegion, FormatAdapter } from "./types.js";

const ORG_BREAK_PATTERNS: [RegExp, number, string][] = [
  [/\n\*{1}(?!\*)\s/g, 100, 'h1'],
  [/\n\*{2}(?!\*)\s/g, 90, 'h2'],
  [/\n\*{3}(?!\*)\s/g, 80, 'h3'],
  [/\n\*{4}(?!\*)\s/g, 70, 'h4'],
  [/\n\*{5}(?!\*)\s/g, 60, 'h5'],
  [/\n\*{6}\s/g, 50, 'h6'],
  [/\n#\+BEGIN_SRC/gi, 80, 'srcblock'],
  [/\n#\+END_SRC/gi, 80, 'srcblock'],
  [/\n#\+BEGIN_EXAMPLE/gi, 80, 'example'],
  [/\n#\+END_EXAMPLE/gi, 80, 'example'],
  [/\n#\+BEGIN_QUOTE/gi, 60, 'quote'],
  [/\n#\+END_QUOTE/gi, 60, 'quote'],
  [/\n-{5,}\s*\n/g, 60, 'hr'],
  [/\n\n+/g, 20, 'blank'],
  [/\n[-+]\s/g, 5, 'list'],
  [/\n\d+[.)]\s/g, 5, 'numlist'],
  [/\n/g, 1, 'newline'],
];

const BEGIN_BLOCK = /\n#\+BEGIN_(SRC|EXAMPLE|QUOTE|VERSE|CENTER|COMMENT|EXPORT)\b[^\n]*/gi;
const END_BLOCK = /\n#\+END_(SRC|EXAMPLE|QUOTE|VERSE|CENTER|COMMENT|EXPORT)\b[^\n]*/gi;

function findOrgCodeFences(text: string): CodeFenceRegion[] {
  const regions: CodeFenceRegion[] = [];

  const begins: { pos: number; kind: string }[] = [];
  for (const m of text.matchAll(BEGIN_BLOCK)) {
    begins.push({ pos: m.index!, kind: m[1]!.toUpperCase() });
  }
  const ends: { pos: number; endPos: number; kind: string }[] = [];
  for (const m of text.matchAll(END_BLOCK)) {
    ends.push({ pos: m.index!, endPos: m.index! + m[0].length, kind: m[1]!.toUpperCase() });
  }

  let endIdx = 0;
  for (const begin of begins) {
    while (endIdx < ends.length && (ends[endIdx]!.pos <= begin.pos || ends[endIdx]!.kind !== begin.kind)) {
      endIdx++;
    }
    if (endIdx >= ends.length) {
      regions.push({ start: begin.pos, end: text.length });
      break;
    }
    regions.push({ start: begin.pos, end: ends[endIdx]!.endPos });
    endIdx++;
  }

  return regions;
}

function extractOrgTitle(content: string): string | null {
  const titleProp = content.match(/^#\+TITLE:\s*(.+)$/im);
  if (titleProp?.[1]) return titleProp[1].trim();
  const heading = content.match(/^\*+\s+(.+)$/m);
  if (heading?.[1]) return heading[1].trim();
  return null;
}

export const orgAdapter: FormatAdapter = {
  extensions: [".org"],
  breakPatterns: ORG_BREAK_PATTERNS,
  findCodeFences: findOrgCodeFences,
  extractTitle: extractOrgTitle,
};
