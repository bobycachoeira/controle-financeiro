import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outfile = resolve(here, "../../../apps/pocketbase/pb_hooks/lib/shared.js");

mkdirSync(dirname(outfile), { recursive: true });

await build({
  entryPoints: [resolve(here, "../src/index.ts")],
  outfile,
  bundle: true,
  format: "cjs",
  platform: "neutral",
  target: ["es2017"],
  logLevel: "info",
  banner: { js: "/* AUTO-GENERATED from @cf/shared. Do not edit. */" },
});

console.log(`Generated ${outfile}`);
