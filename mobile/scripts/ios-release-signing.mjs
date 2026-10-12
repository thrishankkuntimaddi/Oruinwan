// CI only: switches the iOS app target's Release configuration to manual App Store signing.
// Signing settings passed on the xcodebuild command line would also hit the Swift package
// targets, which can't take a provisioning profile, so they're written into the project instead.
// Usage: node scripts/ios-release-signing.mjs <team id> <provisioning profile name>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [team, profile] = process.argv.slice(2);
if (!team || !profile) {
  console.error('usage: ios-release-signing.mjs <team id> <provisioning profile name>');
  process.exit(1);
}
const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
const quote = (v) => `"${String(v).replace(/["\\]/g, '\\$&')}"`;

let patched = 0;
const project = readFileSync(file, 'utf8').replace(
  /(\/\* Release \*\/ = \{\s*isa = XCBuildConfiguration;\s*buildSettings = \{)([\s\S]*?)(\n\t\t\t\};\s*name = Release;)/g,
  (block, head, settings, tail) => {
    if (!settings.includes('PRODUCT_BUNDLE_IDENTIFIER = com.oruinwan.app;')) return block;
    patched += 1;
    const next = settings
      .replace(/\n\t\t\t\t(CODE_SIGN_STYLE|DEVELOPMENT_TEAM|PROVISIONING_PROFILE_SPECIFIER|"?CODE_SIGN_IDENTITY(\[sdk=iphoneos\*\])?"?) = [^;]*;/g, '')
      .concat(
        '\n\t\t\t\tCODE_SIGN_STYLE = Manual;',
        `\n\t\t\t\tDEVELOPMENT_TEAM = ${quote(team)};`,
        `\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = ${quote(profile)};`,
        '\n\t\t\t\t"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution";',
      );
    return `${head}${next}${tail}`;
  },
);
if (patched !== 1) {
  console.error(`Expected one Release configuration for com.oruinwan.app, found ${patched}.`);
  process.exit(1);
}
writeFileSync(file, project);
console.log(`App target Release: manual signing, team ${team}, profile "${profile}"`);
