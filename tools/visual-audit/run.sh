#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")"

export PLAYWRIGHT_BROWSERS_PATH=0

if [ -z "$CHROMIUM_PATH" ]; then
  if command -v chromium-browser >/dev/null 2>&1; then
    export CHROMIUM_PATH="$(command -v chromium-browser)"
  elif command -v chromium >/dev/null 2>&1; then
    export CHROMIUM_PATH="$(command -v chromium)"
  else
    echo "Chromium not found. Run: bash setup-termux.sh"
    exit 1
  fi
fi

if [ ! -d node_modules ]; then
  echo "Dependencies missing. Run: bash setup-termux.sh"
  exit 1
fi

node visual-audit.mjs https://coping.tools "$@"
