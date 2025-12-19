import path from 'path';

/**
 * ファイルが Client Component かどうかを判定する
 * ("use client" 指示文があるか)
 */
export function isClientComponent(sourceFile: any): boolean {
  const text = sourceFile.getFullText();
  // シンプルにファイル先頭付近に "use client" があるかチェック
  return text.trim().startsWith('"use client"') || text.trim().startsWith("'use client'");
}

/**
 * app ディレクトリ配下かどうかを判定する
 */
export function isAppDir(filePath: string): boolean {
  return filePath.includes(`${path.sep}app${path.sep}`);
}

/**
 * Edge Runtime 設定があるかチェックする
 * export const runtime = 'edge'
 */
export function isEdgeRuntime(sourceFile: any): boolean {
  const text = sourceFile.getFullText();
  return /export\s+const\s+runtime\s*=\s*['"]edge['"]/.test(text);
}

/**
 * 境界ラベルの取得
 */
export function getBoundaryLabel(sourceFile: any, filePath: string): string {
  if (isEdgeRuntime(sourceFile)) return 'Edge';
  if (isClientComponent(sourceFile)) return 'Client';
  if (isAppDir(filePath)) return 'Server (RSC)';
  return 'Unknown';
}
