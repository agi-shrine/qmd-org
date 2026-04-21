# Bundled Tree-sitter Grammars

Drop prebuilt `.wasm` grammar files here for grammars that are not published as
npm packages. `src/ast.ts` (`resolveGrammarPath`) checks this directory before
falling back to `require.resolve("<pkg>/<wasm>")`.

## tree-sitter-org.wasm

A prebuilt `tree-sitter-org.wasm` lives in this directory. No npm package
exists for this grammar (upstream: https://github.com/milisims/tree-sitter-org).
`src/ast.ts` (`resolveGrammarPath`) loads it from here before falling back
to `require.resolve()`. If the file is missing, QMD silently falls back to
regex-only chunking for `.org` files.

### Rebuilding from scratch

Grammar 1.3.3 at upstream HEAD as of 2026-04 predates `tree-sitter.json`;
`tree-sitter build --wasm` needs one to run. The one committed into the
clone below is minimal — adapt if the grammar gains a proper one upstream.

```sh
# one-time tooling (choose one):
brew install emscripten        # simplest but pulls in openjdk/cmake/python
# or: clone emsdk and install latest
git clone https://github.com/emscripten-core/emsdk /tmp/emsdk
(cd /tmp/emsdk && ./emsdk install latest && ./emsdk activate latest)
source /tmp/emsdk/emsdk_env.sh

# grammar + build:
git clone https://github.com/milisims/tree-sitter-org /tmp/ts-org
cd /tmp/ts-org
# write a minimal tree-sitter.json so the 0.25+ CLI finds the grammar:
cat > tree-sitter.json <<'JSON'
{
  "grammars": [{ "name": "org", "scope": "source.org", "path": ".", "file-types": ["org"] }],
  "metadata": { "version": "1.3.3", "license": "MIT" },
  "bindings": { "c": false, "go": false, "node": true, "python": false, "rust": true, "swift": false }
}
JSON
tree-sitter build --wasm -o tree-sitter-org.wasm
cp tree-sitter-org.wasm <this repo>/assets/grammars/
```

The output is ~480 KB.
