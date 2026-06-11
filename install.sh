#!/usr/bin/env bash
#
# Symlink the plugin's built files into an Obsidian vault so you can develop it
# in place — edits to main.js (e.g. from `npm run dev`) show up after a reload.
# Resolves the repo from this script's own location, so it works wherever you
# cloned it.
#
# Usage:
#   ./install.sh <vault-path>
#   OBSIDIAN_VAULT=<vault-path> ./install.sh
#
set -euo pipefail

PLUGIN_ID="obsidian-taskboard"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT="${1:-${OBSIDIAN_VAULT:-}}"

if [ -z "$VAULT" ]; then
  echo "Usage: $0 <vault-path>   (or set OBSIDIAN_VAULT)" >&2
  exit 1
fi

# Expand a leading ~ and resolve to an absolute path.
VAULT="${VAULT/#\~/$HOME}"
VAULT="$(cd "$VAULT" 2>/dev/null && pwd || true)"

if [ -z "$VAULT" ] || [ ! -d "$VAULT/.obsidian" ]; then
  echo "Error: '${1:-$OBSIDIAN_VAULT}' is not an Obsidian vault (no .obsidian/ folder)." >&2
  exit 1
fi

DEST="$VAULT/.obsidian/plugins/$PLUGIN_ID"
mkdir -p "$DEST"

for f in manifest.json main.js styles.css; do
  if [ ! -e "$REPO/$f" ]; then
    echo "Warning: $REPO/$f not found — run 'npm run build' (or 'npm run dev') first." >&2
  fi
  ln -sf "$REPO/$f" "$DEST/$f"
  echo "linked $f"
done

echo
echo "Installed to: $DEST"
echo "Now enable \"Taskboard\" in Obsidian → Settings → Community plugins."
