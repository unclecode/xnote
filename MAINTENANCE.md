# xnote Maintenance Guide

Complete guide for maintaining and developing xnote.

---

## Table of Contents

1. [Codebase Structure](#codebase-structure)
2. [Development Workflow](#development-workflow)
3. [Release Process](#release-process)
4. [GitHub Repository Structure](#github-repository-structure)
5. [Homebrew Distribution](#homebrew-distribution)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)

---

## Codebase Structure

```
xnote/
├── app/                          # Electron application
│   ├── main.js                   # Main process (Node.js)
│   ├── preload.js                # Preload script (IPC bridge)
│   ├── index.html                # Renderer UI
│   ├── package.json              # App dependencies & build config
│   ├── package-lock.json         # Locked dependencies
│   └── assets/
│       └── trayIconTemplate.png  # macOS menu bar icon
├── .github/
│   └── workflows/
│       └── release.yml           # GitHub Actions CI/CD
├── index.html                    # Web version (not used in app)
├── release.sh                    # Release automation script
├── README.md                     # User-facing documentation
└── MAINTENANCE.md                # This file
```

### Key Files Explained

#### `app/main.js`
- **Purpose**: Electron main process, runs in Node.js
- **Responsibilities**:
  - Creates the frameless window
  - Manages tray icon and menu
  - Registers global shortcut (`Cmd+Ctrl+Shift+N`)
  - Handles data persistence to `~/.xnote/data.json`
  - Manages window visibility across workspaces
- **Key APIs**:
  - `BrowserWindow` - Window management
  - `Tray` - Menu bar icon
  - `globalShortcut` - System-wide hotkeys
  - `fs` - File system for data storage

#### `app/preload.js`
- **Purpose**: Bridge between main and renderer processes
- **Security**: Uses `contextBridge` for safe IPC
- **Exposed APIs**:
  - `window.electronAPI.getData(key)` - Read from storage
  - `window.electronAPI.setData(key, value)` - Write to storage
  - `window.electronAPI.hideWindow()` - Hide app window
  - `window.electronAPI.quitApp()` - Quit application

#### `app/index.html`
- **Purpose**: The UI (renderer process)
- **Features**:
  - Rich text editor (contentEditable)
  - Markdown editor with live preview
  - Dark/light theme (sepia style)
  - Modal dialogs (save, open, shortcuts)
  - Storage abstraction (works in Electron & browser)
- **Dependencies**:
  - `marked.js` - Markdown parsing
  - `highlight.js` - Code syntax highlighting

#### `app/package.json`
- **Purpose**: App metadata and build configuration
- **Key sections**:
  - `version` - App version (update for releases)
  - `scripts` - Build commands
  - `build` - electron-builder configuration
  - `dependencies` - Runtime deps (electron-store)
  - `devDependencies` - Build tools (electron, electron-builder)

#### `.github/workflows/release.yml`
- **Purpose**: Automated build and release
- **Trigger**: Git tag push (e.g., `v1.0.2`)
- **Steps**:
  1. Build universal macOS binary
  2. Create GitHub Release
  3. Upload zip file
  4. Update Homebrew tap (requires token)

---

## Development Workflow

### Initial Setup

```bash
cd app
npm install
```

### Running in Development

```bash
cd app
npm start
```

This launches Electron with hot reload disabled. The app:
- Runs in background (no dock icon)
- Shows tray icon in menu bar
- Responds to `Cmd+Ctrl+Shift+N` global shortcut
- Saves data to `~/.xnote/data.json`

### Making Changes

1. **Edit the code** in `app/main.js`, `app/preload.js`, or `app/index.html`
2. **Restart the app** (`Ctrl+C` then `npm start`)
3. **Test the changes** using the global shortcut and UI
4. **Commit changes** to git

### Key Development Commands

```bash
# Start development
npm start

# Build for production (test locally)
npm run build:dir     # Creates .app without packaging

# Full build with packaging
npm run build         # Creates .zip for distribution
```

---

## Release Process

### Option 1: Automated Release Script (Recommended)

```bash
./release.sh 1.0.2
```

This script:
1. Updates `app/package.json` version
2. Commits and pushes changes
3. Creates git tag `v1.0.2`
4. Waits for GitHub Actions to build
5. Downloads release zip
6. Calculates SHA256
7. Updates Homebrew tap automatically

**That's it!** Everything is automated.

### Option 2: Manual Release

If you need to do it manually:

```bash
# 1. Update version
cd app
npm version 1.0.2 --no-git-tag-version
cd ..

# 2. Commit
git add app/package.json
git commit -m "Bump version to 1.0.2"
git push

# 3. Tag and push
git tag v1.0.2
git push --tags

# 4. Wait for GitHub Actions to build (check Actions tab)

# 5. Download release and get SHA256
gh release download v1.0.2 --repo unclecode/xnote --pattern "*.zip" --dir /tmp --clobber
shasum -a 256 /tmp/xnote-1.0.2-mac-universal.zip

# 6. Update Homebrew tap manually
cd /tmp
git clone git@github.com:unclecode/homebrew-xnote.git
cd homebrew-xnote
# Edit Casks/xnote.rb with new version and SHA256
git add Casks/xnote.rb
git commit -m "Update xnote to v1.0.2"
git push
```

---

## GitHub Repository Structure

### Main Repository: `unclecode/xnote`

**Purpose**: Source code and releases

**Branches**:
- `main` - Production branch
- `electron-desktop` - (merged) Initial Electron work

**Important Settings**:
- **Actions Secrets**:
  - `HOMEBREW_TAP_TOKEN` - Personal access token for updating tap
    - Must have `repo` scope
    - Used by GitHub Actions workflow

**GitHub Actions**:
- Workflow file: `.github/workflows/release.yml`
- Triggered by: Tag push matching `v*`
- Permissions: `contents: write` (for creating releases)
- Currently fails on Homebrew tap update (token scope issue)
  - Release itself succeeds
  - Use `release.sh` script to update tap automatically

### Homebrew Tap: `unclecode/homebrew-xnote`

**Purpose**: Homebrew cask formula for installation

**Structure**:
```
homebrew-xnote/
└── Casks/
    └── xnote.rb    # Cask formula
```

**Formula Contents**:
- `version` - App version
- `sha256` - SHA256 hash of release zip
- `url` - Download URL from GitHub Releases
- `postflight` - Removes quarantine attribute (`xattr -cr`)

**Update Process**:
- Automated by `release.sh` script
- OR manually edit `Casks/xnote.rb` after each release

---

## Homebrew Distribution

### How Users Install

```bash
brew tap unclecode/xnote
brew install --cask xnote
```

### How Updates Work

```bash
brew upgrade xnote
```

Homebrew:
1. Checks for new version in `Casks/xnote.rb`
2. Downloads zip from GitHub Releases
3. Verifies SHA256 checksum
4. Extracts `xnote.app`
5. Runs `postflight` to remove quarantine
6. Installs to `/Applications`

### Quarantine Removal

macOS marks downloaded apps as "quarantined". The cask includes:

```ruby
postflight do
  system_command "/usr/bin/xattr",
                 args: ["-cr", "#{appdir}/xnote.app"],
                 sudo: false
end
```

This removes the quarantine attribute so users don't get Gatekeeper warnings.

---

## CI/CD Pipeline

### GitHub Actions Workflow

**File**: `.github/workflows/release.yml`

**Trigger**:
```yaml
on:
  push:
    tags:
      - 'v*'
```

**Jobs**:

#### 1. Setup Environment
- Runs on: `macos-latest`
- Node.js: v20
- Caches npm dependencies

#### 2. Install Dependencies
```bash
npm ci  # Clean install from package-lock.json
```

#### 3. Build App
```bash
npm run build  # electron-builder --mac --universal
```
- Creates universal binary (arm64 + x64)
- Output: `app/dist/xnote-VERSION-mac-universal.zip`

#### 4. Create GitHub Release
- Uses: `softprops/action-gh-release@v1`
- Uploads: `xnote-VERSION-mac-universal.zip`
- Auto-generates release notes

#### 5. Update Homebrew Tap (Currently Fails)
- Clones `homebrew-xnote` repo
- Calculates SHA256 of release zip
- Updates `Casks/xnote.rb`
- Pushes changes

**Known Issue**: Token permissions
- `HOMEBREW_TAP_TOKEN` needs `repo` scope to push
- Currently fails with 403 error
- **Workaround**: Use `release.sh` script

### Build Configuration

**File**: `app/package.json` → `build` section

```json
{
  "build": {
    "appId": "com.unclecode.xnote",
    "artifactName": "${productName}-${version}-mac-universal.${ext}",
    "mac": {
      "target": [{"target": "zip", "arch": "universal"}],
      "extendInfo": {
        "LSUIElement": true  // No dock icon
      }
    },
    "publish": null  // Don't auto-publish (handled by workflow)
  }
}
```

---

## Common Tasks

### Add a New Feature

1. **Code the feature** in `app/index.html` or `app/main.js`
2. **Test locally**: `cd app && npm start`
3. **Commit**: `git add . && git commit -m "Add feature X"`
4. **Push**: `git push`
5. **Release**: `./release.sh 1.0.X`

### Fix a Bug

1. **Reproduce the bug** in development mode
2. **Fix the code**
3. **Test the fix**
4. **Commit**: `git add . && git commit -m "Fix: bug description"`
5. **Push**: `git push`
6. **Release** (if critical): `./release.sh 1.0.X`

### Change Keyboard Shortcuts

Edit `app/index.html` around line 1334:

```javascript
window.addEventListener("keydown", (event) => {
  const ctrlOrMeta = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  
  // Add your shortcut here
  if (ctrlOrMeta && key === "x") {
    // Your action
    event.preventDefault();
    return;
  }
});
```

### Change Global Shortcut

Edit `app/main.js` around line 124:

```javascript
const registered = globalShortcut.register('CommandOrControl+Shift+Control+N', () => {
  toggleWindow();
});
```

Change the key combination as needed.

### Modify Tray Icon

Replace `app/assets/trayIconTemplate.png` with:
- 16x16 or 22x22 PNG
- Black with transparent background
- Template format (macOS will invert for menu bar)

### Change Data Storage Location

Edit `app/main.js` around line 9:

```javascript
const dataDir = path.join(os.homedir(), '.xnote');
```

Change to your desired path.

---

## Troubleshooting

### Problem: Global shortcut not working

**Cause**: macOS requires Accessibility permissions

**Solution**:
1. System Preferences → Security & Privacy → Privacy → Accessibility
2. Add Terminal (or your terminal app)
3. Restart the app

### Problem: Window switches desktops instead of appearing on current one

**Fix already applied**: `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`

If still happening, check `app/main.js` line 65.

### Problem: GitHub Actions workflow fails

**Check**:
1. Go to: https://github.com/unclecode/xnote/actions
2. Click on failed run
3. Check logs

**Common issues**:
- Token permissions (Homebrew tap update)
- Build errors (check npm logs)
- Missing dependencies

**Workaround**: Use `release.sh` script instead.

### Problem: Homebrew tap update fails (403 error)

**Cause**: `HOMEBREW_TAP_TOKEN` doesn't have `repo` scope

**Solution**:
1. Generate new token at: https://github.com/settings/tokens
2. Select `repo` scope (full control)
3. Update secret at: https://github.com/unclecode/xnote/settings/secrets/actions
4. Name: `HOMEBREW_TAP_TOKEN`

**Alternative**: Just use `release.sh` script - it handles this automatically.

### Problem: App not starting

**Debug**:
```bash
cd app
npm start 2>&1 | tee debug.log
```

Check `debug.log` for errors.

### Problem: Data not persisting

**Check**:
```bash
ls -la ~/.xnote/
cat ~/.xnote/data.json
```

If directory doesn't exist, app will create it on first save.

---

## Development Tips

### Testing Releases Locally

Before releasing publicly:

```bash
cd app
npm run build:dir
open dist/mac-universal/xnote.app
```

This opens the built app without creating a zip.

### Checking Logs

Electron logs go to:
- macOS: `~/Library/Logs/xnote/`
- Or check Console.app and filter by "xnote"

### Debugging Renderer Process

Add to `app/index.html`:

```javascript
if (isElectron) {
  console.log('Running in Electron');
}
```

Open Developer Tools: `Cmd+Option+I` (add a menu item in `app/main.js` if needed)

### Quick Iteration

Keep app running and modify `app/index.html`. Then:
- Hide window (`Cmd+W`)
- Show window (`Cmd+Ctrl+Shift+N`)

Most UI changes will be visible without restart.

---

## Summary

**Daily Development**:
```bash
cd app
npm start
# Make changes, test, commit
```

**Release New Version**:
```bash
./release.sh 1.0.X
```

**That's it!** The script handles everything automatically.

---

## Quick Reference

| Task | Command |
|------|---------|
| Start dev | `cd app && npm start` |
| Build test | `cd app && npm run build:dir` |
| Release | `./release.sh X.Y.Z` |
| Check releases | `gh release list --repo unclecode/xnote` |
| View workflows | https://github.com/unclecode/xnote/actions |
| Edit cask | `homebrew-xnote/Casks/xnote.rb` |
| Data location | `~/.xnote/data.json` |

---

**Last Updated**: 2025-11-21  
**Current Version**: 1.0.1  
**Maintainer**: unclecode
