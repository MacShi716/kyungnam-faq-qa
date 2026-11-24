import esbuild from "esbuild";
import fs from "node:fs";

const license = fs.readFileSync(new URL("../assets/map/THREE-LICENSE.txt", import.meta.url), "utf8").trim();
const banner = `/*!
 * Campus map runtime bundles three@0.187.0 (OrbitControls included).
 * ${license.split("\n").join("\n * ")}
 */`;

await esbuild.build({
  entryPoints: ["map-src/campus-map.js"],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "CampusMap",
  outfile: "assets/map/campus-map.min.js",
  legalComments: "none",
  target: ["es2020"],
  banner: { js: banner },
});
