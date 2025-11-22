#!/bin/bash

# Install xnote CLI to /usr/local/bin

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI_SOURCE="$SCRIPT_DIR/app/bin/xnote"
CLI_TARGET="/usr/local/bin/xnote"

if [ ! -f "$CLI_SOURCE" ]; then
    echo "Error: xnote CLI not found at $CLI_SOURCE"
    exit 1
fi

echo "Installing xnote CLI..."

# Create symlink
if [ -L "$CLI_TARGET" ] || [ -f "$CLI_TARGET" ]; then
    echo "Removing existing xnote CLI..."
    sudo rm "$CLI_TARGET"
fi

sudo ln -s "$CLI_SOURCE" "$CLI_TARGET"

echo "✓ xnote CLI installed to $CLI_TARGET"
echo ""
echo "Usage:"
echo "  xnote start    - Start xnote in background"
echo "  xnote stop     - Stop xnote"
echo "  xnote status   - Check status"
echo "  xnote restart  - Restart xnote"
echo "  xnote logs     - View logs"
