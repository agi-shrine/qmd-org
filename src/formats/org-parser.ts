// Org-mode helpers ported from azimuth/src/parser/org_parser.ts.
// Scope here is limited to the pieces QMD needs for title/tag/property
// extraction — hierarchy, dates, and repeater parsing stay in Azimuth.

export const VALID_TODO_KEYWORDS = [
  "TODO",
  "DONE",
  "SPRINT",
  "PRJ",
  "Fleeting",
  "WAITING",
  "SDONE",
  "MDONE",
  "PDONE",
  "ACTIVE_HABIT",
  "INACTIVE_HABIT",
];

export function extractTags(headingLine: string): string[] {
  const tagMatch = headingLine.match(/(?:\s|:):([:a-zA-Z0-9@_]+(?::[a-zA-Z0-9@_]+)*):\s*$/);
  if (!tagMatch) return [];
  return tagMatch[1]!.split(":").filter(Boolean);
}

export function extractTodoState(headingLine: string): string | undefined {
  const todoMatch = headingLine.match(/^\*+\s+([A-Za-z]+)\s+/);
  if (!todoMatch) return undefined;
  const keyword = todoMatch[1]!;
  return VALID_TODO_KEYWORDS.find((k) => k.toLowerCase() === keyword.toLowerCase());
}

export function extractHeadingTitle(headingLine: string): string {
  let title = headingLine
    .replace(/^\*+\s+/, "")
    .replace(/(?:\s|:):([:a-zA-Z0-9@_]+(?::[a-zA-Z0-9@_]+)*):\s*$/, "")
    .trim();

  for (const state of VALID_TODO_KEYWORDS) {
    const re = new RegExp(`^${state}\\s+`, "i");
    if (re.test(title)) {
      title = title.slice(state.length).trim();
      break;
    }
  }

  // Strip priority cookies like "[#A]"
  title = title.replace(/^\[#[A-Z]\]\s+/, "").trim();

  if (title === "" || VALID_TODO_KEYWORDS.some((s) => title.toUpperCase() === s.toUpperCase())) {
    return "";
  }
  return title;
}

export function parseProperties(content: string): Record<string, string> {
  const properties: Record<string, string> = {};
  const drawer = content.match(/:PROPERTIES:\s*\n([\s\S]*?)\n:END:/);
  if (!drawer) return properties;
  for (const line of drawer[1]!.split("\n")) {
    const m = line.match(/:([^:]+):\s*(.+)/);
    if (m) properties[m[1]!.trim()] = m[2]!.trim();
  }
  return properties;
}

export function parseFileTags(content: string): string[] {
  const m = content.match(/^#\+FILETAGS:\s*(.+)$/m);
  if (!m) return [];
  const tags: string[] = [];
  for (const tagMatch of m[1]!.trim().matchAll(/:([:a-zA-Z0-9@_]+(?::[a-zA-Z0-9@_]+)*):/g)) {
    tags.push(...tagMatch[1]!.split(":").filter(Boolean));
  }
  return tags;
}
