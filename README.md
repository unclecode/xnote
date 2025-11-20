# xnote

Minimalist note-taking app for macOS. Runs in the background with a global shortcut for instant access.

## Features

- **Rich text & Markdown** editing modes
- **Dark & Light themes** (sepia-style light)
- **Global shortcut** - `Cmd+Ctrl+Shift+N` to toggle window
- **Menu bar app** - No dock icon, always available
- **Local storage** - Data saved in `~/.xnote`
- **Frameless window** - Clean, minimal interface

## Install

```bash
brew tap unclecode/xnote
brew install --cask xnote
```

## Update

```bash
brew upgrade xnote
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Toggle window | `Cmd+Ctrl+Shift+N` |
| New note | `Cmd+N` |
| Open notes | `Cmd+O` |
| Save note | `Cmd+S` |
| Rich mode | `Cmd+1` |
| Markdown mode | `Cmd+2` |
| Toggle theme | `Cmd+T` |
| Hide window | `Cmd+W` |
| Show shortcuts | `Cmd+/` |

## Usage

1. Press `Cmd+Ctrl+Shift+N` to show the app
2. Type your notes
3. Press `Cmd+W` to hide (app stays running)
4. Click the menu bar icon or use the shortcut to bring it back

## Uninstall

```bash
brew uninstall xnote
brew untap unclecode/xnote
rm -rf ~/.xnote  # Remove saved data
```

## Development

```bash
cd app
npm install
npm start
```

## Build

```bash
cd app
npm run build
```

## License

MIT
