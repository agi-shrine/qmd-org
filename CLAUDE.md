# QMD-Org - Query Markup Documents (org-aware fork)

This repo is a fork of qmd with first-class org-mode support. It installs
as a **separate binary `qmd-org`** (not `qmd`) and uses a **separate index
at `~/.cache/qmd-org/index.sqlite`** so it can coexist with a stock
upstream `qmd` on the same machine without colliding.

Use Bun instead of Node.js (`bun` not `node`, `bun install` not `npm install`).

## Commands

All examples below use the `qmd-org` binary. If you `bun link` from this
repo, that's what lands on your PATH. The subcommand surface is identical
to upstream qmd.

```sh
qmd-org collection add . --name <n>   # Create/index collection
qmd-org collection list               # List all collections with details
qmd-org collection remove <name>      # Remove a collection by name
qmd-org collection rename <old> <new> # Rename a collection
qmd-org ls [collection[/path]]        # List collections or files in a collection
qmd-org context add [path] "text"     # Add context for path (defaults to current dir)
qmd-org context list                  # List all contexts
qmd-org context check                 # Check for collections/paths missing context
qmd-org context rm <path>             # Remove context
qmd-org get <file>                    # Get document by path or docid (#abc123)
qmd-org multi-get <pattern>           # Get multiple docs by glob or comma-separated list
qmd-org status                        # Show index status and collections
qmd-org update [--pull]               # Re-index all collections (--pull: git pull first)
qmd-org embed                         # Generate vector embeddings (uses node-llama-cpp)
qmd-org query <query>                 # Search with query expansion + reranking (recommended)
qmd-org search <query>                # Full-text keyword search (BM25, no LLM)
qmd-org vsearch <query>               # Vector similarity search (no reranking)
qmd-org mcp                           # Start MCP server (stdio transport)
qmd-org mcp --http [--port N]         # Start MCP server (HTTP, default port 8181)
qmd-org mcp --http --daemon           # Start as background daemon
qmd-org mcp stop                      # Stop background MCP daemon
```

## Collection Management

```sh
# List all collections
qmd-org collection list

# Create a collection for the org notes vault
qmd-org collection add /usr/local/enc-mine/org/notes --name org-notes --mask '**/*.org'

# Create a collection with explicit name
qmd-org collection add ~/Documents/notes --name mynotes --mask '**/*.md'

# Remove a collection
qmd-org collection remove mynotes

# Rename a collection
qmd-org collection rename mynotes my-notes

# List all files in a collection
qmd-org ls mynotes

# List files with a path prefix
qmd-org ls journals/2025
qmd-org ls qmd://journals/2025
```

## Context Management

```sh
# Add context to current directory (auto-detects collection)
qmd-org context add "Description of these files"

# Add context to a specific path
qmd-org context add /subfolder "Description for subfolder"

# Add global context to all collections (system message)
qmd-org context add / "Always include this context"

# Add context using virtual paths
qmd-org context add qmd://journals/ "Context for entire journals collection"
qmd-org context add qmd://journals/2024 "Journal entries from 2024"

# List all contexts
qmd-org context list

# Check for collections or paths without context
qmd-org context check

# Remove context
qmd-org context rm qmd://journals/2024
qmd-org context rm /  # Remove global context
```

## Document IDs (docid)

Each document has a unique short ID (docid) - the first 6 characters of its content hash.
Docids are shown in search results as `#abc123` and can be used with `get` and `multi-get`:

```sh
# Search returns docid in results
qmd-org search "query" --json
# Output: [{"docid": "#abc123", "score": 0.85, "file": "docs/readme.md", ...}]

# Get document by docid
qmd-org get "#abc123"
qmd-org get abc123              # Leading # is optional

# Docids also work in multi-get comma-separated lists
qmd-org multi-get "#abc123, #def456"
```

## Options

```sh
# Search & retrieval
-c, --collection <name>  # Restrict search to a collection (matches pwd suffix)
-n <num>                 # Number of results
--all                    # Return all matches
--min-score <num>        # Minimum score threshold
--full                   # Show full document content
--line-numbers           # Add line numbers to output

# Multi-get specific
-l <num>                 # Maximum lines per file
--max-bytes <num>        # Skip files larger than this (default 10KB)

# Output formats (search and multi-get)
--json, --csv, --md, --xml, --files
```

## Development

```sh
bun src/cli/qmd.ts <command>   # Run from source
bun link                       # Install globally as 'qmd-org' (see bin entry in package.json)
```

### Installing qmd-org side-by-side with system qmd

```sh
# From this repo:
bun install
bun run build
bun link                       # creates a `qmd-org` symlink in bun's global bin

# Verify:
which qmd-org                  # …/.bun/bin/qmd-org
which qmd                      # should resolve to the stock system install (unchanged)
qmd-org status                 # reads/writes ~/.cache/qmd-org/index.sqlite
qmd status                     # reads/writes ~/.cache/qmd/index.sqlite
```

The two installs do NOT share an index — each writes to its own cache
directory. Adding the same path as a collection under both yields two
independent SQLite DBs and two independent embedding sets.

## Tests

All tests live in `test/`. Run everything:

```sh
npx vitest run --reporter=verbose test/
bun test --preload ./src/test-preload.ts test/
```

## Architecture

- SQLite FTS5 for full-text search (BM25)
- sqlite-vec for vector similarity search
- node-llama-cpp for embeddings (embeddinggemma), reranking (qwen3-reranker), and query expansion (Qwen3)
- Reciprocal Rank Fusion (RRF) for combining results
- Smart chunking: 900 tokens/chunk with 15% overlap, prefers markdown headings as boundaries
- AST-aware chunking: use `--chunk-strategy auto` to chunk code files (.ts/.js/.py/.go/.rs) and `.org` files at function/class/import (or headline/block/drawer/table) boundaries via tree-sitter. Default is `regex` (existing behavior). Markdown and unknown file types always use regex chunking.

## Tree-sitter grammars

Most grammars come from npm (`tree-sitter-typescript`, `tree-sitter-python`,
`tree-sitter-go`, `tree-sitter-rust`) and resolve via `require.resolve()`
at runtime — no extra setup needed.

`.org` chunking is the exception: no npm package exists for
`tree-sitter-org`, so `src/ast.ts` (`resolveGrammarPath`) looks for a
prebuilt `assets/grammars/tree-sitter-org.wasm` first and falls back to
regex-only chunking if missing. The wasm is checked into the repo (~484 KB).

If the wasm is missing or needs rebuilding (e.g. grammar upgrade), see
the recipe in `assets/grammars/README.md`. Short version:

```sh
# one-time: install emscripten (emsdk is lighter than the brew formula)
git clone https://github.com/emscripten-core/emsdk /tmp/emsdk
(cd /tmp/emsdk && ./emsdk install latest && ./emsdk activate latest)
source /tmp/emsdk/emsdk_env.sh

# build the grammar
git clone https://github.com/milisims/tree-sitter-org /tmp/ts-org
cd /tmp/ts-org
# grammar 1.3.3 predates `tree-sitter.json`; write a minimal one:
cat > tree-sitter.json <<'JSON'
{
  "grammars": [{ "name": "org", "scope": "source.org", "path": ".", "file-types": ["org"] }],
  "metadata": { "version": "1.3.3", "license": "MIT" },
  "bindings": { "c": false, "go": false, "node": true, "python": false, "rust": true, "swift": false }
}
JSON
tree-sitter build --wasm -o tree-sitter-org.wasm
cp tree-sitter-org.wasm <qmd repo>/assets/grammars/
```

Verify the grammar loads:

```sh
bun -e 'import("./src/ast.ts").then(m => m.getASTStatus()).then(s => console.log(s.languages))'
# expect: { language: "org", available: true } (alongside the other languages)
```

## Important: Do NOT run automatically

- Never run `qmd-org collection add`, `qmd-org embed`, or `qmd-org update` automatically
- Never modify the SQLite database directly
- Write out example commands for the user to run manually
- Index is stored at `~/.cache/qmd-org/index.sqlite`

## Do NOT compile

- Never run `bun build --compile` - it overwrites the shell wrapper and breaks sqlite-vec
- The `bin/qmd-org` file is a shell script that runs compiled JS from `dist/` - do not replace it
- `npm run build` compiles TypeScript to `dist/` via `tsc -p tsconfig.build.json`

## Releasing

Use `/release <version>` to cut a release. Full changelog standards,
release workflow, and git hook setup are documented in the
[release skill](skills/release/SKILL.md).

Key points:
- Add changelog entries under `## [Unreleased]` **as you make changes**
- The release script renames `[Unreleased]` → `[X.Y.Z] - date` at release time
- Credit external PRs with `#NNN (thanks @username)`
- GitHub releases roll up the full minor series (e.g. 1.2.0 through 1.2.3)
