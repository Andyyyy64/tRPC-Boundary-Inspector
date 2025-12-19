#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeProject } from './analyzer.js';
import { generateMarkdownReport, printConsoleSummary } from './reporter.js';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const program = new Command();

program
  .name('trpc-boundary-inspector')
  .description('Make tRPC network boundaries visible.')
  .version('0.0.1')
  .argument('[path]', 'path to scan', '.')
  .option('-o, --output <file>', 'output file (e.g., report.md)')
  .option('--all', 'show all hotspots instead of top 5')
  .option('--details', 'show detailed call locations for each file')
  .option('--collapse', 'collapse duplicate calls in the same file (works with --details)')
  .option('-I, --ignore <patterns...>', 'ignore directories or files')
  .action(async (targetPath, options) => {
    try {
      const absolutePath = path.resolve(process.cwd(), targetPath);

      const result = await analyzeProject({
        targetPath: absolutePath,
        ignore: options.ignore,
      });

      printConsoleSummary(result, {
        showAll: options.all,
        details: options.details,
        collapse: options.collapse,
      });

      if (options.output) {
        const report = generateMarkdownReport(result);
        fs.writeFileSync(options.output, report);
        console.log(chalk.green(`Report saved to ${options.output}`));
      }
    } catch (error) {
      console.error(chalk.red('Error during scan:'), error);
      process.exit(1);
    }
  });

program.parse();
