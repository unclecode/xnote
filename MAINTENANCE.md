# xnote Maintenance Guide

Complete guide for maintaining and developing xnote.

---

## Table of Contents

1. [Codebase Structure](#codebase-structure)
2. [AI Features](#ai-features)
3. [Development Workflow](#development-workflow)
4. [Release Process](#release-process)
5. [GitHub Repository Structure](#github-repository-structure)
6. [Homebrew Distribution](#homebrew-distribution)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Common Tasks](#common-tasks)
9. [Troubleshooting](#troubleshooting)

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
│   ├── bin/
│   │   ├── xnote                 # CLI bash shim (service + note commands)
│   │   ├── xnote-cli.js          # Node.js CLI for note operations
│   │   └── lib/
│   │       ├── data.js           # Shared data access module
│   │       └── ai.js             # Gemini API for title generation
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
  - **Multi-tab support** - Open multiple notes simultaneously
  - **AI Inline Assistant** (`Cmd+Y`) - Generate content at cursor
  - **AI Chat Sidebar** (`Cmd+Shift+Y`) - Conversational AI with streaming
  - **Download** - Export notes as Markdown files
  - **Share** - Share notes via GitHub Gist
- **Dependencies**:
  - `marked.js` - Markdown parsing
  - `highlight.js` - Code syntax highlighting
  - `lucide` - Icon library
  - `@google/genai` - Gemini AI SDK

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

#### `app/bin/xnote`
- **Purpose**: CLI tool for managing xnote as a background service AND note operations
- **Service Commands**:
  - `xnote start` - Start app in background (detached from terminal)
  - `xnote stop` - Stop the app gracefully
  - `xnote status` - Check if running and show PID
  - `xnote restart` - Restart the app
  - `xnote logs [-f]` - View logs (optionally follow)
- **Note Commands** (with stdin/stdout piping):
  - `xnote create [-n name] [--force]` - Create note from stdin
  - `xnote get <name> [--json|--html]` - Output note content to stdout
  - `xnote list [--json]` - List all notes
  - `xnote open <name>` - Open note in running app
- **Process Management**:
  - PID stored in `~/.xnote/xnote.pid`
  - Logs written to `~/.xnote/xnote.log`
  - Runs via `nohup` for background execution
- **Installation**:
  - Development: `./install-cli.sh` or add to PATH
  - Production: Included in Homebrew from v1.0.2+

#### `app/bin/xnote-cli.js`
- **Purpose**: Node.js CLI implementation for note operations
- **Dependencies**: `commander`, `turndown`, `@google/genai`
- **Features**:
  - Stdin/stdout piping for Unix-style workflows
  - AI-powered title generation (Gemini) when name not provided
  - Opens notes in running app via Electron's single-instance mechanism

#### `app/bin/lib/data.js`
- **Purpose**: Shared data access module (used by CLI and app)
- **Functions**: `loadData`, `saveData`, `getNotes`, `getNoteByName`, `createNote`
- **Atomic writes**: Uses temp file + rename for safe saving

#### `app/bin/lib/ai.js`
- **Purpose**: Gemini API integration for auto-generating note titles
- **Model**: `gemini-2.5-flash` for fast title generation
- **Fallback**: Uses date-based name if API key not configured

#### `install-cli.sh`
- **Purpose**: Symlink CLI to `/usr/local/bin` for development
- **Usage**: `./install-cli.sh` (requires sudo)
- **Alternative**: Add `app/bin` to PATH manually

---

## AI Features

xnote includes powerful AI capabilities powered by Google's Gemini models.

### Supported Models

| Model | Description | Use Case |
|-------|-------------|----------|
| `gemini-3-pro-preview` | Latest multimodal (default) | General use, best quality |
| `gemini-3-pro-image-preview` | Image generation | Creating images from prompts |
| `gemini-2.5-pro` | Advanced reasoning | Complex tasks |
| `gemini-2.5-flash` | Fast, balanced | Quick responses |
| `gemini-2.5-flash-lite` | Fastest, cost-efficient | Simple tasks |

### Inline AI (`Cmd+Y`)

- Opens floating prompt at cursor position
- Generates content to insert at cursor
- Uses structured XML prompt with `<FILL_HERE/>` marker
- Returns JSON response for reliable parsing
- Supports image paste for multimodal prompts

**Modes**:
- **Insert**: Adds content at cursor position
- **Replace**: Replaces selected text

### Chat Sidebar (`Cmd+Shift+Y`)

- Full conversational AI interface
- **Streaming responses** - See text as it generates
- **Conversation history** - Model remembers context
- **Multi-turn chat** - Full history sent with each request
- **Image support** - Paste images in chat
- **Session persistence** - Chat history saved

### AI Configuration

**Settings** (`Cmd+,` → AI Settings):
- API Key (from aistudio.google.com)
- Default Model
- System Prompt
- Google Search toggle

**Thinking Config** (per model):
```javascript
// Gemini 3: thinkingLevel
{ thinkingLevel: 'LOW' }  // or 'HIGH'

// Gemini 2.5: thinkingBudget
{ thinkingBudget: 2334 }  // tokens for thinking
{ thinkingBudget: -1 }    // dynamic
{ thinkingBudget: 0 }     // disabled (flash-lite)
```

### Download & Share

**Download** (`Cmd+D`):
- Exports current note as `.md` file
- Uses native save dialog

**Share via Gist** (`Cmd+Shift+G`):
- Creates GitHub Gist from current note
- Requires `gh` CLI to be authenticated
- Options: Public or Private gist

### Technical Implementation

**Files**:
- `app/main.js` - AI IPC handlers, Gemini SDK integration
- `app/preload.js` - AI API exposure to renderer
- `app/index.html` - UI components, prompt construction

**Key Functions** (main.js):
- `ai-generate-content` - Main generation endpoint
  - `isInlineMode`: JSON response for inline AI
  - `chatHistory`: Full conversation for chat mode
  - Model-specific thinking config

**Data Storage**:
- AI settings: `~/.xnote/data.json` → `aiSettings`
- Chat sessions: `~/.xnote/data.json` → `chatSessions`
- Generated images: `~/.xnote/images/`

---

## Development Workflow

### Initial Setup

```bash
cd app
npm install
```

### Running in Development

**Option 1: Direct npm start (terminal-dependent)**
```bash
cd app
npm start
```

**Option 2: CLI tool (background service, recommended)**
```bash
# Install CLI first (one time)
./install-cli.sh

# Then use anywhere
xnote start     # Starts in background, terminal can close
xnote status    # Check if running
xnote logs -f   # Follow logs
xnote stop      # Stop when done
```

This launches Electron with the app:
- Running in background (no dock icon)
- Shows tray icon in menu bar
- Responds to `Cmd+Ctrl+Shift+N` global shortcut
- Saves data to `~/.xnote/data.json`
- Logs to `~/.xnote/xnote.log` (CLI mode only)

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

### Run App as Background Service (CLI)

After installing the CLI (`./install-cli.sh`):

```bash
# Start in background (terminal can close)
xnote start

# Check status
xnote status

# View logs
xnote logs       # Last 50 lines
xnote logs -f    # Follow live

# Stop the app
xnote stop

# Restart
xnote restart
```

**Benefits**:
- Terminal-independent - close terminal, app keeps running
- Easy log access via `xnote logs`
- Process management via PID file
- Great for daily use during development

### CLI Pipeline Workflows

The CLI supports Unix-style stdin/stdout piping for powerful workflows:

**Create notes from any source:**
```bash
# From file
cat document.md | xnote create -n "My Document"

# From clipboard
pbpaste | xnote create -n "From Clipboard"

# With AI-generated title (uses Gemini)
cat meeting-notes.txt | xnote create

# Overwrite existing note
echo "Updated content" | xnote create -n "Existing Note" --force
```

**Export notes anywhere:**
```bash
# To file
xnote get "My Note" > backup.md

# To clipboard
xnote get "My Note" | pbcopy

# As JSON
xnote get "My Note" --json > note.json

# List all notes
xnote list
xnote list --json
```

**Open notes in app:**
```bash
# Opens note in running app (or starts app)
xnote open "My Note"
```

**Combine with other tools:**
```bash
# Search notes
xnote list --json | jq '.[] | select(.name | contains("meeting"))'

# Backup all notes
for note in $(xnote list --json | jq -r '.[].name'); do
  xnote get "$note" > "backup/$note.md"
done

# Create note from web content
curl -s https://example.com | xnote create -n "Web Page"
```

### Install CLI for Development

**Option 1: System-wide (requires sudo)**
```bash
./install-cli.sh
```
Creates symlink in `/usr/local/bin/xnote`

**Option 2: Add to PATH (no sudo)**
```bash
echo 'export PATH="/Users/unclecode/devs/xnote/app/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

---

## Troubleshooting

### Problem: Global shortcut not working

**Cause**: macOS requires Accessibility permissions

**Solution**:
1. System Preferences → Security & Privacy → Privacy → Accessibility
2. Add Terminal (or your terminal app)
3. Restart the app

### Problem: Window switches desktops instead of appearing on current one

**Fix applied in `toggleWindow()` function**: The window temporarily enables `setVisibleOnAllWorkspaces(true)` when showing, then disables it after 100ms. This allows the window to:
- Appear on whichever desktop you're currently on
- Stay on that desktop when you switch to other desktops (doesn't follow you around)

See `app/main.js` around line 134.

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

### Problem: CLI command not found

**If `xnote` command not found after install**:

```bash
# Check if symlink exists
ls -la /usr/local/bin/xnote

# Or check PATH
echo $PATH | grep xnote

# Re-run install
./install-cli.sh
```

### Problem: CLI says "not running" but app is visible

**Cause**: App started via `npm start` instead of CLI

**Solution**:
```bash
# Stop npm-started instance
pkill -f "electron.*xnote"

# Use CLI instead
xnote start
```

### Problem: Can't see CLI logs

**Check log file**:
```bash
xnote logs        # Last 50 lines
xnote logs -f     # Follow live

# Or directly
tail -f ~/.xnote/xnote.log
```

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

**When running via CLI**:
```bash
xnote logs       # Last 50 lines
xnote logs -f    # Follow live
# Or: tail -f ~/.xnote/xnote.log
```

**When running via npm start**:
- Logs appear in terminal
- macOS system logs: `~/Library/Logs/xnote/`
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

**Daily Development** (Option 1: npm):
```bash
cd app
npm start
# Make changes, test, commit
```

**Daily Development** (Option 2: CLI - Recommended):
```bash
xnote start      # Runs in background
# Make changes, test, commit
xnote restart    # Apply changes
xnote logs -f    # Check logs
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
| Start dev (npm) | `cd app && npm start` |
| Start dev (CLI) | `xnote start` |
| Stop app (CLI) | `xnote stop` |
| Check status (CLI) | `xnote status` |
| View logs (CLI) | `xnote logs [-f]` |
| Install CLI | `./install-cli.sh` |
| Build test | `cd app && npm run build:dir` |
| Release | `./release.sh X.Y.Z` |
| Check releases | `gh release list --repo unclecode/xnote` |
| View workflows | https://github.com/unclecode/xnote/actions |
| Edit cask | `homebrew-xnote/Casks/xnote.rb` |
| Data location | `~/.xnote/data.json` |
| Logs (CLI) | `~/.xnote/xnote.log` |
| PID file (CLI) | `~/.xnote/xnote.pid` |
| **Note CLI Commands** | |
| Create note (stdin) | `echo "text" \| xnote create -n "Name"` |
| Get note (stdout) | `xnote get "Name" > file.md` |
| List notes | `xnote list [--json]` |
| Open note in app | `xnote open "Name"` |
| **AI Shortcuts** | |
| Inline AI | `Cmd+Y` |
| Chat Sidebar | `Cmd+Shift+Y` |
| Download Note | `Cmd+D` |
| Share via Gist | `Cmd+Shift+G` |
| AI Settings | `Cmd+,` |

---

**Last Updated**: 2025-12-02
**Current Version**: 1.0.2+ (with AI features, multi-tab, streaming, CLI pipeline)
**Maintainer**: unclecode
