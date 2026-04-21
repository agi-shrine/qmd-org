import { describe, test, expect } from "vitest";
import { getAdapter, markdownAdapter, orgAdapter } from "../src/formats/index.js";

describe("getAdapter", () => {
  test("returns org adapter for .org files", () => {
    expect(getAdapter("notes/project.org")).toBe(orgAdapter);
    expect(getAdapter("Notes.ORG")).toBe(orgAdapter);
  });

  test("returns markdown adapter for .md and .markdown", () => {
    expect(getAdapter("README.md")).toBe(markdownAdapter);
    expect(getAdapter("docs/guide.markdown")).toBe(markdownAdapter);
    expect(getAdapter("README.MD")).toBe(markdownAdapter);
  });

  test("falls back to markdown when filepath is missing", () => {
    expect(getAdapter()).toBe(markdownAdapter);
    expect(getAdapter(undefined)).toBe(markdownAdapter);
  });

  test("falls back to markdown for unknown extensions", () => {
    expect(getAdapter("data/file.csv")).toBe(markdownAdapter);
    expect(getAdapter("notes.txt")).toBe(markdownAdapter);
  });

  test("works with virtual qmd:// paths", () => {
    expect(getAdapter("qmd://journals/2026-04-21.org")).toBe(orgAdapter);
    expect(getAdapter("qmd://docs/README.md")).toBe(markdownAdapter);
  });
});

describe("markdownAdapter", () => {
  test("extracts H1 title", () => {
    expect(markdownAdapter.extractTitle("# Title\n\nbody")).toBe("Title");
  });

  test("skips generic 📝 Notes heading", () => {
    const content = "# 📝 Notes\n\n## Real Title\n\nbody";
    expect(markdownAdapter.extractTitle(content)).toBe("Real Title");
  });

  test("findCodeFences detects backtick blocks", () => {
    const fences = markdownAdapter.findCodeFences("Before\n```\ncode\n```\nAfter");
    expect(fences.length).toBe(1);
  });
});

describe("orgAdapter", () => {
  test("extracts #+TITLE property", () => {
    expect(orgAdapter.extractTitle("#+TITLE: The Title\n\n* Heading")).toBe("The Title");
  });

  test("falls back to first * heading", () => {
    expect(orgAdapter.extractTitle("* Heading One\nbody")).toBe("Heading One");
  });

  test("findCodeFences detects #+BEGIN_SRC blocks", () => {
    const doc = "Intro\n#+BEGIN_SRC bash\necho hi\n#+END_SRC\nOutro";
    const fences = orgAdapter.findCodeFences(doc);
    expect(fences.length).toBe(1);
    expect(fences[0]!.start).toBeGreaterThan(0);
    expect(fences[0]!.end).toBeGreaterThan(fences[0]!.start);
    expect(doc.slice(fences[0]!.start, fences[0]!.end)).toContain("#+BEGIN_SRC");
    expect(doc.slice(fences[0]!.start, fences[0]!.end)).toContain("#+END_SRC");
  });

  test("findCodeFences detects #+BEGIN_EXAMPLE blocks", () => {
    const doc = "Intro\n#+BEGIN_EXAMPLE\nsample\n#+END_EXAMPLE\nOutro";
    const fences = orgAdapter.findCodeFences(doc);
    expect(fences.length).toBe(1);
  });

  test("findCodeFences is case-insensitive", () => {
    const doc = "Intro\n#+begin_src js\nfoo\n#+end_src\nOutro";
    const fences = orgAdapter.findCodeFences(doc);
    expect(fences.length).toBe(1);
  });

  test("findCodeFences handles unclosed block", () => {
    const doc = "Intro\n#+BEGIN_SRC\nnever closed\nmore";
    const fences = orgAdapter.findCodeFences(doc);
    expect(fences.length).toBe(1);
    expect(fences[0]!.end).toBe(doc.length);
  });

  test("findCodeFences handles multiple blocks", () => {
    const doc = "\n#+BEGIN_SRC\nA\n#+END_SRC\n\n#+BEGIN_EXAMPLE\nB\n#+END_EXAMPLE";
    const fences = orgAdapter.findCodeFences(doc);
    expect(fences.length).toBe(2);
  });

  test("breakPatterns scores * headings by depth", () => {
    const byType = new Map(orgAdapter.breakPatterns.map(([, score, type]) => [type, score]));
    expect(byType.get("h1")).toBe(100);
    expect(byType.get("h2")).toBe(90);
    expect(byType.get("h3")).toBe(80);
    expect(byType.get("h6")).toBe(50);
    expect(byType.get("srcblock")).toBe(80);
    expect(byType.get("blank")).toBe(20);
  });
});
