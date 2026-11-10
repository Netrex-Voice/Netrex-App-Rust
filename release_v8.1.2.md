# Release Notes - v8.1.2

## 🍎 macOS Fixes
- **Entitlements added**: Hardened runtime was enabled without entitlements, which could block microphone/camera access and Electron's JIT. Added `build-resources/entitlements.mac.plist`.
- **Global hotkeys (mute/deafen)**: The app now requests the Accessibility permission on launch, and the global input listener is only started once it is granted (previously it started without it and could fail or crash).
- **Screen share**: Opens the Screen Recording privacy settings when permission is denied, and no longer requests desktop audio on macOS (unsupported by Chromium there), which made sharing fail entirely.
- **Ad-hoc signing** for macOS builds so arm64 builds are launchable.

## 🤖 Automated Builds
- New GitHub Actions workflow (`.github/workflows/release.yml`): pushing a `v*` tag builds Windows (exe), macOS (dmg/zip, x64 + arm64) and Linux (AppImage) and publishes them to the GitHub Release. Can also be run manually from the Actions tab.
