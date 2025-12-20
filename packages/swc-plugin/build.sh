#!/bin/bash
# SWC plugin を Wasm にビルドするスクリプト

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building SWC plugin for wasm32-wasip1..."

# リリースビルド
cargo build --release

# ビルド成果物のパスを表示
WASM_PATH="$SCRIPT_DIR/target/wasm32-wasip1/release/trpc_boundary_inspector_swc_plugin.wasm"

if [ -f "$WASM_PATH" ]; then
    echo ""
    echo "Build successful!"
    echo "Wasm file: $WASM_PATH"
    echo "Size: $(du -h "$WASM_PATH" | cut -f1)"
else
    echo "Error: Wasm file not found at $WASM_PATH"
    exit 1
fi
