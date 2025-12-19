import { transformSync } from '@babel/core';
import { createRequire } from 'module';
// @ts-ignore
import trpcBoundaryInspectorBabelPlugin from '../../babel/src/index.js';

// このパッケージ内の依存関係を解決
const require = createRequire(import.meta.url);
const babelPluginSyntaxTypescript = require.resolve('@babel/plugin-syntax-typescript');

// デバッグ用ログ
const DEBUG = true;
const log = (msg: string) => DEBUG && console.log(`[trpc-boundary-loader] ${msg}`);

/**
 * Webpack/Turbopack 共通ローダー: tRPC 呼び出し箇所に境界メタデータを注入する。
 * TypeScript 構文を維持したまま AST 変換のみを行う。
 */
export default function trpcBoundaryLoader(this: any, source: string) {
  const callback = this.async();
  const filename = this.resourcePath;

  // node_modules はスキップ
  if (filename.includes('node_modules')) {
    return callback(null, source);
  }

  // tRPC 呼び出しパターンを含むファイルのみ変換
  // 終端メソッド名（.useQuery(, .useMutation(, .query(, .mutation( など）で検出
  const hasTrpcCall =
    /\.(useQuery|useMutation|useSuspenseQuery|useInfiniteQuery|query|mutation|prefetch|fetchQuery)\s*\(/.test(
      source,
    );

  if (!hasTrpcCall) {
    return callback(null, source);
  }

  log(`Processing: ${filename}`);

  try {
    const isTsx = filename.endsWith('.tsx');

    const result = transformSync(source, {
      filename,
      plugins: [
        // TypeScript 構文を理解するが、変換はしない（TypeScript のまま出力）
        [babelPluginSyntaxTypescript, { isTSX: isTsx }],
        trpcBoundaryInspectorBabelPlugin,
      ],
      babelrc: false,
      configFile: false,
      sourceMaps: true,
    });

    if (result?.code && result.code !== source) {
      log(`Transformed: ${filename}`);
      log(`Code changed: ${result.code.includes('__boundary')}`);
      callback(null, result.code, result.map || undefined);
    } else {
      log(`No changes: ${filename}`);
      callback(null, source);
    }
  } catch (err) {
    // エラー時は元のソースをそのまま返す（ビルドを止めない）
    log(`Error in ${filename}: ${err instanceof Error ? err.message : String(err)}`);
    callback(null, source);
  }
}
