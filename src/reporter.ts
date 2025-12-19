import { AnalysisResult, TRPCCall } from './analyzer.js';
import chalk from 'chalk';

/**
 * Markdown レポートの生成
 */
export function generateMarkdownReport(result: AnalysisResult): string {
  const { calls, fileCount } = result;

  let report = `# tRPC Boundary Report\n\n`;
  report += `Analyzed **${fileCount}** files. Found **${calls.length}** network boundary crossings.\n\n`;

  // 境界ごとのサマリー
  const summary = calls.reduce(
    (acc, call) => {
      acc[call.boundary] = (acc[call.boundary] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  report += `## Summary by Boundary\n\n`;
  report += `| Boundary | Count |\n`;
  report += `| --- | --- |\n`;
  for (const [boundary, count] of Object.entries(summary)) {
    report += `| ${boundary} | ${count} |\n`;
  }
  report += `\n`;

  // ファイル別のランキング
  const fileRanking = calls.reduce(
    (acc, call) => {
      acc[call.file] = (acc[call.file] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

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
  Client: chalk.cyan,
  'Server (RSC)': chalk.green,
  Edge: chalk.magenta,
};

/**
 * 通信タイプごとのラベル
 */
const TYPE_LABELS: Record<string, string> = {
  query: chalk.blue('[query]'),
  mutation: chalk.yellow('[mutation]'),
  subscription: chalk.magenta('[subscription]'),
  utils: chalk.gray('[utils]'),
  unknown: chalk.white('[unknown]'),
};

/**
 * コンソールへのサマリー出力
 */
export function printConsoleSummary(
  result: AnalysisResult,
  options: { showAll?: boolean; details?: boolean; collapse?: boolean } = {},
): void {
  const { calls } = result;

  console.log('\n' + chalk.bold('tRPC Network Boundary Inspection'));
  console.log(chalk.gray('────────────────────────────────'));

  console.log(
    `${chalk.white('Total network boundary crossings:')} ${chalk.bold.white(calls.length)}`,
  );

  const summary = calls.reduce(
    (acc, call) => {
      acc[call.boundary] = (acc[call.boundary] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const labels: Record<string, string> = {
    Client: 'Crossings from Browser (Client): ',
    'Server (RSC)': 'Crossings from Server (RSC):  ',
    Edge: 'Crossings from Edge Runtime:  ',
  };

  Object.entries(labels).forEach(([key, label]) => {
    if (summary[key]) {
      const color = BOUNDARY_COLORS[key] || chalk.white;
      console.log(`${color(label)} ${chalk.bold(summary[key])}`);
    }
  });

  const title = options.showAll ? 'All hotspots:' : 'Top hotspots:';
  console.log('\n' + chalk.bold(title));

  // ファイルごとの詳細をグループ化
  const fileGroups = calls.reduce(
    (acc, call) => {
      if (!acc[call.file]) {
        acc[call.file] = { count: 0, boundary: call.boundary, items: [] };
      }
      acc[call.file].count++;
      acc[call.file].items.push(call);
      return acc;
    },
    {} as Record<string, { count: number; boundary: string; items: TRPCCall[] }>,
  );

  let sortedFiles = Object.entries(fileGroups).sort((a, b) => b[1].count - a[1].count);

  if (!options.showAll && !options.details) {
    sortedFiles = sortedFiles.slice(0, 5);
  }

  sortedFiles.forEach(([file, info]) => {
    const color = BOUNDARY_COLORS[info.boundary] || chalk.blue;
    console.log(`- ${color(file)} ${chalk.gray(`(${info.count})`)}`);

    if (options.details) {
      if (options.collapse) {
        // 同じ呼び出しをまとめる
        const collapsed = info.items.reduce(
          (acc, item) => {
            const key = `${item.procedurePath}.${item.method}`;
            if (!acc[key]) {
              acc[key] = { ...item, count: 0 };
            }
            acc[key].count++;
            return acc;
          },
          {} as Record<string, TRPCCall & { count: number }>,
        );

        Object.values(collapsed).forEach((item) => {
          const typeLabel = TYPE_LABELS[item.type] || TYPE_LABELS.unknown;
          const methodColor = item.method.startsWith('use') ? chalk.cyan : chalk.green;
          const countLabel = item.count > 1 ? chalk.gray(` (x${item.count})`) : '';
          console.log(
            `  ${typeLabel} ${chalk.white(`trpc.${item.procedurePath}.`)}${methodColor(item.method)}${countLabel}`,
          );
        });
      } else {
        info.items
          .sort((a, b) => a.line - b.line)
          .forEach((item) => {
            const lineStr = `L${item.line}`.padEnd(5);
            const typeLabel = TYPE_LABELS[item.type] || TYPE_LABELS.unknown;
            const methodColor = item.method.startsWith('use') ? chalk.cyan : chalk.green;
            console.log(
              `  ${chalk.gray(lineStr)} ${typeLabel} ${chalk.white(`trpc.${item.procedurePath}.`)}${methodColor(item.method)}`,
            );
          });
      }
    }
  });

  console.log('');
}
