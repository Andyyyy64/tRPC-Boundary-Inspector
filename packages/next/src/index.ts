import path from 'path';
import { fileURLToPath } from 'url';

// 外部からローダーを参照できるように export
export { default as loader } from './loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SWC plugin のデフォルトパス（ビルド済み Wasm）
const DEFAULT_SWC_PLUGIN_PATH = path.resolve(
  __dirname,
  '../../swc-plugin/target/wasm32-wasip1/release/trpc_boundary_inspector_swc_plugin.wasm',
);

interface BoundaryInspectorOptions {
  // Turbopack で SWC plugin を使用するかどうか（experimental）
  useSWCPlugin?: boolean;
  // カスタム SWC plugin パス
  swcPluginPath?: string;
  // SWC plugin のオプション
  swcPluginOptions?: Record<string, unknown>;
}

/**
 * Next.js config wrapper to enable tRPC boundary inspection.
 * Webpack と Turbopack 両方でカスタムローダーを適用し、
 * tRPC 呼び出し箇所にファイル名・行番号を自動注入する。
 */
export function withTRPCBoundaryInspector(
  nextConfig: any = {},
  options: BoundaryInspectorOptions = {},
) {
  const loaderPath = path.resolve(__dirname, './loader.js');
  const { useSWCPlugin = false, swcPluginPath, swcPluginOptions = {} } = options;

  // SWC plugin を使用する場合の設定（Turbopack 対応）
  if (useSWCPlugin) {
    const pluginPath = swcPluginPath || DEFAULT_SWC_PLUGIN_PATH;

    return {
      ...nextConfig,
      experimental: {
        ...nextConfig.experimental,
        // SWC plugin を登録（experimental 機能）
        swcPlugins: [
          ...(nextConfig.experimental?.swcPlugins || []),
          [pluginPath, swcPluginOptions],
        ],
      },
      webpack(config: any, webpackOptions: any) {
        if (typeof nextConfig.webpack === 'function') {
          return nextConfig.webpack(config, webpackOptions);
        }
        return config;
      },
    };
  }

  // 従来の Webpack loader を使用する場合
  return {
    ...nextConfig,
    // Next.js 15+ の Turbopack 設定（トップレベル）
    turbopack: {
      ...nextConfig.turbopack,
      rules: {
        ...nextConfig.turbopack?.rules,
        // .ts, .tsx ファイルに対してカスタムローダーを適用
        // as を指定せず、TypeScript のまま次のローダー（SWC）へ渡す
        '*.{ts,tsx}': {
          loaders: [{ loader: loaderPath, options: {} }],
        },
      },
    },
    webpack(config: any, webpackOptions: any) {
      // Webpack 環境でのローダー設定（unshift で最優先）
      config.module.rules.unshift({
        test: /\.(tsx|ts)$/,
        exclude: /node_modules/,
        use: [{ loader: loaderPath }],
      });

      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, webpackOptions);
      }
      return config;
    },
  };
}
