/**
 * meter command - Report usage events for token-metered and consumption licenses
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { meterUsage } from '../lib/api';
import { getLicenseKey } from '../lib/config';

export const meterCommand = new Command('meter')
  .description('Report consumption/tokens against a metered license or client token')
  .argument('[license-or-token]', 'License key (lf_...) or client access token (lft_...)')
  .requiredOption('-m, --metric <name>', 'Metric name (e.g. api_calls, tokens, gigabytes)')
  .option('-v, --value <number>', 'Amount to increment/consume', '1')
  .option('--metadata <json>', 'Optional JSON metadata string')
  .option('--json', 'Output as JSON')
  .action(async (keyOrToken: string | undefined, options: {
    metric: string;
    value: string;
    metadata?: string;
    json?: boolean;
  }) => {
    const target = keyOrToken || getLicenseKey();
    if (!target) {
      console.error(chalk.red('Error: License key or client access token is required.'));
      process.exit(1);
    }

    const val = parseFloat(options.value);
    if (isNaN(val) || val <= 0) {
      console.error(chalk.red('Error: Value must be a positive number.'));
      process.exit(1);
    }

    let parsedMeta: Record<string, unknown> | undefined;
    if (options.metadata) {
      try {
        parsedMeta = JSON.parse(options.metadata);
      } catch {
        console.error(chalk.red('Error: Invalid JSON string provided for --metadata.'));
        process.exit(1);
      }
    }

    const spinner = options.json ? null : ora(`Recording usage for metric "${options.metric}"...`).start();

    try {
      const res = await meterUsage(target, options.metric, val, parsedMeta);

      if (!res.success || !res.data) {
        spinner?.fail(chalk.red('Usage metering failed'));
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: res.error }, null, 2));
        } else {
          console.error(chalk.red(`Error: ${res.error || 'Unknown error'}`));
        }
        process.exit(1);
      }

      const data = res.data;
      spinner?.succeed(chalk.green('Usage event recorded successfully!'));

      if (options.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      console.log();
      console.log(chalk.bold('Usage Summary:'));
      console.log(`  Metric:           ${chalk.cyan(options.metric)}`);
      console.log(`  Reported Units:   ${chalk.yellow(String(val))}`);
      if (data.current_usage !== undefined) {
        console.log(`  Current Usage:    ${chalk.white(String(data.current_usage))}`);
      }
      if (data.usage_limit !== undefined && data.usage_limit !== null) {
        console.log(`  Usage Limit:      ${chalk.white(String(data.usage_limit))}`);
      }
      if (data.remaining_tokens !== undefined && data.remaining_tokens !== null) {
        console.log(`  Remaining:        ${chalk.green(String(data.remaining_tokens))}`);
      }
      if (data.event_id) {
        console.log(`  Event ID:         ${chalk.gray(data.event_id)}`);
      }
      console.log();
    } catch (err: unknown) {
      spinner?.fail(chalk.red('Usage metering failed'));
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  });
