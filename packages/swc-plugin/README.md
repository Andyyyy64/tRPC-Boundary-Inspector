# tRPC Boundary Inspector - SWC Plugin

Turbopack 対応のための SWC プラグイン実装。

## ビルド方法

### 前提条件

1. Rust がインストールされていること
2. `wasm32-wasip1` ターゲットが追加されていること

```bash
# Rust のインストール（まだの場合）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# wasm ターゲットの追加
rustup target add wasm32-wasip1
```

### ビルド

```bash
cd packages/swc-plugin
cargo build --release
```

ビルド成果物は `target/wasm32-wasip1/release/trpc_boundary_inspector_swc_plugin.wasm` に出力されます。

## Next.js での使用方法

```javascript
// next.config.js
module.exports = {
  experimental: {
    swcPlugins: [
      [
        "./packages/swc-plugin/target/wasm32-wasip1/release/trpc_boundary_inspector_swc_plugin.wasm",
        { debug: false }
      ]
    ]
  }
};
```

## 注意事項

- `experimental.swcPlugins` は Next.js の experimental 機能です
- Turbopack との組み合わせで問題が発生する可能性があります
- SWC のバージョンと互換性の問題が発生する場合は、`swc_core` のバージョンを調整してください
