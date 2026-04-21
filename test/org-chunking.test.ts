import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chunkDocument,
  chunkDocumentAsync,
  scanBreakPoints,
  findCodeFences,
  isInsideCodeFence,
} from "../src/store.js";

const FIXTURES = join(__dirname, "eval-docs");

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

describe("org chunking — break points", () => {
  test("scanBreakPoints routes to org adapter for .org files", () => {
    const text = "intro\n* One\nbody\n** Two\nmore\n#+BEGIN_SRC\ncode\n#+END_SRC";
    const breaks = scanBreakPoints(text, "doc.org");

    const h1 = breaks.find(b => b.type === "h1");
    const h2 = breaks.find(b => b.type === "h2");
    const src = breaks.filter(b => b.type === "srcblock");

    expect(h1?.score).toBe(100);
    expect(h2?.score).toBe(90);
    expect(src.length).toBe(2);
    expect(src[0]!.score).toBe(80);
  });

  test("scanBreakPoints without filepath uses markdown (no org headings detected)", () => {
    const text = "intro\n* One\nbody";
    const breaks = scanBreakPoints(text);
    expect(breaks.find(b => b.type === "h1")).toBeUndefined();
  });

  test("scanBreakPoints does not treat markdown # as a heading in org mode", () => {
    const text = "intro\n# Not a heading\nbody";
    const breaks = scanBreakPoints(text, "doc.org");
    expect(breaks.find(b => b.type === "h1")).toBeUndefined();
  });
});

describe("org chunking — code fences", () => {
  test("findCodeFences routes to org adapter", () => {
    const doc = readFixture("org-with-src-block.org");
    const fences = findCodeFences(doc, "x.org");
    expect(fences.length).toBeGreaterThanOrEqual(2);

    const srcBegin = doc.indexOf("#+BEGIN_SRC");
    const srcEnd = doc.indexOf("#+END_SRC") + "#+END_SRC".length;
    const srcFence = fences.find(f => f.start <= srcBegin && f.end >= srcEnd);
    expect(srcFence).toBeDefined();
  });

  test("org break points include #+BEGIN_SRC markers as high-score cut candidates", () => {
    const doc = readFixture("org-with-src-block.org");
    const breaks = scanBreakPoints(doc, "x.org");

    const srcBegins = breaks.filter(b => b.type === "srcblock");
    expect(srcBegins.length).toBeGreaterThanOrEqual(2); // BEGIN and END

    // The position of each srcblock break must correspond to a \n#+ marker.
    for (const b of srcBegins) {
      expect(doc[b.pos]).toBe("\n");
      expect(doc.slice(b.pos, b.pos + 3)).toBe("\n#+");
    }
  });

  test("src-block break points are excluded when inside a fence region", () => {
    const doc = readFixture("org-with-src-block.org");
    const breaks = scanBreakPoints(doc, "x.org");
    const fences = findCodeFences(doc, "x.org");

    // The #+END_SRC marker sits inside the fence region (its fence end == its own end).
    // Ensure fence region fully contains the #+BEGIN_SRC start position.
    const begin = breaks.find(b => b.type === "srcblock" && doc.slice(b.pos, b.pos + 12) === "\n#+BEGIN_SRC");
    expect(begin).toBeDefined();
    // BEGIN marker sits AT the fence start, not strictly inside (so isInsideCodeFence is false there).
    expect(isInsideCodeFence(begin!.pos, fences)).toBe(false);

    // But a position midway through the fence is inside.
    const midFence = Math.floor((fences[0]!.start + fences[0]!.end) / 2);
    expect(isInsideCodeFence(midFence, fences)).toBe(true);
  });
});

describe("org chunking — heading preference", () => {
  test("chunkDocument prefers * headings over paragraphs", () => {
    const doc = readFixture("org-nested-headings.org");
    const chunks = chunkDocument(doc, 500, 50, 250, "x.org");
    expect(chunks.length).toBeGreaterThan(1);

    // The cut between chunk i-1 and chunk i is at chunks[i-1].pos + chunks[i-1].text.length.
    let headingCuts = 0;
    let totalCuts = 0;
    for (let i = 0; i < chunks.length - 1; i++) {
      const end = chunks[i]!.pos + chunks[i]!.text.length;
      totalCuts++;
      // A headline break point is the \n before a line starting with '*'.
      if (doc[end] === "\n" && /\*{1,6}\s/.test(doc.slice(end + 1, end + 8))) {
        headingCuts++;
      }
    }
    expect(totalCuts).toBeGreaterThan(0);
    expect(headingCuts).toBeGreaterThan(0);
  });

  test("chunkDocumentAsync in regex mode behaves like chunkDocument for .org", async () => {
    const doc = readFixture("org-nested-headings.org");
    const sync = chunkDocument(doc, 400, 40, 200, "x.org");
    const asyncChunks = await chunkDocumentAsync(doc, 400, 40, 200, "x.org", "regex");

    expect(asyncChunks.length).toBe(sync.length);
    for (let i = 0; i < sync.length; i++) {
      expect(asyncChunks[i]!.pos).toBe(sync[i]!.pos);
      expect(asyncChunks[i]!.text).toBe(sync[i]!.text);
    }
  });
});
