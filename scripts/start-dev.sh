#!/usr/bin/env bash
# SMARTACADEMIC — Dev starter (Linux/macOS)
set -e
cd "$(dirname "$0")/.."
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi
echo "Starting SMARTACADEMIC in dev mode..."
npm run dev