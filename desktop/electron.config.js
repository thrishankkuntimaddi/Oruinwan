/**
 * electron.config.js — Electron Builder configuration
 *
 * Defines packaging targets for macOS, Windows, and Linux.
 * The web app is loaded remotely (productionUrl) or from a local build.
 *
 * IMPORTANT: Do NOT modify client/ or server/ from this config.
 */

module.exports = {
  appId: "com.chttrix.desktop",
  productName: "Chttrix",
  copyright: `Copyright © ${new Date().getFullYear()} Chttrix`,

  // Output directory for built packages
  directories: {
    output: "dist",
    buildResources: "assets",
  },

  // Files to include in the Electron package
  files: [
    "main/**/*",
    "assets/**/*",
    "package.json",
  ],

  // ── macOS ──────────────────────────────────────────────────────────────
  mac: {
    category: "public.app-category.productivity",
    icon: "assets/icon.icns",
    target: [
      { target: "dmg", arch: ["universal"] },
      { target: "zip", arch: ["universal"] },
    ],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "assets/entitlements.mac.plist",
    entitlementsInherit: "assets/entitlements.mac.plist",
    // Set your Apple Team ID for notarization:
    // notarize: { teamId: "XXXXXXXXXX" },
  },

  dmg: {
    title: "Chttrix",
    backgroundColor: "#1a1a2e",
    window: { width: 540, height: 380 },
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" },
    ],
  },

  // ── Windows ────────────────────────────────────────────────────────────
  win: {
    icon: "assets/icon.ico",
    target: [
      { target: "nsis", arch: ["x64"] },
      { target: "portable", arch: ["x64"] },
    ],
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: "assets/icon.ico",
    uninstallerIcon: "assets/icon.ico",
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Chttrix",
  },

  // ── Linux ──────────────────────────────────────────────────────────────
  linux: {
    icon: "assets/icon.png",
    target: [
      { target: "AppImage", arch: ["x64"] },
      { target: "deb", arch: ["x64"] },
    ],
    category: "Office",
    description: "Chttrix — AI-Augmented Collaboration Platform",
  },

  // ── Auto-update feed ───────────────────────────────────────────────────
  // Reads from a GitHub release or S3 bucket — set your publish target here.
  publish: [
    {
      provider: "github",
      owner: "chttrix",
      repo: "chttrix-desktop-releases",
      private: false,
    },
  ],
};
