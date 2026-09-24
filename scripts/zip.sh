#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUT="$PROJECT_DIR/extension.zip"

rm -f "$OUT"

cd "$PROJECT_DIR"
zip -r "$OUT" \
  manifest.json \
  src/ \
  popup/ \
  options/ \
  icons/ \
  -x "*.DS_Store"

echo "Created $OUT ($(du -h "$OUT" | cut -f1))"
