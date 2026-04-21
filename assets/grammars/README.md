# Bundled Tree-sitter Grammars

Drop prebuilt `.wasm` grammar files here for grammars that are not published as
npm packages. `src/ast.ts` (`resolveGrammarPath`) checks this directory before
falling back to `require.resolve("<pkg>/<wasm>")`.

## tree-sitter-org.wasm

No npm package exists for tree-sitter-org (upstream:
https://github.com/milisims/tree-sitter-org). Until a wasm build is committed
here, QMD falls back to regex-only chunking for `.org` files, which is still
correct — you just miss the structural AST boundaries.

To build the wasm yourself:

```sh
# one-time tooling:
npm install -g tree-sitter-cli

# build:
git clone https://github.com/milisims/tree-sitter-org /tmp/ts-org
cd /tmp/ts-org
tree-sitter build --wasm     # needs Docker or a local emcc
cp tree-sitter-org.wasm <this repo>/assets/grammars/
```
