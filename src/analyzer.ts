import { Project, SyntaxKind } from 'ts-morph';
import { getBoundaryLabel } from './utils.js';

export interface TRPCCall {
    procedurePath: string;
    method: string; // useQuery, useMutation, query, mutate etc
    file: string;
    line: number;
    boundary: string;
}

export interface AnalysisResult {
    calls: TRPCCall[];
    fileCount: number;
}

/**
 * プロジェクト内の tRPC 呼び出しを抽出する
 */
export async function analyzeProject(targetPath: string): Promise<AnalysisResult> {
    const project = new Project({
        compilerOptions: {
            allowJs: true,
        },
    });

    // 対象ファイルを読み込み
    project.addSourceFilesAtPaths([
        `${targetPath}/**/*.ts`,
        `${targetPath}/**/*.tsx`,
        `!${targetPath}/**/node_modules/**`,
    ]);

    const sourceFiles = project.getSourceFiles();
    const calls: TRPCCall[] = [];

    for (const sourceFile of sourceFiles) {
        const filePath = sourceFile.getFilePath();
        const boundary = getBoundaryLabel(sourceFile, filePath);

        // すべての CallExpression を走査
        sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
            const expression = call.getExpression();

            // trpc.xxx.useQuery() などのパターンを探す
            // 実際には trpc.user.get.useQuery() のようにネストする場合がある
            const callText = expression.getText();

            // trpc. または api. (よく使われるエイリアス) から始まる呼び出しを簡易的に抽出
            // TODO: より厳密に定義元を追う場合は TypeChecker が必要だが、まずはテキストベースで抽出
            if (callText.startsWith('trpc.') || callText.startsWith('api.')) {
                const parts = callText.split('.');
                if (parts.length >= 2) {
                    const method = parts[parts.length - 1];
                    const procedurePath = parts.slice(1, -1).join('.');

                    calls.push({
                        procedurePath,
                        method,
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

