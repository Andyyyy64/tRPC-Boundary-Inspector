import { AnalysisResult } from './analyzer.js';
import chalk from 'chalk';

/**
 * Markdown レポートの生成
 */
export function generateMarkdownReport(result: AnalysisResult): string {
    const { calls, fileCount } = result;

    let report = `# tRPC Boundary Report\n\n`;
    report += `Analyzed **${fileCount}** files. Found **${calls.length}** network boundary crossings.\n\n`;

    // 境界ごとのサマリー
    const summary = calls.reduce((acc, call) => {
        acc[call.boundary] = (acc[call.boundary] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    report += `## Summary by Boundary\n\n`;
    report += `| Boundary | Count |\n`;
    report += `| --- | --- |\n`;
    for (const [boundary, count] of Object.entries(summary)) {
        report += `| ${boundary} | ${count} |\n`;
    }
    report += `\n`;

    // ファイル別のランキング
    const fileRanking = calls.reduce((acc, call) => {
        acc[call.file] = (acc[call.file] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const sortedFiles = Object.entries(fileRanking).sort((a, b) => b[1] - a[1]);

    report += `## Top Files by tRPC Calls\n\n`;
    report += `| File | Call Count |\n`;
    report += `| --- | --- |\n`;
    sortedFiles.slice(0, 20).forEach(([file, count]) => {
        report += `| ${file} | ${count} |\n`;
    });
    report += `\n`;

    // 詳細一覧
    report += `## Detailed Call List\n\n`;
    report += `| Procedure | Method | Boundary | File:Line |\n`;
    report += `| --- | --- | --- | --- |\n`;
    calls.forEach((call) => {
        report += `| \`${call.procedurePath}\` | \`${call.method}\` | ${call.boundary} | \`${call.file}:${call.line}\` |\n`;
    });

    return report;
}

/**
 * 境界ごとの色定義
 */
const BOUNDARY_COLORS: Record<string, (s: string | number) => string> = {
  'Client': chalk.cyan,
  'Server (RSC)': chalk.green,
  'Edge': chalk.magenta,
};

/**
 * コンソールへのサマリー出力
 */
export function printConsoleSummary(result: AnalysisResult, options: { showAll?: boolean } = {}): void {
  const { calls } = result;
  
  console.log('\n' + chalk.bold('tRPC Boundary Summary'));
  console.log(chalk.gray('────────────────────'));
  
  console.log(`${chalk.white('Total boundary calls:')} ${chalk.bold.white(calls.length)}`);
  
  const summary = calls.reduce((acc, call) => {
    acc[call.boundary] = (acc[call.boundary] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const labels: Record<string, string> = {
    'Client': 'Client Components:  ',
    'Server (RSC)': 'Server Components:  ',
    'Edge': 'Edge Components:    ',
  };

  Object.entries(labels).forEach(([key, label]) => {
    if (summary[key]) {
      const color = BOUNDARY_COLORS[key] || chalk.white;
      console.log(`${color(label)} ${chalk.bold(summary[key])}`);
    }
  });

  const title = options.showAll ? 'All hotspots:' : 'Top hotspots:';
  console.log('\n' + chalk.bold(title));
  
  // ファイルごとの集計と境界情報の保持
  const fileInfo = calls.reduce((acc, call) => {
    if (!acc[call.file]) {
      acc[call.file] = { count: 0, boundary: call.boundary };
    }
    acc[call.file].count++;
    return acc;
  }, {} as Record<string, { count: number; boundary: string }>);

  let sortedFiles = Object.entries(fileInfo)
    .sort((a, b) => b[1].count - a[1].count);

  if (!options.showAll) {
    sortedFiles = sortedFiles.slice(0, 5);
  }

  sortedFiles.forEach(([file, info]) => {
    const color = BOUNDARY_COLORS[info.boundary] || chalk.blue;
    console.log(`- ${color(file)} ${chalk.gray(`(${info.count})`)}`);
  });
  
  console.log('');
}

