{
  description = "QMD-Org - Quick Markdown Search (org-aware fork)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    {
      homeModules.default = { config, lib, pkgs, ... }:
        with lib;
        let
          cfg = config.programs.qmd-org;
        in
        {
          options.programs.qmd-org = {
            enable = mkEnableOption "QMD-Org - on-device semantic search for .org notes (fork of qmd)";

            package = mkOption {
              type = types.package;
              default = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
              defaultText = literalExpression "inputs.qmd-org.packages.\${pkgs.stdenv.hostPlatform.system}.default";
              description = "The qmd-org package to use.";
            };
          };

          config = mkIf cfg.enable {
            home.packages = [ cfg.package ];
          };
        };
    } //
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        packageJson = builtins.fromJSON (builtins.readFile ./package.json);
        version = packageJson.version;

        # SQLite with loadable extension support for sqlite-vec
        sqliteWithExtensions = pkgs.sqlite.overrideAttrs (old: {
          configureFlags = (old.configureFlags or []) ++ [
            "--enable-load-extension"
          ];
        });

        nodeModulesHashes = {
          x86_64-linux = "sha256-D0ezO4vqq4iswcAMU2DCql9ZAQvh3me6N9aDB5roq4w=";
          aarch64-darwin = "sha256-qU+9KdR/nTocelyANS09I/4yaQ+7s1LvJNqB27IOK/c=";

          # Populate these on first build for additional hosts if/when needed.
          aarch64-linux = pkgs.lib.fakeHash;
          x86_64-darwin = pkgs.lib.fakeHash;
        };

        nodeModules = pkgs.stdenvNoCC.mkDerivation {
          pname = "qmd-org-node-modules";
          inherit version;

          src = ./.;

          impureEnvVars = pkgs.lib.fetchers.proxyImpureEnvVars ++ [
            "GIT_PROXY_COMMAND"
            "SOCKS_SERVER"
          ];

          nativeBuildInputs = [
            pkgs.bun
          ];

          dontConfigure = true;

          buildPhase = ''
            export HOME=$(mktemp -d)

            bun install \
              --backend copyfile \
              --frozen-lockfile \
              --ignore-scripts \
              --no-progress \
              --production
          '';

          installPhase = ''
            mkdir -p $out
            cp -R node_modules $out/
          '';

          dontFixup = true;

          outputHash = nodeModulesHashes.${system};
          outputHashAlgo = "sha256";
          outputHashMode = "recursive";
        };

        qmd = pkgs.stdenv.mkDerivation {
          pname = "qmd-org";
          inherit version;

          src = ./.;

          nativeBuildInputs = [
            pkgs.bun
            pkgs.makeWrapper
            pkgs.nodejs
            pkgs.node-gyp
            pkgs.python3  # needed by node-gyp to compile better-sqlite3
          ] ++ pkgs.lib.optionals pkgs.stdenv.hostPlatform.isDarwin [
            pkgs.darwin.cctools  # provides libtool needed by node-gyp on macOS
          ];

          buildInputs = [ pkgs.sqlite ];

          buildPhase = ''
            export HOME=$(mktemp -d)

            cp -R ${nodeModules}/node_modules ./
            chmod -R u+w node_modules

            (cd node_modules/better-sqlite3 && node-gyp rebuild --release)
          '';

          installPhase = ''
            mkdir -p $out/lib/qmd-org
            mkdir -p $out/bin

            cp -r node_modules $out/lib/qmd-org/
            cp -r src $out/lib/qmd-org/
            cp -r assets $out/lib/qmd-org/
            cp package.json $out/lib/qmd-org/

            makeWrapper ${pkgs.bun}/bin/bun $out/bin/qmd-org \
              --add-flags "$out/lib/qmd-org/src/cli/qmd.ts" \
              --set DYLD_LIBRARY_PATH "${pkgs.sqlite.out}/lib" \
              --set LD_LIBRARY_PATH "${pkgs.sqlite.out}/lib"
          '';

          meta = with pkgs.lib; {
            description = "On-device semantic search for .org notes (org-aware fork of qmd)";
            homepage = "https://github.com/agi-shrine/qmd-org";
            license = licenses.mit;
            platforms = platforms.unix;
          };
        };
      in
      {
        packages = {
          default = qmd;
          qmd-org = qmd;
        };

        apps.default = {
          type = "app";
          program = "${qmd}/bin/qmd-org";
        };

        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.bun
            sqliteWithExtensions
          ];

          shellHook = ''
            export BREW_PREFIX="''${BREW_PREFIX:-${sqliteWithExtensions.out}}"
            echo "QMD-Org development shell"
            echo "Run: bun src/cli/qmd.ts <command>"
          '';
        };
      }
    );

}
