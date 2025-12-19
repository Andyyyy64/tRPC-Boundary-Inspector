import path from 'path';
import { fileURLToPath } from 'url';

// 外部からローダーを参照できるように export
export { default as loader } from './loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Next.js config wrapper to enable tRPC boundary inspection.
 * Webpack と Turbopack 両方でカスタムローダーを適用し、
 * tRPC 呼び出し箇所にファイル名・行番号を自動注入する。
 */
export function withTRPCBoundaryInspector(nextConfig: any = {}) {
  const loaderPath = path.resolve(__dirname, './loader.js');

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
    webpack(config: any, options: any) {
      // Webpack 環境でのローダー設定（unshift で最優先）
      config.module.rules.unshift({
        test: /\.(tsx|ts)$/,
        exclude: /node_modules/,
        use: [{ loader: loaderPath }],
      });

      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, options);
      }
      return config;
    },
  };
}
