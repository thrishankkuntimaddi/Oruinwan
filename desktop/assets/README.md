# Chttrix Desktop — Assets

Place the following icon files in this directory before building:

| Filename | Format | Size | Platform |
|---|---|---|---|
| `icon.png` | PNG | 512×512 | Linux, fallback for all |
| `icon.icns` | ICNS | multi-res | macOS |
| `icon.ico` | ICO | multi-res | Windows |
| `tray-icon.png` | PNG | 32×32 (retina: 64×64) | All (tray) |

## Source Recommendation
Use the existing Chttrix logo assets from `client/public/assets/`:
- `ChttrixLogo.svg` → convert to the required formats
- `ChttrixAI-logo.png` → resize for tray

## Conversion Tools
- macOS: `iconutil` (built-in)  
- Windows: [ImageMagick](https://imagemagick.org/) `convert icon.png icon.ico`
- Online: [CloudConvert](https://cloudconvert.com/png-to-icns)

## macOS Entitlements
For notarization, add `entitlements.mac.plist` here:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key><true/>
    <key>com.apple.security.network.client</key><true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  </dict>
</plist>
```

> **NOTE**: `dist/` (build outputs) are git-ignored. Never commit built binaries.
