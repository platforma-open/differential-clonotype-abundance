#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SOFTWARE_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# --- R smoke tests for the DESeq2 scripts ---
if command -v Rscript >/dev/null 2>&1; then
  Rscript "$SCRIPT_DIR/zero_sample_test.R"
else
  echo "SKIP: Rscript not installed; R smoke tests skipped."
fi

# --- Python tests for prevChecks.py ---
if command -v uv >/dev/null 2>&1; then
  cd "$SOFTWARE_DIR"
  uv run --quiet pytest tests/ -v
else
  echo "SKIP: uv not installed; Python tests skipped."
fi
