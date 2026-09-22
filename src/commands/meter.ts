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
  .option('--idempotency-key <key>', 'Unique idempotency key to prevent double-metering')
  .option('--customer-id <id>', 'Target customer/tenant identifier')
  .option('--dimensions <json>', 'JSON dimensions (e.g. {"model":"claude-3-5"})')
  .option('--metadata <json>', 'Optional JSON metadata string')
  .option('--json', 'Output as JSON')
  .action(async (keyOrToken: string | undefined, options: {
    metric: string;
    value: string;
    idempotencyKey?: string;
    customerId?: string;
    dimensions?: string;
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

    let parsedDimensions: Record<string, unknown> | undefined;
    if (options.dimensions) {
      try {
        parsedDimensions = JSON.parse(options.dimensions);
      } catch {
        console.error(chalk.red('Error: Invalid JSON string provided for --dimensions.'));
        process.exit(1);
      }
    }

    const spinner = options.json ? null : ora(`Recording usage for metric "${options.metric}"...`).start();

    try {
      const res = await meterUsage(target, options.metric, val, {
        metadata: parsedMeta,
        dimensions: parsedDimensions,
        idempotencyKey: options.idempotencyKey,
        customerId: options.customerId,
      });

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
      if (data.is_duplicate) {
        spinner?.succeed(chalk.yellow('Duplicate event recognised via idempotency_key (no double charge)'));
      } else {
        spinner?.succeed(chalk.green('Usage event accepted & recorded!'));
      }

      if (options.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      console.log();
      console.log(chalk.bold('Usage & Commercial Control Summary:'));
      console.log(`  Metric:           ${chalk.cyan(options.metric)}`);
      console.log(`  Reported Units:   ${chalk.yellow(String(val))}`);
      
      const currentUsage = data.usage?.current ?? data.current_usage;
      const usageLimit = data.usage?.limit ?? data.usage_limit;
      const remainingTokens = data.usage?.remaining ?? data.remaining_tokens;

      if (currentUsage !== undefined) {
        console.log(`  Current Usage:    ${chalk.white(String(currentUsage))}`);
      }
      if (usageLimit !== undefined && usageLimit !== null) {
        console.log(`  Usage Limit:      ${chalk.white(String(usageLimit))}`);
      }
      if (remainingTokens !== undefined && remainingTokens !== null) {
        console.log(`  Remaining:        ${chalk.green(String(remainingTokens))}`);
      }
      if (data.status) {
        const color = data.status === 'exceeded' ? chalk.red : data.status === 'critical' ? chalk.magenta : data.status === 'warning' ? chalk.yellow : chalk.green;
        console.log(`  Quota Status:     ${color(data.status.toUpperCase())}`);
      }
      if (data.action) {
        const actColor = data.action === 'BLOCK' ? chalk.red.bold : data.action === 'WARN' ? chalk.yellow : chalk.green;
        console.log(`  Enforcement:      ${actColor(data.action)}`);
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
