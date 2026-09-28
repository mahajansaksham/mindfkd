import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist/server", { recursive: true });
await cp("out", "dist/client", { recursive: true });
await build({
  entryPoints: ["server/index.ts"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["cloudflare:workers"],
  minify: true,
});
