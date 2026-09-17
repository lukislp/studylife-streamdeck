// esbuild bundle for the plugin process. CommonJS output so Stream Deck's `node bin/plugin.js` can
// run it directly - see plugin.ts's note on why it avoids top-level await.
import { build, context } from "esbuild";

const options = {
  entryPoints: ["src/plugin.ts"],
  bundle: true,
  outfile: "com.lukislp.studylife.sdPlugin/bin/plugin.js",
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  minify: !process.argv.includes("--watch"),
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
