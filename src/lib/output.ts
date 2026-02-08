/**
 * Output formatting utilities
 */

import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';

export const spinner = ora;

export const log = {
  success: (message: string) => console.log(chalk.green('✓'), message),
  error: (message: string) => console.log(chalk.red('✗'), message),
  warn: (message: string) => console.log(chalk.yellow('⚠'), message),
  info: (message: string) => console.log(chalk.blue('ℹ'), message),
  dim: (message: string) => console.log(chalk.dim(message)),
};

export function formatTable(data: string[][]): string {
  return table(data, {
    border: {
      topBody: '─',
      topJoin: '┬',
      topLeft: '┌',
      topRight: '┐',
      bottomBody: '─',
      bottomJoin: '┴',
      bottomLeft: '└',
      bottomRight: '┘',
      bodyLeft: '│',
      bodyRight: '│',
      bodyJoin: '│',
      joinBody: '─',
      joinLeft: '├',
      joinRight: '┤',
      joinJoin: '┼',
    },
  });
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function printKeyValue(key: string, value: string | number | boolean | undefined): void {
  const formattedValue = value === undefined ? chalk.dim('(not set)') : String(value);
  console.log(`  ${chalk.cyan(key)}: ${formattedValue}`);
}

export function printHeader(title: string): void {
  console.log();
  console.log(chalk.bold.underline(title));
  console.log();
}

export function printBox(content: string, title?: string): void {
  const lines = content.split('\n');
  const maxLength = Math.max(...lines.map(l => l.length), (title?.length || 0) + 4);
  
  console.log('┌' + '─'.repeat(maxLength + 2) + '┐');
  if (title) {
    console.log('│ ' + chalk.bold(title.padEnd(maxLength)) + ' │');
    console.log('├' + '─'.repeat(maxLength + 2) + '┤');
  }
  for (const line of lines) {
    console.log('│ ' + line.padEnd(maxLength) + ' │');
  }
  console.log('└' + '─'.repeat(maxLength + 2) + '┘');
}
