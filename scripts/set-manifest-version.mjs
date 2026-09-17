// Run by @semantic-release/exec's prepareCmd, before @semantic-release/git stages the release
// commit (see .releaserc.json) - keeps manifest.json's own Version field tracking package.json's
// semantic-release-bumped version, the one deviation from the studylife-vscode template's release
// pipeline this plugin needs, because Stream Deck reads its own version from the manifest, not
// from package.json.
//
// The manifest schema requires a 4-part version (x.x.x.x, see @elgato/schemas' pattern on
// Manifest.Version), while semantic-release produces 3-part semver - so this appends a ".0".
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`set-manifest-version: expected a 3-part semver argument, got "${version ?? ""}"`);
  process.exit(1);
}

const manifestPath = "com.lukislp.studylife.sdPlugin/manifest.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.Version = `${version}.0`;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`set-manifest-version: manifest.json Version -> ${manifest.Version}`);
