#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "Installing Termux Chromium + Node..."
pkg install -y x11-repo
pkg install -y chromium nodejs-lts which

cd "$(dirname "$0")"
export PLAYWRIGHT_BROWSERS_PATH=0
npm install --no-fund --no-audit

echo
echo "Ready."
echo "Run: bash run.sh --quick"
