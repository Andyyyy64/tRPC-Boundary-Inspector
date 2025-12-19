import { Project, SyntaxKind } from 'ts-morph';
import { getBoundaryLabel } from './utils.js';

export interface TRPCCall {
  procedurePath: string;
  method: string; // useQuery, useMutation, query, mutate etc
  type: 'query' | 'mutation' | 'subscription' | 'utils' | 'unknown';
  file: string;
  line: number;
  boundary: string;
}

export interface AnalysisResult {
  calls: TRPCCall[];
  fileCount: number;
}

export interface AnalysisOptions {
  targetPath: string;
  ignore?: string[];
}

/**
 * メソッド名から通信タイプを判定
 */
function getCallType(method: string): TRPCCall['type'] {
  const m = method.toLowerCase();
  if (m.includes('query')) return 'query';
  if (m.includes('mutation') || m === 'mutate') return 'mutation';
  if (m.includes('subscription')) return 'subscription';
  if (m.includes('utils') || m.startsWith('usecontext')) return 'utils';
  return 'unknown';
}

/**
 * プロジェクト内の tRPC 呼び出しを抽出する
 */
export async function analyzeProject(options: AnalysisOptions): Promise<AnalysisResult> {
  const { targetPath, ignore = [] } = options;
  const project = new Project({
    compilerOptions: {
      allowJs: true,
    },
  });

  const ignorePatterns = ignore
    .map((p) => `!${targetPath}/**/${p}/**`)
    .concat(ignore.map((p) => `!${targetPath}/**/${p}`));

  // 対象ファイルを読み込み
  project.addSourceFilesAtPaths([
    `${targetPath}/**/*.ts`,
    `${targetPath}/**/*.tsx`,
    `!${targetPath}/**/node_modules/**`,
    ...ignorePatterns,
  ]);

  const sourceFiles = project.getSourceFiles();
  const calls: TRPCCall[] = [];

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();
    const boundary = getBoundaryLabel(sourceFile, filePath);

    // すべての CallExpression を走査
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
      const expression = call.getExpression();
      const callText = expression.getText();

      // trpc. または api. から始まる呼び出しを抽出
      if (callText.startsWith('trpc.') || callText.startsWith('api.')) {
        // 空要素を除去して trpc..useUtils などを防ぐ
        const parts = callText.split('.').filter(Boolean);

        if (parts.length >= 2) {
          const method = parts[parts.length - 1];
          const procedurePath = parts.slice(1, -1).join('.');
          const finalPath = procedurePath || '(root)';

          calls.push({
            procedurePath: finalPath,
            method,
            type: getCallType(method),
            file: filePath.replace(process.cwd(), '.'),
            line: call.getStartLineNumber(),
            boundary,
          });
        }
      }
    });
  }

  return {
    calls,
    fileCount: sourceFiles.length,
  };
}
