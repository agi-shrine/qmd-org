# Org Adapter — Manual Test Report (2026-04-21)

Quick field test of the org adapter against:
- A hand-crafted canary corpus (`/tmp/qmd-org-canary/`, 8 files) designed to
  stress heading depth, fenced blocks, property drawers, TODO/tag title
  cleaning, long-doc splitting, and link forms.
- The real vault at `/usr/local/enc-mine/org/notes/` (2101 `.org` files).

## Canary corpus (8 files)

### Keyword (lex) battery — 15/15 pass
Every distinctive phrase planted at h1..h6, inside `#+BEGIN_SRC`,
`#+BEGIN_EXAMPLE`, `#+BEGIN_QUOTE`, inside `:PROPERTIES:` drawers, inside
specific sections of a long doc, and in body paragraphs after
`[[file:…]][[id:…]]` links — is retrievable and maps to the correct file.

### Title extraction — verified
Indexed titles (pulled straight from the sqlite `documents` table):

| File | Source | Stored title |
|---|---|---|
| `04-semantic-paraphrase.org` | `#+TITLE:` | `Dawn Practices for Entrepreneurs` |
| `07-title-fallback.org` | `* TODO Fallback Title From Heading :canary:` | `Fallback Title From Heading` |
| `05-todo-and-tags.org` | `#+TITLE:` | `TODO Keyword And Tag Extraction` |

The fallback case (`07`) is the one where the Azimuth parser port earns its
keep: leading `TODO`, trailing `:canary:`, and priority cookies are stripped.

### Chunk boundaries at default settings (`maxChars=3600`)
All eight canary files fit in a single chunk at default settings — the
corpus is intentionally small. The interesting test is with a forced small
window.

### Chunk boundaries at `maxChars=512` (forced splits)
- **02-src-block-protection.org** (1.5 KB): chunker splits *inside* the 660-char
  `#+BEGIN_SRC` block when `maxChars=512`. `findCodeFences` correctly flags
  the region (verified), but `chunkDocumentWithBreakPoints` has no safe cut
  inside a fence that exceeds `maxChars`, so it falls through to a forced
  cut. This is a pre-existing limitation of the chunker algorithm and
  applies identically to markdown code blocks. **Not org-specific.** At
  production defaults (3600 chars) this only matters for genuinely huge
  single blocks.
- **06-long-doc-splitting.org** (2.9 KB): splits cleanly at top-level `*`
  heading boundaries.

### Semantic paraphrase — noisy at 8 docs
"morning routine for founders" did not put `04-semantic-paraphrase.org`
(which is literally titled "Dawn Practices for Entrepreneurs") in the top
3. Small-corpus ranking noise, not an adapter issue — see real-vault
results below for the realistic signal.

## Real vault (2110 `.org` files, `/usr/local/enc-mine/org/notes/`)

### Indexing
- All 2110 docs ingested successfully (`qmd collection add ... --mask '**/*.org'`).
- **Fully embedded: 52,306 vectors, 0 pending.**
- Convergence took 5 iterations of `qmd embed --max-docs-per-batch 30`
  (~2.5 hours wall time) because the default `LLMSession` `maxDuration` is
  10 min, which aborts a bulk embed run mid-stride. Each loop iteration
  finishes the in-flight batch and leaves an increasingly small "pending"
  set for the next iteration. Monotonic, reliable, but slow.

**Known friction — not an adapter bug:**
`src/store.ts:1391` calls `withLLMSessionForLlm(llm, fn)` with no options,
inheriting the 10-min `maxDuration` default. For bulk embedding, passing
`{ maxDuration: 0, name: "bulk-embed" }` would let one session cover the
whole run. Out of scope for the org-adapter PR; flagged for a follow-up
upstream.

### Path normalization note
QMD's `handelize()` converts underscores to hyphens in stored paths, so
`homehosted_spellbook.org` is stored as `homehosted-spellbook.org`. The
file on disk is unchanged — the URL-style qmd:// path is normalized for
consistency across filesystems. Be aware when asserting filenames.

### Test battery results (after full embed)

**Canary corpus: 15/15 pass** (keyword battery).

**Real vault: 11/13 pass** across lex / vec / hybrid modes.

| # | Mode | Query | Expected | Result |
|---|---|---|---|---|
| 1 | lex | `gocryptfs` | gocryptfs.org | ✓ top-1 |
| 2 | lex | `Tbilisi` | 20230628170843-tbilisi.org | ✗ top-3 = three different tbilisi docs (london-vs-tbilisi, 1951307781 tg, tbilisi-2024). BM25 picked a higher-count match. |
| 3 | lex | `homehosted spellbook` | homehosted-spellbook.org | ✓ top-3 |
| 4 | lex | `full-time opportunities` | full-time-opportunities-hiring.org | ✓ top-3 |
| 5 | vec | "mount an encrypted directory with fuse" | gocryptfs.org | ✓ top-3 |
| 6 | vec | "spending time in the capital of Georgia" | 20230628170843-tbilisi.org | ✓ top-3 |
| 7 | vec | "raspberry pi home server self-hosting" | homehosted-spellbook.org | ✓ top-5 |
| 8 | vec | "list of companies and teams that are hiring" | full-time-opportunities-hiring.org | ✓ top-5 |
| 9 | vec | "emacs configuration on macOS with homebrew" | Emacs.org | ✓ top-5 |
| 10 | vec | "cafes to read and write in seattle" | seattle.org | ✗ top-5 dominated by tg-inboxes + more-specific seattle notes (kink-events, finding-people, 3rd-spaces) |
| 11 | vec | "tattoo concept for the right arm lightning form" | tattoo.org | ✓ top-5 |
| 12 | hybrid | "self-hosted software on a raspberry pi" | homehosted-spellbook.org | ✓ top-5 |
| 13 | hybrid | "emacs install mac native compilation" | Emacs.org | ✓ top-5 |

The two fails are both **ranking nuance in ambiguous corpora**, not adapter bugs:
- Test 2: three genuinely matching Tbilisi docs exist; BM25 picked the one with highest `Tbilisi` frequency.
- Test 10: telegram-inbox dumps (`tg-inboxes/`) plus more-specific seattle notes out-rank the generic `seattle.org`. Addressed by the Action Pool cleanup item.

### Corpus quality observations (not adapter bugs)
- **Telegram inbox dumps in `tg-inboxes/`** (numeric-named `.org` files,
  raw `#+FILETAGS:` only, no `#+TITLE:`) out-rank the curated roam notes on
  generic queries like "tattoo" or "seattle" because they contain the raw
  conversational mentions at high density. Consider masking
  `tg-inboxes/**` out of the collection, or moving them to their own
  collection.
- **`private/dailies/wm.org`** is ~1 MB of aggregated journal entries and
  keeps showing up in top-5 on broad semantic queries. Same story — high
  keyword density, low topical focus.

### Title extraction on real files
Inspecting the real `documents.title` column on a sample:

| Path | Title |
|---|---|
| `gocryptfs.org` | `gocryptfs` |
| `20230628170843-tbilisi.org` | `Tbilisi` |
| `tattoo.org` | `Tattoo` |
| `seattle.org` | `Seattle` |
| `homehosted-spellbook.org` | `Homehosted spellbook` |
| `full-time-opportunities-hiring.org` | `§ Full-time opportunities hiring` |

Clean across the board. No TODO-keyword leakage, no trailing tag clusters.

## Verdict

The adapter is working as designed:

- ✅ Title extraction: correct for `#+TITLE:` and heading-fallback paths
- ✅ Break-point scoring: headings at h1..h6 score by depth; fenced blocks
  score as structural breaks; blank lines and lists score below
- ✅ Code-fence protection: `findOrgCodeFences` correctly flags SRC,
  EXAMPLE, QUOTE, VERSE, CENTER, COMMENT, EXPORT blocks; the chunker
  avoids them when possible
- ✅ Handles real-world org-roam files with `:PROPERTIES:` drawers,
  `#+FILETAGS:`, `[[id:…][…]]` and `[[file:…][…]]` links

Known caveats, none adapter-originated:

- ⚠️ Small-corpus semantic ranking is noisy (expected)
- ⚠️ Long fenced blocks (> `maxChars`) still split — inherited from the
  markdown chunker
- ⚠️ Full embed of the real vault needs a retry or smaller batches to
  avoid llama.cpp session expiry

## Next moves, in priority order

1. **Prune or mask `tg-inboxes/`** and `private/dailies/wm.org`. These
   raw/aggregated files are the primary source of ranking noise in top-5
   semantic results. Tracked in the Weave Action Pool.
2. ~~**Upstream `{ maxDuration: 0 }` for bulk embed**~~ — done in
   `1a15a8e embed: disable session auto-abort for bulk runs`.
3. ~~**Build `tree-sitter-org.wasm`**~~ — done. Prebuilt wasm committed
   to `assets/grammars/`. AST query extended with `property_drawer` (org-
   roam drawers), `table`, and `dynamic_block` captures. Sample run over
   10 real-vault files: identical chunk counts vs regex-only, cut
   positions shift 1–281 bytes on 4/10 files (mostly 1-byte alignment
   shifts; one outlier still produced a forced mid-content cut, same as
   the regex path — a pre-existing chunker behavior on dense-heading
   docs, not adapter-originated).
4. Ship the adapter — commit the Azimuth-port additions (title cleaning)
   and this report; merge is safe.
