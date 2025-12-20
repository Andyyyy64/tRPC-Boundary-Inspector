import { withTRPCBoundaryInspector } from "trpc-boundary-inspector/next";

/** @type {import('next').NextConfig} */
const nextConfig = {};

// SWC plugin を使用して Turbopack でテストする
// wasmファイルは example ディレクトリにコピー済み
export default withTRPCBoundaryInspector(nextConfig, {
  useSWCPlugin: true,
  // Turbopack は相対パスを要求する
  swcPluginPath: "./trpc_boundary_inspector_swc_plugin.wasm",
});

